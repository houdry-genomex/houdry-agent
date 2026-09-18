"""Trust-on-first-use pinning of a Houdry control-plane Root CA.

``houdry serve`` uses a private HTTPS CA. Python (httpx / OpenAI) verifies
against the public store by default, so ``/v1/models`` and chat fail with
``CERTIFICATE_VERIFY_FAILED`` even after UDP discover found the plane.

Pin ``GET {origin}/v1/pki/ca`` for RFC1918 Houdry URLs only — never for
public internet hosts.
"""

from __future__ import annotations

import hashlib
import logging
import os
import ssl
import urllib.parse
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

HOUDRY_PORTS = {18080, 8090, 8080}


def is_houdry_lan_https(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse((url or "").strip())
    except Exception:
        return False
    if parsed.scheme != "https":
        return False
    host = (parsed.hostname or "").lower()
    if not host or not _is_private_or_loopback(host):
        return False
    return parsed.port in HOUDRY_PORTS


def httpx_verify_for_url(url: str):
    """httpx ``verify`` value for a models/chat probe against ``url``.

    Public URLs keep default verification. Houdry LAN URLs use the pinned
    plane CA, or ``False`` if the CA endpoint is missing so a private cert
    still does not block Refresh.
    """
    if not is_houdry_lan_https(url):
        return True
    pinned = pin_houdry_ca(url)
    if pinned:
        return pinned
    return False


def ssl_context_for_url(url: str) -> Optional[ssl.SSLContext]:
    """SSLContext for urllib catalog probes, or None when this is not Houdry LAN."""
    if not is_houdry_lan_https(url):
        return None
    pinned = pin_houdry_ca(url)
    ctx = ssl.create_default_context()
    if pinned:
        ctx.load_verify_locations(cafile=pinned)
        return ctx
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def pin_houdry_ca(url: str) -> str:
    """Fetch and persist ``/v1/pki/ca`` for this origin. Empty string on miss."""
    if not is_houdry_lan_https(url):
        return ""
    try:
        parsed = urllib.parse.urlparse(url.strip())
        origin = f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return ""

    dest = _ca_path_for_origin(origin)
    if dest.is_file() and dest.stat().st_size > 0:
        try:
            if "BEGIN CERTIFICATE" in dest.read_text(encoding="utf-8"):
                return str(dest)
        except OSError:
            pass

    pem = _fetch_ca_pem(origin)
    if not pem:
        return ""
    try:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(pem, encoding="utf-8")
        os.chmod(dest, 0o644)
    except OSError:
        logger.debug("could not persist Houdry CA pin at %s", dest, exc_info=True)
        return ""
    return str(dest)


def _is_private_or_loopback(host: str) -> bool:
    if host in {"127.0.0.1", "localhost", "::1"}:
        return True
    parts = host.split(".")
    if len(parts) != 4:
        return False
    try:
        nums = [int(p) for p in parts]
    except ValueError:
        return False
    if any(n < 0 or n > 255 for n in nums):
        return False
    a, b = nums[0], nums[1]
    if a == 10:
        return True
    if a == 192 and b == 168:
        return True
    if a == 172 and 16 <= b <= 31:
        return True
    return False


def _ca_store_dir() -> Path:
    home = (os.environ.get("HERMES_HOME") or os.environ.get("HOUDRY_HOME") or "").strip()
    if home:
        return Path(home) / "houdry-tofu"
    return Path.home() / ".hermes" / "houdry-tofu"


def _ca_path_for_origin(origin: str) -> Path:
    digest = hashlib.sha256(origin.encode("utf-8")).hexdigest()[:16]
    return _ca_store_dir() / f"{digest}.crt"


def _fetch_ca_pem(origin: str) -> str:
    try:
        import httpx
    except Exception:
        return ""
    try:
        with httpx.Client(timeout=httpx.Timeout(5.0), verify=False) as client:
            resp = client.get(origin.rstrip("/") + "/v1/pki/ca")
    except Exception:
        logger.debug("Houdry CA fetch failed for %s", origin, exc_info=True)
        return ""
    if resp.status_code != 200:
        return ""
    body = resp.text or ""
    if "BEGIN CERTIFICATE" not in body:
        return ""
    return body

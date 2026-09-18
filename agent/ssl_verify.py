"""TLS verify resolution for httpx/OpenAI provider clients."""

from __future__ import annotations

import logging
import os
import ssl
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _coerce_insecure(ssl_verify: Any) -> bool:
    if ssl_verify is False:
        return True
    if isinstance(ssl_verify, str) and ssl_verify.strip().lower() in {"false", "0", "no", "off"}:
        return True
    return False


def resolve_httpx_verify(
    *,
    ca_bundle: Optional[str] = None,
    ssl_verify: Any = None,
    base_url: str = "",
) -> bool | ssl.SSLContext:
    """Resolve httpx ``verify`` for provider HTTP clients.

    Priority:
    1. ``ssl_verify: false`` — disable verification (local dev only)
    2. explicit ``ca_bundle`` (per-provider ``ssl_ca_cert`` config field)
    3. Houdry control-plane TOFU CA for RFC1918 ``houdry serve`` URLs
    4. ``HERMES_CA_BUNDLE``, ``SSL_CERT_FILE``, ``REQUESTS_CA_BUNDLE``,
       ``CURL_CA_BUNDLE`` env vars
    5. ``True`` (httpx/certifi default)
    """
    if _coerce_insecure(ssl_verify):
        logger.warning(
            "TLS certificate verification DISABLED (ssl_verify: false) for %s — "
            "this is intended for local development only and is unsafe on any "
            "network you do not fully control.",
            base_url or "a custom provider endpoint",
        )
        return False

    explicit_ca = (ca_bundle or "").strip()
    if explicit_ca:
        ca_path = str(Path(explicit_ca).expanduser())
        if os.path.isfile(ca_path):
            return ssl.create_default_context(cafile=ca_path)
        logger.warning(
            "CA bundle path does not exist: %s — falling back to default certificates",
            explicit_ca,
        )

    houdry_ca = _houdry_pinned_ca(base_url)
    if houdry_ca:
        return ssl.create_default_context(cafile=houdry_ca)

    effective_ca = (
        os.getenv("HERMES_CA_BUNDLE", "").strip()
        or os.getenv("SSL_CERT_FILE", "").strip()
        or os.getenv("REQUESTS_CA_BUNDLE", "").strip()
        or os.getenv("CURL_CA_BUNDLE", "").strip()
    )
    if effective_ca:
        ca_path = str(Path(effective_ca).expanduser())
        if os.path.isfile(ca_path):
            return ssl.create_default_context(cafile=ca_path)
        logger.warning(
            "CA bundle path does not exist: %s — falling back to default certificates",
            effective_ca,
        )
    return True


def _houdry_pinned_ca(base_url: str) -> str:
    if not (base_url or "").strip():
        return ""
    try:
        from hermes_cli.houdry_tls import pin_houdry_ca

        return pin_houdry_ca(base_url) or ""
    except Exception:
        return ""

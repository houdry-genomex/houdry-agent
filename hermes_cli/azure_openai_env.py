"""Azure OpenAI / Foundry environment helpers.

Hermes' canonical Azure provider id is ``azure-foundry`` (alias ``azure``).
Microsoft Azure OpenAI deployments commonly use ``AZURE_OPENAI_*`` env names;
Foundry setup historically used ``AZURE_FOUNDRY_*``. Both are accepted.

Portal "Get Started" samples use::

    AzureOpenAI(
        api_version="2024-12-01-preview",
        azure_endpoint="https://RESOURCE.openai.azure.com/",
        api_key=...,
    )
    client.chat.completions.create(model=deployment, ...)

Hermes uses the OpenAI SDK ``OpenAI(base_url=..., default_query=...)`` shape.
For chat completions we map that to the equivalent deployment-scoped URL::

    https://RESOURCE.openai.azure.com/openai/deployments/{deployment}?api-version=...

For Responses API (``api_mode: codex_responses``) we use the v1 root without
a dated ``api-version`` (Azure rejects dated versions on ``/openai/v1``).

This module does **not** replace the Houdry fabric path.
"""

from __future__ import annotations

import os
import re
from typing import Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

# Preferred order: Foundry-specific names first (documented Hermes path),
# then Azure OpenAI portal / SDK names.
_API_KEY_ENVS = ("AZURE_FOUNDRY_API_KEY", "AZURE_OPENAI_API_KEY")
_BASE_URL_ENVS = ("AZURE_FOUNDRY_BASE_URL", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_BASE_URL")
_DEPLOYMENT_ENVS = ("AZURE_OPENAI_DEPLOYMENT", "AZURE_FOUNDRY_DEPLOYMENT")
_API_VERSION_ENVS = ("AZURE_OPENAI_API_VERSION", "AZURE_FOUNDRY_API_VERSION")

# Portal Get Started default for AzureOpenAI(api_version=...).
_DEFAULT_CHAT_API_VERSION = "2024-12-01-preview"

# Dev convenience aliases for Hermes' existing HERMES_INFERENCE_PROVIDER knob.
_PROVIDER_OVERRIDE_ENVS = ("HERMES_LLM_PROVIDER", "HERMES_INFERENCE_PROVIDER")

_PROVIDER_ALIASES = {
    "azure": "azure-foundry",
    "azure-openai": "azure-foundry",
    "azure_openai": "azure-foundry",
    "azure-foundry": "azure-foundry",
    "azure-ai": "azure-foundry",
    "azure-ai-foundry": "azure-foundry",
    "houdry": "custom",
    "houdry-fabric": "custom",
    "fabric": "custom",
}


def _first_env(*names: str) -> str:
    for name in names:
        val = (os.getenv(name) or "").strip()
        if val:
            return val
    return ""


def _env_or_config(*names: str) -> str:
    try:
        from hermes_cli.config import get_env_value

        for name in names:
            val = (get_env_value(name) or "").strip()
            if val:
                return val
    except Exception:
        pass
    return _first_env(*names)


def azure_resource_origin(url: str) -> str:
    """Return ``https://host`` from any Azure OpenAI / Foundry URL."""
    raw = (url or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    if not parsed.netloc:
        return ""
    return f"{parsed.scheme or 'https'}://{parsed.netloc}"


def get_azure_api_version() -> str:
    """Portal ``api_version`` (e.g. ``2024-12-01-preview``)."""
    return _env_or_config(*_API_VERSION_ENVS)


def normalize_azure_openai_endpoint(url: str) -> str:
    """Normalize a portal/resource URL toward an OpenAI-compatible base.

    - Bare ``https://resource.openai.azure.com/`` → ``.../openai/v1``
    - ``.../openai/responses`` → ``.../openai/v1``
    - Dated ``api-version`` on ``/openai/v1`` is stripped (v1 GA rejects it)
    - Deployment-scoped URLs (``.../openai/deployments/...``) are left intact
    """
    raw = (url or "").strip().rstrip("/")
    if not raw:
        return ""
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    path = (parsed.path or "").rstrip("/")
    host = (parsed.netloc or "").lower()
    query = parsed.query or ""

    if path.endswith("/anthropic"):
        return urlunparse(parsed._replace(path=path)).rstrip("/")

    # Already deployment-scoped (portal AzureOpenAI equivalent) — keep as-is.
    if "/openai/deployments/" in path:
        return urlunparse(parsed._replace(path=path, query=query)).rstrip("/")

    if re.search(r"/openai/responses/?$", path):
        path = re.sub(r"/openai/responses/?$", "/openai/v1", path)

    if re.search(r"/openai(/v\d+)?$", path) or path.endswith("/v1"):
        if host.endswith("openai.azure.com") and path.endswith("/openai"):
            path = f"{path}/v1"
    elif "openai.azure.com" in host or "cognitiveservices.azure.com" in host:
        path = f"{path}/openai/v1" if path else "/openai/v1"
    elif "services.ai.azure.com" in host and not path:
        path = "/openai/v1"
    else:
        return raw

    if path.endswith("/openai/v1") or re.search(r"/openai/v\d+$", path):
        query = _strip_dated_azure_api_version(query)

    return urlunparse(parsed._replace(path=path or "/", query=query)).rstrip("/")


def _strip_dated_azure_api_version(query: str) -> str:
    if not query:
        return ""
    kept = []
    for part in query.split("&"):
        if not part:
            continue
        key, _, val = part.partition("=")
        if key.lower() == "api-version" and re.match(r"^\d{4}-\d{2}-\d{2}", val or ""):
            continue
        kept.append(part)
    return "&".join(kept)


def build_azure_openai_base_url(
    *,
    api_mode: str = "chat_completions",
    deployment: str = "",
    endpoint: str = "",
) -> str:
    """Build the base_url Hermes should pass to the OpenAI SDK.

    ``chat_completions`` → deployment-scoped URL + portal api-version
    (matches Azure portal Get Started / ``AzureOpenAI`` samples).

    ``codex_responses`` → ``https://host/openai/v1`` with no dated api-version.
    """
    raw = (endpoint or "").strip() or _env_or_config(*_BASE_URL_ENVS)
    if not raw:
        return ""

    mode = (api_mode or "chat_completions").strip().lower()
    dep = (deployment or get_azure_deployment()).strip()
    origin = azure_resource_origin(raw)
    parsed = urlparse(raw if "://" in raw else f"https://{raw}")
    path = (parsed.path or "").rstrip("/")

    # Anthropic Foundry route — leave alone.
    if path.endswith("/anthropic"):
        return normalize_azure_openai_endpoint(raw)

    if mode in {"codex_responses", "responses"}:
        if not origin:
            return normalize_azure_openai_endpoint(raw)
        return f"{origin}/openai/v1"

    # chat_completions (portal sample path)
    if "/openai/deployments/" in path:
        # User already supplied deployment URL; ensure api-version present.
        version = get_azure_api_version() or _DEFAULT_CHAT_API_VERSION
        qs = parse_qs(parsed.query, keep_blank_values=False)
        if "api-version" not in {k.lower() for k in qs}:
            qs["api-version"] = [version]
        flat = [(k, v) for k, vals in qs.items() for v in vals]
        return urlunparse(parsed._replace(path=path, query=urlencode(flat))).rstrip("/")

    if not origin:
        return normalize_azure_openai_endpoint(raw)
    if not dep:
        # Fall back to v1 root; caller must still pass model=deployment.
        version = get_azure_api_version() or _DEFAULT_CHAT_API_VERSION
        return f"{origin}/openai/v1?api-version={version}"

    version = get_azure_api_version() or _DEFAULT_CHAT_API_VERSION
    return f"{origin}/openai/deployments/{dep}?api-version={version}"


def get_azure_api_key() -> str:
    """Return the first configured Azure API key (never log this value)."""
    return _env_or_config(*_API_KEY_ENVS)


def get_azure_base_url() -> str:
    """Return a default normalized base URL from env (chat-oriented)."""
    return build_azure_openai_base_url(api_mode="chat_completions")


def get_azure_deployment() -> str:
    """Azure deployment / model id (e.g. ``gpt-5.6-luna``)."""
    return _env_or_config(*_DEPLOYMENT_ENVS)


_DEFAULT_AZURE_CHAT_DEPLOYMENT = "gpt-5.6-luna"

# Session leftovers from Anthropic / OpenCode / other catalogs are not Azure
# OpenAI deployments. Sending them as ``/openai/deployments/{id}`` 404s.
_FOREIGN_AZURE_CHAT_MODEL = re.compile(
    r"(claude|anthropic|gemini|llama|mistral|deepseek|qwen|grok|"
    r"nemotron|opencode|hy3|laguna|muse[-_]?spark|(?<![a-z])opus(?![a-z])|"
    r"sonnet|haiku)",
    re.I,
)


def azure_openai_model_base_id(model: str) -> str:
    return (model or "").strip().rsplit("/", 1)[-1]


def is_azure_openai_chat_model(model: str) -> bool:
    """True when ``model`` can be an Azure OpenAI chat deployment name."""
    base = azure_openai_model_base_id(model)
    if not base:
        return False
    lowered = base.lower()
    if lowered.startswith(("gpt-", "o1", "o3", "o4")):
        return True
    return not bool(_FOREIGN_AZURE_CHAT_MODEL.search(lowered))


def coerce_azure_openai_model(requested: str, *, api_mode: str = "") -> str:
    """Replace leftover Claude/OpenCode ids with the Azure chat deployment.

    Anthropic-style Foundry (``api_mode: anthropic_messages``) keeps Claude ids.
    """
    mode = (api_mode or "").strip().lower()
    dep = get_azure_deployment() or _DEFAULT_AZURE_CHAT_DEPLOYMENT
    raw = (requested or "").strip()
    if mode in {"anthropic_messages", "anthropic"}:
        return raw or dep
    if not raw:
        return dep
    base = azure_openai_model_base_id(raw)
    if base == dep or raw == dep:
        return dep
    if is_azure_openai_chat_model(raw):
        return base
    return dep


def resolve_llm_provider_override() -> Optional[str]:
    """Map HERMES_LLM_PROVIDER / HERMES_INFERENCE_PROVIDER to a canonical id."""
    raw = _first_env(*_PROVIDER_OVERRIDE_ENVS).lower()
    if not raw:
        return None
    return _PROVIDER_ALIASES.get(raw, raw)


def azure_provider_status_summary(
    *,
    provider: str,
    base_url: str = "",
    deployment: str = "",
    auth_mode: str = "api_key",
) -> dict:
    """Non-secret summary suitable for doctor/status output."""
    return {
        "provider": provider,
        "display": "Azure OpenAI / Foundry",
        "base_url": base_url or "(not set)",
        "deployment": deployment or "(not set)",
        "auth_mode": auth_mode,
        "api_key_configured": bool(get_azure_api_key()),
        "api_version": get_azure_api_version() or _DEFAULT_CHAT_API_VERSION,
    }

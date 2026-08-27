"""Tests for Azure OpenAI env aliases on azure-foundry (Houdry fabric untouched)."""

from __future__ import annotations

import pytest

from hermes_cli.auth import AuthError
from hermes_cli.azure_openai_env import (
    build_azure_openai_base_url,
    coerce_azure_openai_model,
    get_azure_api_key,
    get_azure_base_url,
    get_azure_deployment,
    is_azure_openai_chat_model,
    normalize_azure_openai_endpoint,
    resolve_llm_provider_override,
)
from hermes_cli.runtime_provider import (
    _resolve_azure_foundry_runtime,
    resolve_requested_provider,
)


@pytest.fixture(autouse=True)
def _clear_azure_env(monkeypatch):
    for key in (
        "AZURE_FOUNDRY_API_KEY",
        "AZURE_FOUNDRY_BASE_URL",
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_BASE_URL",
        "AZURE_OPENAI_DEPLOYMENT",
        "AZURE_FOUNDRY_DEPLOYMENT",
        "AZURE_OPENAI_API_VERSION",
        "AZURE_FOUNDRY_API_VERSION",
        "HERMES_LLM_PROVIDER",
        "HERMES_INFERENCE_PROVIDER",
    ):
        monkeypatch.delenv(key, raising=False)


class TestNormalizeEndpoint:
    def test_bare_resource_gets_openai_v1(self):
        assert (
            normalize_azure_openai_endpoint("https://my.openai.azure.com")
            == "https://my.openai.azure.com/openai/v1"
        )

    def test_preserves_existing_v1(self):
        url = "https://my.openai.azure.com/openai/v1"
        assert normalize_azure_openai_endpoint(url) == url

    def test_responses_portal_url_rewrites_to_v1(self):
        assert (
            normalize_azure_openai_endpoint(
                "https://my.openai.azure.com/openai/responses?api-version=2025-04-01-preview"
            )
            == "https://my.openai.azure.com/openai/v1"
        )

    def test_strips_dated_api_version_on_v1(self):
        assert (
            normalize_azure_openai_endpoint(
                "https://my.openai.azure.com/openai/v1?api-version=2025-04-01-preview"
            )
            == "https://my.openai.azure.com/openai/v1"
        )

    def test_preserves_anthropic_path(self):
        url = "https://my.services.ai.azure.com/anthropic"
        assert normalize_azure_openai_endpoint(url) == url


class TestPortalChatUrl:
    def test_builds_deployment_scoped_url(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://my.openai.azure.com/")
        monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")
        monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        assert (
            build_azure_openai_base_url(
                api_mode="chat_completions", deployment="gpt-5.6-luna"
            )
            == "https://my.openai.azure.com/openai/deployments/gpt-5.6-luna?api-version=2024-12-01-preview"
        )

    def test_responses_mode_uses_v1_without_dated_version(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://my.openai.azure.com/")
        monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        assert (
            build_azure_openai_base_url(api_mode="codex_responses")
            == "https://my.openai.azure.com/openai/v1"
        )


class TestEnvAliases:
    def test_openai_key_and_endpoint(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "sk-azure-test-key")
        monkeypatch.setenv(
            "AZURE_OPENAI_ENDPOINT", "https://luna.openai.azure.com"
        )
        monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")
        assert get_azure_api_key() == "sk-azure-test-key"
        assert "luna.openai.azure.com" in get_azure_base_url()
        assert get_azure_deployment() == "gpt-5.6-luna"

    def test_foundry_names_still_win_when_set_first(self, monkeypatch):
        monkeypatch.setenv("AZURE_FOUNDRY_API_KEY", "foundry-key")
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "openai-key")
        assert get_azure_api_key() == "foundry-key"


class TestProviderOverride:
    def test_azure_alias(self, monkeypatch):
        monkeypatch.setenv("HERMES_LLM_PROVIDER", "azure")
        assert resolve_llm_provider_override() == "azure-foundry"

    def test_houdry_alias(self, monkeypatch):
        monkeypatch.setenv("HERMES_LLM_PROVIDER", "houdry")
        assert resolve_llm_provider_override() == "custom"

    def test_resolve_requested_maps_azure(self, monkeypatch):
        assert resolve_requested_provider("azure") == "azure-foundry"
        assert resolve_requested_provider("azure-openai") == "azure-foundry"
        assert resolve_requested_provider("houdry") == "custom"


class TestResolveAzureRuntime:
    def test_missing_endpoint(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "sk-test")
        with pytest.raises(AuthError, match="base URL"):
            _resolve_azure_foundry_runtime(
                requested_provider="azure",
                model_cfg={"provider": "azure"},
            )

    def test_missing_api_key(self, monkeypatch):
        monkeypatch.setenv(
            "AZURE_OPENAI_ENDPOINT", "https://x.openai.azure.com/openai/v1"
        )
        with pytest.raises(AuthError, match="API key"):
            _resolve_azure_foundry_runtime(
                requested_provider="azure-foundry",
                model_cfg={
                    "provider": "azure-foundry",
                    "base_url": "https://x.openai.azure.com/openai/v1",
                },
            )

    def test_explicit_chat_mode_matches_portal(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "sk-azure-test-key-long")
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://luna.openai.azure.com/")
        monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")
        monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        runtime = _resolve_azure_foundry_runtime(
            requested_provider="azure",
            model_cfg={
                "provider": "azure",
                "default": "gpt-5.6-luna",
                "api_mode": "chat_completions",
            },
        )
        assert runtime["provider"] == "azure-foundry"
        assert runtime["api_mode"] == "chat_completions"
        assert runtime["base_url"] == (
            "https://luna.openai.azure.com/openai/deployments/gpt-5.6-luna"
            "?api-version=2024-12-01-preview"
        )

    def test_explicit_key_override(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "from-env")
        runtime = _resolve_azure_foundry_runtime(
            requested_provider="azure-foundry",
            model_cfg={
                "provider": "azure-foundry",
                "base_url": "https://x.openai.azure.com/openai/v1",
                "default": "gpt-4o",
                "api_mode": "chat_completions",
            },
            explicit_api_key="from-cli",
        )
        assert runtime["api_key"] == "from-cli"
        assert runtime["api_mode"] == "chat_completions"


class TestCoerceAzureChatModel:
    def test_keeps_gpt_deployment(self):
        assert is_azure_openai_chat_model("gpt-5.6-luna")
        assert coerce_azure_openai_model("gpt-4o") == "gpt-4o"

    def test_replaces_claude_opus_leftover(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")
        assert not is_azure_openai_chat_model("claude-opus-4.6")
        assert coerce_azure_openai_model("claude-opus-4.6") == "gpt-5.6-luna"
        assert coerce_azure_openai_model("anthropic/claude-opus-4.6") == "gpt-5.6-luna"

    def test_keeps_claude_on_anthropic_foundry(self):
        assert (
            coerce_azure_openai_model("claude-opus-4.6", api_mode="anthropic_messages")
            == "claude-opus-4.6"
        )

    def test_opus_target_builds_luna_deployment_url(self, monkeypatch):
        monkeypatch.setenv("AZURE_OPENAI_API_KEY", "sk-azure-test-key-long")
        monkeypatch.setenv("AZURE_OPENAI_ENDPOINT", "https://luna.openai.azure.com/")
        monkeypatch.setenv("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna")
        monkeypatch.setenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
        runtime = _resolve_azure_foundry_runtime(
            requested_provider="azure-foundry",
            target_model="claude-opus-4.6",
            model_cfg={
                "provider": "azure-foundry",
                "default": "claude-opus-4.6",
                "api_mode": "chat_completions",
            },
        )
        assert runtime["model"] == "gpt-5.6-luna"
        assert runtime["base_url"] == (
            "https://luna.openai.azure.com/openai/deployments/gpt-5.6-luna"
            "?api-version=2024-12-01-preview"
        )


class TestHoudryStillCustom:
    def test_houdry_defaults_yaml_unchanged(self):
        from pathlib import Path

        text = Path("config/houdry-fabric.defaults.yaml").read_text()
        assert "provider: custom" in text
        assert "18080/v1" in text
        assert "auto" in text

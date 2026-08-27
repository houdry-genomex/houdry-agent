"""Microsoft Foundry provider profile.

Azure Foundry exposes an OpenAI-compatible endpoint; users supply their own
base URL at setup since endpoints are per-resource.
"""

from providers import register_provider
from providers.base import ProviderProfile

azure_foundry = ProviderProfile(
    name="azure-foundry",
    aliases=("azure", "azure-openai", "azure-ai-foundry", "azure-ai"),
    display_name="Azure OpenAI / Foundry",
    description=(
        "Azure OpenAI or Microsoft Foundry — OpenAI-compatible endpoint "
        "(AZURE_OPENAI_* or AZURE_FOUNDRY_* env; user-supplied base URL)"
    ),
    signup_url="https://ai.azure.com/",
    env_vars=(
        "AZURE_FOUNDRY_API_KEY",
        "AZURE_FOUNDRY_BASE_URL",
        "AZURE_OPENAI_API_KEY",
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_DEPLOYMENT",
    ),
    base_url="",  # per-resource; user provides at setup
    auth_type="api_key",
)

register_provider(azure_foundry)

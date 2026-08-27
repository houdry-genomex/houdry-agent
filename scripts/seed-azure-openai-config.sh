#!/bin/sh
# Seed $HERMES_HOME for Azure OpenAI (dev) without removing Houdry templates.
# Requires AZURE_OPENAI_* (or AZURE_FOUNDRY_*) already in the environment or
# written into .env by you — this script never invents secrets.
set -e
HOME_DIR="${HERMES_HOME:-${HOME}/.houdry-agent}"
ROOT="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
mkdir -p "$HOME_DIR"

if [ ! -f "$HOME_DIR/config.yaml" ]; then
  cp "$ROOT/config/azure-openai.defaults.yaml" "$HOME_DIR/config.yaml"
  echo "Wrote $HOME_DIR/config.yaml (Azure OpenAI template)"
else
  echo "config.yaml already exists at $HOME_DIR (left unchanged)"
  echo "To switch manually, set model.provider: azure and model.default to your deployment."
fi

ENV_FILE="$HOME_DIR/.env"
touch "$ENV_FILE"
_add_if_missing() {
  key="$1"
  example="$2"
  if ! grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    printf '%s=%s\n' "$key" "$example" >> "$ENV_FILE"
    echo "Appended placeholder $key to $ENV_FILE (edit with your real value)"
  fi
}

_add_if_missing "AZURE_OPENAI_API_KEY" ""
_add_if_missing "AZURE_OPENAI_ENDPOINT" "https://YOUR_RESOURCE.openai.azure.com"
_add_if_missing "AZURE_OPENAI_DEPLOYMENT" "gpt-5.6-luna"

echo "Edit $ENV_FILE with your Azure credentials, then:"
echo "  hermes chat -q 'ping' "
echo "Or Desktop: Settings → Providers → API Keys → Azure OpenAI."
echo "Windows (no bash): py -3 scripts/seed_mrpl_desktop_home.py"
echo "Houdry fabric remains available via scripts/seed-houdry-fabric-config.sh"

# Azure OpenAI (dev) ↔ Houdry fabric (private GPU)

Houdry Agent / Hermes keeps a **replaceable LLM provider**. Agent tools and
workflows do not depend on Azure or Houdry specifically. MRPL skills and
knowledge mounts live above this layer — see [mrpl/ARCHITECTURE.md](mrpl/ARCHITECTURE.md).

```text
                    Hermes Agent
                         |
                  LLM provider select
                    /          \
                   /            \
          Azure OpenAI          Houdry
          GPT-5.6 Luna          GPU fabric
          (dev / cloud)         (private / on-prem)
```

Canonical Azure provider id: **`azure-foundry`** (aliases: `azure`,
`azure-openai`). Houdry fabric uses **`custom`** (aliases: `houdry`,
`fabric`) with `base_url` pointing at `http://<host>:18080/v1`.

## Azure setup (GPT-5.6 Luna)

1. Put secrets in `$HERMES_HOME/.env` (default `~/.houdry-agent/.env`):

```bash
# Optional process override when config.provider is empty:
# HERMES_LLM_PROVIDER=azure
# (alias of HERMES_INFERENCE_PROVIDER)

AZURE_OPENAI_API_KEY=...          # never commit
# Portal Get Started style (bare resource root — preferred):
AZURE_OPENAI_ENDPOINT=https://YOUR_RESOURCE.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-5.6-luna
```

```yaml
model:
  provider: azure
  default: gpt-5.6-luna
  api_mode: chat_completions   # matches portal AzureOpenAI + chat.completions samples
```

Hermes maps that to the OpenAI-SDK equivalent of the portal snippet:

`https://RESOURCE.openai.azure.com/openai/deployments/gpt-5.6-luna?api-version=2024-12-01-preview`

**Do not** put a dated `api-version` on a bare `/openai/v1` Responses URL —
Azure returns `HTTP 400: API version not supported`. For Responses mode, omit
the dated version entirely.

Or seed a template:

```bash
./scripts/seed-azure-openai-config.sh
# then edit ~/.houdry-agent/.env
```

3. Smoke (no secrets printed):

```bash
source .venv/bin/activate   # if using the repo venv
export HERMES_HOME=~/.houdry-agent
hermes doctor               # should show Azure logged_in without dumping keys
hermes chat -q 'Reply with exactly: azure-ok'
# Tool round-trip (agent may call terminal/search depending on toolsets):
hermes chat -q 'Use a tool if needed, then say: tools-ok. What is 2+2?'
```

With `api_mode: chat_completions` pinned (recommended for portal GPT-5.6 Luna
samples), Hermes stays on chat completions. Omit `api_mode` only if you want
auto Responses routing for other GPT-5 deployments.

## Switch back to Houdry fabric

```yaml
model:
  provider: custom   # or houdry
  base_url: http://127.0.0.1:18080/v1
  default: auto
```

```bash
# ~/.houdry-agent/.env
OPENAI_API_KEY=houdry
```

Or:

```bash
./scripts/seed-houdry-fabric-config.sh
# (only writes config if missing — otherwise edit config.yaml manually)
```

Then:

```bash
# fabric must be up
houdry serve --listen 0.0.0.0:18080
houdry node join --server http://127.0.0.1:18080
hermes chat -q 'Reply with exactly: houdry-ok'
```

## Provider selection summary

| Goal | `model.provider` | Endpoint / model |
|------|------------------|------------------|
| Azure GPT-5.6 Luna | `azure` / `azure-foundry` | `AZURE_OPENAI_ENDPOINT` + deployment as `default` |
| Houdry fabric | `custom` / `houdry` | `http://host:18080/v1` + `default: auto` |

Env override when `model.provider` is unset: `HERMES_LLM_PROVIDER=azure|houdry`
(same as `HERMES_INFERENCE_PROVIDER`).

## Security

- Never commit API keys or paste them into git-tracked files.
- Prefer `.env` under `HERMES_HOME` (secrets only).
- Status/doctor output reports provider + endpoint host + whether a key is
  configured — never the key value.

## Architecture principle

**Agent logic ≠ model provider.** MRPL / product workflows should call Hermes
tools and sessions the same way whether inference is Azure (dev) or Houdry
(private deployment).

See also: [HOUDRY.md](HOUDRY.md), upstream
[Azure Foundry guide](../website/docs/guides/azure-foundry.md).

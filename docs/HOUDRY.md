# Houdry Agent ↔ Houdry fabric

## Architecture

```text
User laptop                         GPU hosts
─────────────                       ─────────
Houdry Agent Desktop                houdry serve :18080
  → POST /v1/chat/completions         → router / jobs
  → tools executed locally            → houdry node join
                                        → Ollama / model runtimes
```

## Default provider

Use OpenAI-compatible custom provider against the fabric:

| Setting | Value |
|---------|--------|
| `model.provider` | `custom` |
| `model.base_url` | `http://<fabric-host>:18080/v1` |
| `model.default` | `auto` (Houdry router) |
| API key | any non-empty string if required (e.g. `houdry`) |

**Desktop first-run / Settings:** choose **Houdry server URL** (recommended),
enter the fabric base URL (prefilled `http://127.0.0.1:18080/v1`), optional key
`houdry`. That maps to `model.base_url` + `provider: custom` + model `auto`.

CLI seed (same defaults without the UI):

```bash
./scripts/seed-houdry-fabric-config.sh
```

Template: [../config/houdry-fabric.defaults.yaml](../config/houdry-fabric.defaults.yaml)

## Data directory

Houdry Agent defaults to:

- Linux/macOS: `~/.houdry-agent`
- Windows: `%LOCALAPPDATA%\houdry-agent`

Override with `HERMES_HOME` (Hermes-compatible env name kept for upstream mergeability).

If a legacy Hermes `~/.hermes` exists and the Houdry path does not, Desktop may
reuse the legacy path once so migrations do not orphan sessions.

## Desktop packaging (release outline)

Reuse Hermes Desktop electron-builder scripts under `apps/desktop`:

```bash
cd apps/desktop
npm run dist:linux   # AppImage / deb / rpm
npm run dist:mac     # dmg / zip
npm run dist:win     # nsis / msi
```

Publish artifacts to **houdry-genomex/houdry-agent** GitHub Releases. Product
name / `appId` should be Houdry Agent (`com.houdry.agent`) — see
`apps/desktop/package.json`.

## Smoke checklist

1. Fabric: `houdry version` → 0.6.x; `houdry serve`; `houdry node join`.
2. Agent config: `base_url` → fabric `/v1`, model `auto`.
3. Desktop chat: simple prompt returns text.
4. Tool task: model returns `tool_calls` (fabric routes away from tinyllama when tools are present).
5. About / NOTICE still credit Nous Research Hermes Agent.

## Azure OpenAI (dev) vs fabric

For cloud GPT-5.6 Luna during development, use provider `azure` /
`AZURE_OPENAI_*` — see [AZURE_OPENAI.md](AZURE_OPENAI.md). That path does
**not** remove or replace this fabric integration; switch providers in
`config.yaml` / `.env` only.

MRPL agent layer (skills / knowledge / governance) is provider-independent:
[mrpl/ARCHITECTURE.md](mrpl/ARCHITECTURE.md), [mrpl/RUNNING.md](mrpl/RUNNING.md).

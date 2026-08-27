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

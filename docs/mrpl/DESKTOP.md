# Desktop alignment (Houdry Agent / MRPL)

Desktop is a **Codex-style chat** plus `/skill-name` slash commands. Structured
MRPL replies are markdown in the transcript — see [RESPONSE_FORMAT.md](./RESPONSE_FORMAT.md).
There is no separate mode launcher or workflow dashboard.

## Windows run

Default data dir: `%LOCALAPPDATA%\houdry-agent` (`HERMES_HOME`). Secrets go in
`%LOCALAPPDATA%\houdry-agent\.env` only (`AZURE_OPENAI_*` or `AZURE_FOUNDRY_API_KEY`).

```powershell
# From the repo root. Node 24+ (nvm use 24); PATH should list C:\nvm4w\nodejs first.
$env:HERMES_HOME = "$env:LOCALAPPDATA\houdry-agent"
py -3 scripts\seed_mrpl_desktop_home.py   # no-op if config.yaml already exists
npm install
cd apps\desktop
npm run dev
```

First Desktop launch also copies `config/mrpl-desktop.defaults.yaml` into
`HERMES_HOME\config.yaml` when that file is missing, and appends Azure
placeholders to `.env`. It never overwrites an existing `config.yaml`.

Then:

1. Settings → Providers → **Azure OpenAI** — set API key, endpoint, and
   deployment (`gpt-5.6-luna`). **Houdry GPU fabric** is the other path
   (custom `/v1` URL). Desktop does not list other Hermes vendors.
2. Footer “Gateway inference unavailable” should clear after a short
   `azure-ok` chat.
3. Empty-state wordmark is **HOUDRY AGENT**. Type `/document-analysis`
   (also `/procedure-lookup`, `/engineering-calculation`, `/report-generation`,
   `/knowledge-search`).

Desktop Settings, first-run onboarding, and the composer model menu list
**only two inference paths**: Azure OpenAI (DEV) and Houdry GPU fabric (PROD).
Other Hermes vendors remain in the Python catalog for CLI/gateway compatibility;
they are hidden from this app.

## Inference

| Env | Provider | Notes |
|-----|----------|--------|
| DEV | `azure` / `azure-foundry` | `model.default: gpt-5.6-luna`, `api_mode: chat_completions` |
| PROD | `custom` / `houdry` | `base_url` → fabric `/v1` — [../HOUDRY.md](../HOUDRY.md) |

Switching Azure ↔ Houdry is config-only. Do not edit MRPL skills.

## Governance (chat markdown, not widgets)

EXECUTE stays locked. MRPL acceptance facts come from local knowledge
(`/knowledge-search` / mounted docs), not web search. Skills already encode
the response contract; Desktop does not add a second chat UI.

## Air-gap proof (for the sovereign demo)

`Ctrl/Cmd+K` → **System** shows a live **Network activity** panel: every
outbound HTTP(S) request any Electron session in this process attempted,
classified **local** (loopback, private LAN, `.local`) or **external**
(everything else). It's a passive observer (`webRequest.onBeforeRequest`) —
it never blocks a request, only records it, so it can't hide a real call.

- On Houdry fabric inference (LAN `/v1`), the external bucket stays at 0 —
  that's the badge to show judges.
- On Azure inference (dev-only testing path), external calls to
  `*.openai.azure.com` show up here — expected, since Azure is a cloud
  provider. This is also how you *prove* Azure is fully removed once that
  cutover happens: the badge should read 0 external with no Azure entries.
- `Clear` resets the ring buffer (500-entry cap) right before a demo run.
- Implementation: `apps/desktop/electron/network-activity-log.ts` (pure,
  unit-tested classifier + ring buffer), wired in `main.ts` via
  `installNetworkActivityLogging()`.
- Not covered: raw Node `http`/`https` calls that don't ride an Electron
  session. The desktop's own backend transport (`api-transport.ts`) is one
  of these, but it only ever talks to the local Hermes backend on loopback,
  so it isn't a sovereignty gap.

## Out of scope here

Phase 7 Hermes pruning of the **development git tree**, SharePoint/ERP/QMS, a
custom MRPL launcher, replacing chat with a form wizard.

Plant users do **not** clone this repo. The Desktop installer / website download
runs `scripts/install.ps1` (or `install.sh`), which clones
`houdry-genomex/houdry-agent` and `uv sync --extra all`. On this fork `[all]`
is the thin `[mrpl]` extra (Azure + Houdry fabric + `hermes serve`) — not
Google / Home Assistant / SMS / ACP / YouTube / MCP. After clone, git
sparse-checkout drops `website/`, `tests/`, `optional-skills/`, `evals/`, and
unused plugins from the **install tree only**. Do not run that installer
against a development checkout.

A signed `.exe` store listing is still a separate packaging step; GitHub
Releases is the current download surface
([houdry-genomex/houdry-agent](https://github.com/houdry-genomex/houdry-agent/releases)).

# Layer 3 — Tool Classification

Inventory of Hermes tools relevant to MRPL. Classifications:

| Class | Meaning |
|-------|---------|
| **A** | Required for foundational MRPL skills |
| **B** | Potentially useful |
| **C** | Not required for MRPL profile (leave available) |
| **D** | Dangerous / requires approval |
| **E** | External integration needed later (MCP/plugin) |

## Classification table

| Tool / group | Class | Notes |
|--------------|-------|-------|
| `read_file`, `search_files` | A | Knowledge retrieval |
| `write_file`, `patch` | A/D | DRAFT local artifacts; approval for protected paths |
| `skills_list`, `skill_view` | A | Load MRPL skills |
| `skill_manage` | B/D | Prefer humans for production skill edits |
| `execute_code` | A/D | Calculations; approval gated |
| `terminal`, `process` | B/D | Prefer `execute_code` when enough; gate shell |
| `clarify` | A | Disambiguate intent before EXECUTE |
| `todo` | B | Multi-step work |
| `memory` | B | Preferences only — no secrets |
| `session_search` | B | Continuity / audit assist |
| `vision_analyze` | B | FUTURE drawings/scans — keep available |
| `web_search`, `web_extract` | B/C | Public info only; careful with Azure |
| `browser_*` | B | FUTURE intranet portals |
| `delegate_task` | B | Large parallel analysis |
| `cronjob` | C | FUTURE schedules |
| `image_generate`, TTS, HA, Spotify, Discord admin | C | DISABLE in MRPL profile |
| Kanban tools | C | FUTURE multi-agent |
| MCP tools (config) | E | SharePoint / ERP / QMS |
| Custom plugin tools | E | Site-specific |

## Extension points (do not implement fakes)

1. **MCP** — add servers under `mcp_servers:` in `$HERMES_HOME/config.yaml`.
2. **Plugins** — `~/.hermes/plugins/` or pip entry points; do not land third-party SaaS in-tree.
3. **CLI + skill** — shell/API workflows without new core tools.

## Suggested MRPL profile posture

See `config/mrpl-agent.defaults.yaml` — an **overlay template**, not auto-applied.
Prefer enabling: file, skills, code_execution, clarify, vision (optional).
Prefer disabling for default MRPL desktop: image_gen, spotify, homeassistant,
discord_admin noise via `hermes tools` / `platform_toolsets`.

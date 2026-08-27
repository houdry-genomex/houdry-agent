# Hermes Capability Matrix (MRPL)

Decision vocabulary:

| Decision | Meaning |
|----------|---------|
| **KEEP** | Needed for MRPL workflows or forked product ops |
| **OPTIONAL** | Useful in some MRPL contexts; leave available, may disable per profile |
| **DISABLE** | Prefer off by default for MRPL profile via config (not code deletion) |
| **FUTURE** | Legitimate later use; do not remove |
| **REMOVE** | Only after Phase 7 verification — **none yet** |

Do **not** delete code based on this table alone. Prefer `platform_toolsets`,
`skills.disabled`, and `approvals.*` first.

| Capability | Current Hermes implementation | MRPL relevance | Decision | Reason |
|------------|------------------------------|----------------|----------|--------|
| Agent loop | `run_agent.py` `AIAgent.run_conversation` | Core orchestration | KEEP | Required for all MRPL turns |
| Tool calling | `model_tools.py` + `tools/registry.py` | Skill execution surface | KEEP | Skills invoke tools |
| Skills system | `skills/` + `skill_view` / slash | MRPL procedures live here | KEEP | Primary extension point |
| File tools | `read_file`, `write_file`, `patch`, `search_files` | Knowledge + drafts | KEEP | Layer 1 + DRAFT |
| Terminal | `terminal`, `process` | Calcs, scripts, ops | OPTIONAL | ANALYZE/EXECUTE; gate heavily |
| Code execution | `execute_code` | Engineering calc | KEEP | Prefer over ad-hoc shell when possible; still approval-gated |
| Browser | `browser_*` | Portals / intranet UIs | FUTURE | Possible QMS/web UIs; do not remove |
| Web search / extract | `web_search`, `web_extract` | Public standards only | OPTIONAL | Risky for sensitive data on Azure; disable in private profiles if needed |
| Vision | `vision_analyze` | Drawings, scans, labels | FUTURE | Explicit MRPL inspection use cases |
| Image generation | `image_generate` | Rare for MRPL | DISABLE | Not core to engineering workflow |
| Memory | `memory` + optional providers | Session continuity | OPTIONAL | Useful; no secrets in memory |
| Sessions / FTS | `session_search`, SQLite | Audit / continuity | KEEP | Auditability |
| Cron / scheduled jobs | `cronjob` | Recurring reviews | FUTURE | Useful later; not Phase 1 |
| Delegation / subagents | `delegate_task` | Parallel analysis | OPTIONAL | Useful for large reviews |
| MCP | `mcp_servers:` + `tools/mcp_tool.py` | SharePoint/ERP/QMS | FUTURE | Preferred integration path |
| Plugins | `~/.hermes/plugins/`, `hermes_cli/plugins.py` | Custom tools | FUTURE | External product integrations stay out of core |
| Approvals | `tools/approval.py`, `approvals.*` | Governance | KEEP | Human-in-the-loop |
| Security / Tirith | `security.*` | Hardening | KEEP | Least privilege |
| Messaging (Telegram, etc.) | `gateway/platforms/` | Ops notification | OPTIONAL | Not required for Desktop MRPL |
| Desktop UI | `apps/desktop/` | Primary UX | KEEP | Product surface |
| CLI / TUI | `cli.py`, `ui-tui/` | Dev / ops | KEEP | Smoke tests, scripts |
| Kanban | `plugins/kanban/`, `kanban_*` | Multi-agent boards | FUTURE | Optional orchestration |
| Home Assistant / Spotify / Discord admin | gated toolsets | Unrelated | DISABLE | No MRPL relevance; leave code, disable in profile |
| Azure provider | `azure-foundry` plugin | Dev inference | KEEP | Must not break |
| Houdry / custom provider | `custom` + houdry aliases | Private inference | KEEP | Must not remove |
| Core RAG / vector DB | None in core | Not required yet | — | Do not add until file/search proven insufficient |

## Pruning rule (Phase 7)

For each REMOVE candidate: document lost functionality, confirm no MRPL skill
depends on it, disable via config, then consider deletion only if maintenance
cost justifies it.

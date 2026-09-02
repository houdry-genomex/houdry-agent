# Layer 1 — Knowledge

## Goal

Provide a clean place to add MRPL knowledge sources later **without inventing
documents, SOPs, or a vector database**.

## Boundary

```text
Knowledge source (files you add later)
      ↓
Retrieval / access (Hermes file tools + skill references)
      ↓
Hermes context (read into the turn)
      ↓
MRPL skill
```

## What Hermes already provides (use first)

| Mechanism | Path / tool | Role |
|-----------|-------------|------|
| Local files | `read_file`, `search_files` | Primary document access |
| Working directory | CLI `cwd` / `terminal.cwd` | Point agent at a knowledge tree |
| Skill references | `skills/mrpl/*/references/` | Procedure snippets shipped with a skill |
| External skill dirs | `skills.external_dirs` | Mount shared skill packages |
| Project context | `AGENTS.md` in workspace | Always-on site rules (cache-aware) |
| Identity | `$HERMES_HOME/SOUL.md` | Agent posture (not SOPs) |
| Session FTS | `session_search` | Prior work recall — not document RAG |
| Memory | `memory` tool / providers | User preferences — not controlled docs |

**No core vector RAG.** Add MCP or a standalone plugin later only if file search
is proven insufficient.

## Repository scaffold

```text
knowledge/mrpl/
  README.md                 # this mount contract
  AGENTS.md.template        # copy into a live workspace as AGENTS.md
  sources/                  # place real docs here (gitignored content OK)
    sops/.gitkeep
    manuals/.gitkeep
    engineering/.gitkeep
    safety/.gitkeep
    standards/.gitkeep
    policies/.gitkeep
    reports/.gitkeep
    equipment/.gitkeep
    forms/.gitkeep
  INDEX.md.template         # optional catalog when real docs exist
```

Do **not** commit proprietary MRPL content to the public/private repo unless
explicitly approved. The folders are empty placeholders.

## Desktop Knowledge base

Houdry Agent Desktop has a **Knowledge base** item in the left sidebar.

- Files are copied into `$HERMES_HOME/knowledge/mrpl/sources/<category>/`.
- Standing rules next to each SOP are written into `knowledge/mrpl/AGENTS.md`
  and a marked section of `$HERMES_HOME/AGENTS.md` so new sessions load them.
- The agent searches this tree with `search_files` / `read_file`. There is no
  vector database and nothing is uploaded.

Drop files in Explorer via **Open folder**, or use **Add files** / **Add note**.

## Recommended mount for a live site

1. Copy or bind-mount real documents under `knowledge/mrpl/sources/` (or any path).
2. Set the agent working directory to that tree (`cd` for CLI; `terminal.cwd` for gateway).
3. Optionally copy `AGENTS.md.template` → workspace `AGENTS.md`.
4. Use `/procedure-lookup` or `skill_view("procedure-lookup")` then `search_files` / `read_file`.

## Future sources (extension points only)

| Source | Access pattern | Status |
|--------|----------------|--------|
| SharePoint | MCP server via `mcp_servers:` | FUTURE — no fake client |
| ERP / QMS | MCP or standalone plugin | FUTURE |
| Internal APIs | MCP / plugin tools | FUTURE |
| Vector search | Standalone memory plugin or MCP | Only if needed |

## Sensitive data (Azure vs Houdry)

During Azure development, treat knowledge mounts as potentially leaving the
premises with the prompt. Prefer redacted samples for cloud testing. Point
production inference at Houdry when proprietary corpora are in play — without
claiming either path is a complete security control by itself (see governance).

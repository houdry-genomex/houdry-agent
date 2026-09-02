---
name: knowledge-search
description: Search the local MRPL knowledge mount only, no web.
version: 0.1.0
author: Houdry Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mrpl, knowledge, search, local, offline]
    category: mrpl
    related_skills: [procedure-lookup, document-analysis]
---

# Knowledge Search Skill (local-only)

## Responsibility

Search the **local knowledge mount** (`$HERMES_HOME/knowledge/mrpl/`, also
the Knowledge base sidebar) for manuals, SOPs, and past correspondence, using
only local file tools.

**Does not:** call `web_search` / `web_extract` / any external API to answer
MRPL knowledge questions. **Does not** invent results when nothing matches.

## When to Use

- Grounding an answer in the organization's own documents
- Before `document-analysis` / `procedure-lookup` when you don't yet know which
  file is relevant
- Not for: general web knowledge, public standards lookup (that's `web_search`,
  a separate OPTIONAL tool with its own governance), or ERP/QMS live queries
  (future MCP work)

## Prerequisites

- `search_files`, `read_file`
- Working directory or `skills.external_dirs` pointed at the real mount
  (`$HERMES_HOME/knowledge/mrpl` — see `docs/mrpl/KNOWLEDGE.md`). Standing rules
  added in the Desktop Knowledge base are written into `$HERMES_HOME/AGENTS.md`.

## Inputs

- Search terms (equipment id, topic, document type, date range hint)
- Optional file-type filter (pdf, docx, xlsx, md, txt)

## Expected outputs

- List of matching file paths with a one-line reason each matched
- If nothing found: explicit "no local matches for `<terms>`" — do not fall
  back to the web or invented content
- Note when a match required OCR/vision (scanned/no text layer)

## Required tools

- `search_files` (primary — supports content and filename patterns)
- `read_file` to confirm/quote a candidate
- `vision_analyze` / `ocr-and-documents` skill only for scanned/no-text-layer
  candidates, and only after a filename/metadata match already narrowed it down

## Procedure

1. Restate the search intent; ask via `clarify` if it's ambiguous which
   equipment/topic/timeframe is meant.
2. `search_files` over the knowledge mount (content + path patterns). Try a few
   keyword variants (equipment id, synonyms) before giving up.
3. For strong candidates, `read_file` to confirm relevance and extract the
   exact section.
4. If a candidate has no extractable text (scan/photo), say so and offer OCR/
   vision as a next step rather than silently skipping it.
5. Report matches with path + section + one-line relevance note, or report
   "no local matches" plainly.
6. Never substitute a web result for a missing local document.

## Validation

- Zero calls to `web_search` / `web_extract` in this skill's own execution
- Every returned "fact" traceable to a specific local path
- "No matches" is a valid, expected outcome — not a failure to paper over

## Safety / approval

- **READ** tier only
- Local files may be sensitive — do not summarize proprietary content into
  external tool calls (e.g. don't paste file contents into a web search query)

## Response format

Follow `docs/mrpl/RESPONSE_FORMAT.md` for provenance citations and the
governance banner (this skill stays at **READ** tier).

## Limitations

- No cross-document ranking/relevance scoring beyond `search_files` matching —
  this is deliberately not a vector/semantic search (see `docs/mrpl/KNOWLEDGE.md`)
  unless a later phase proves keyword/file search insufficient
- Empty knowledge mount means empty results until the site adds real documents

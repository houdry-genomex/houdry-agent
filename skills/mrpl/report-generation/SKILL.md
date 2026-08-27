---
name: report-generation
description: Draft structured review memos from verified findings.
version: 0.2.0
author: Houdry Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mrpl, report, draft]
    category: mrpl
    related_skills:
      [document-analysis, procedure-lookup, engineering-calculation]
---

# Report Generation Skill

## Responsibility

Turn **already verified** findings into a structured **DRAFT** report or review
summary for human review.

**Does not:** re-extract source documents from scratch (`document-analysis`),
fetch SOPs (`procedure-lookup`), or re-do arithmetic (`engineering-calculation`).
**Does not** publish, email, or write to ERP/QMS (**EXECUTE** is out of scope).

## When to Use

- User wants a concise review summary / memo after analysis
- MVP closing step after Extract → Calculate → Check → Explain
- Not for: marking documents approved or filing controlled records

## Prerequisites

- FACT / CALCULATION / INTERPRETATION / ASSUMPTION material available from prior steps
- Optional `write_file` only if the user asks to save a draft path

## Inputs

- Verified findings (tags requiring attention, citations)
- Audience (default: technical reviewer)
- Source path(s)

## Expected outputs

Markdown DRAFT including:

1. Header: `DRAFT — not approved` + governance ceiling **DRAFT**
2. Scope
3. **FACT** — observed data (cited)
4. **CALCULATION** — summary of tool-verified math
5. **INTERPRETATION** — attention vs document-local rules only
6. **ASSUMPTION** — list or “none”
7. Concise review summary
8. Explicit: no EXECUTE performed

## Required tools

- Prior skill outputs in-session
- `write_file` only on user request for a local draft path
- Real deliverables (prefer these over markdown-only replies when the user
  wants an actual document): `docx` skill for Word memos/approval notes,
  `xlsx` skill for calculation workbooks, `powerpoint` skill for decks
- `execute_code` when the deliverable includes working code / a calc script

## Real deliverables, not just chat text

If the user wants a document, spreadsheet, or deck (not just a chat answer):

1. Load the matching productivity skill (`skill_view("docx")`, `("xlsx")`, or
   `("powerpoint")`) and follow its procedure to produce the actual file.
2. State the saved file path in the reply.
3. The governance ceiling is still **DRAFT** — producing a local file is not
   an EXECUTE action (no email, no ERP/QMS submission, no publishing).

## Procedure

1. Confirm this is a DRAFT, not an approved record.
2. Assemble labeled sections; do not add new limits.
3. Keep recommendations clearly marked as interpretation, not FACT.
4. Refuse EXECUTE requests; ask for human approval + future integration.

## Validation

- No uncited normative claims
- Header includes draft banner
- Does not claim Azure or Houdry — provider-agnostic

## Safety / approval

- **DRAFT** tier
- Saving a local draft file is still not EXECUTE against external systems

## Response format

Follow `docs/mrpl/RESPONSE_FORMAT.md` for the governance banner and labeled
sections, even when the primary output is a saved file rather than markdown.

## Limitations

- Site-specific templates belong in knowledge mounts, not this skill
- Native Office generation quality depends on the underlying productivity
  skill (docx/xlsx/powerpoint) — read that skill's own limitations first

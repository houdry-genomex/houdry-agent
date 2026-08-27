---
name: procedure-lookup
description: Retrieve and cite mounted procedure documents.
version: 0.2.0
author: Houdry Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mrpl, sop, procedures, lookup]
    category: mrpl
    related_skills: [document-analysis, report-generation]
---

# Procedure / SOP Lookup Skill

## Responsibility

**Retrieve** applicable documented procedures from the knowledge mount and
**cite** them. Pure **READ** retrieval.

**Does not:** analyze arbitrary technical reports (`document-analysis`), perform
calculations (`engineering-calculation`), or draft memos (`report-generation`).
**Does not invent** SOPs when none are found.

## When to Use

- User asks what a mounted procedure / manual says about a topic
- Need a cited excerpt before analysis or drafting
- Not for: the Phase 5 MVP fixture (that fixture is a synthetic **report**, not an SOP)

## Prerequisites

- Files under the knowledge workspace (`knowledge/mrpl/sources/` when populated)
- `search_files` / `read_file`

## Inputs

- Topic, equipment id, or title fragment
- Optional doc type hint (sop, safety, manual, standard)

## Expected outputs

- Paths found (or explicit not-found)
- Cited excerpts with section refs (**FACT** from documents)
- No INTERPRETATION beyond “document says X”

## Required tools

- `search_files`, `read_file`, `clarify`

## Procedure

1. Clarify ambiguous topics.
2. Search the mount; open matches.
3. Quote/cite only; if missing, report searches tried — **do not invent**.

## Validation

- Every procedural claim has a file citation
- Separate “document says” from any user-requested recommendation (hand off)

## Safety / approval

- **READ** tier
- No EXECUTE

## Response format

Follow `docs/mrpl/RESPONSE_FORMAT.md` for provenance citations and the
governance banner.

## Limitations

- Scaffold may be empty until the site adds real documents
- No SharePoint/ERP until MCP exists
- Prefer `knowledge-search` first when the exact file isn't already known

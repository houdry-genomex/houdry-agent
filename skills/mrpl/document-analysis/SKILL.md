---
name: document-analysis
description: Inspect docs and extract cited facts only.
version: 0.2.0
author: Houdry Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mrpl, documents, analysis, extract]
    category: mrpl
    related_skills:
      [procedure-lookup, engineering-calculation, report-generation]
---

# Document Analysis Skill

## Responsibility

**Inspect and extract** information from a supplied or mounted document.
Own the Extract step and coordinate Verify labeling. Do **not** invent limits.

**Does not:** look up SOPs (`procedure-lookup`), own arithmetic
(`engineering-calculation`), or format the final DRAFT memo (`report-generation`).

## When to Use

- User asks to analyze, extract, or review a technical report / document
- MVP: “Analyze this technical report… identify abnormal values…” when thresholds
  are **inside the same document**
- Not for: inventing MRPL policy, EXECUTE actions, or SharePoint/ERP access

## Prerequisites

- Readable path via `read_file` / `search_files`
- For the synthetic MVP fixture: `tests/fixtures/mrpl/sample_technical_report.md`
  (and optional JSON twin for deterministic checks)

## Inputs

- Document path
- Optional focus question

## Expected outputs

Labeled sections:

| Label | Meaning |
|-------|---------|
| **FACT** | Values / text quoted or paraphrased from the document with path+section |
| **CALCULATION** | Deferred to `engineering-calculation` / deterministic code — summarize results only |
| **INTERPRETATION** | Comparison against **document-stated** rules only |
| **ASSUMPTION** | Anything not in the document (keep empty or explicit) |

## Required tools

- `read_file`, `search_files`
- `skill_view` for sibling MRPL skills
- Hand off numeric work: `engineering-calculation` + `execute_code` or
  `scripts/verify_report_thresholds.py`
- Hand off write-up: `report-generation`
- Multimodal fallback: `vision_analyze` and the `ocr-and-documents` skill (see below)
- Grounding: `knowledge-search` when the exact document isn't already known

## Multimodal input (scans, handwriting, drawings, photos)

`read_file` reports which PDF pages had no extractable text layer. When that
happens, or the input is a photo/scan/drawing from the start:

1. For bulk/complex scans (many pages, tables, equations): use the
   `ocr-and-documents` skill (marker-pdf).
2. For a handful of pages, a single photo, a handwritten note, or an
   engineering drawing: render/attach the image and use `vision_analyze`.
3. Always state the extraction method in the response's provenance line —
   e.g. "vision-extracted from a photo, not machine text" — since this affects
   how much a human should trust the transcription.
4. Never silently skip pages that failed text extraction.

## MVP workflow (stops at DRAFT)

```text
Extract (this skill + read_file)
  → Calculate (engineering-calculation / verify script)
  → Check (compare to document-local thresholds only)
  → Explain (findings)
  → Draft (report-generation)
  → STOP (no EXECUTE)
```

## Procedure

1. Confirm the path; `read_file` the document.
2. Extract measured values and any **attention rules printed in the document**.
3. If arithmetic is needed, follow `engineering-calculation` (deterministic code).
   For the MVP JSON twin, you may run:
   `python scripts/verify_report_thresholds.py <path-to-sample_measurements.json>`
   from this skill directory (or pass an absolute fixture path).
4. Check each tag only against rules found in the document / twin JSON.
5. Explain which tags require attention and why (cite the rule text).
6. Ask `report-generation` to produce the concise DRAFT review summary.
7. Refuse EXECUTE (email, ERP, QMS, shell mutations). Governance ceiling: **DRAFT**.

## Validation

- No threshold used unless cited from the document
- Calculations shown via tool/script output, not silent mental math
- Final user-facing memo marked `DRAFT — not approved`

## Safety / approval

- **READ** while opening files; **ANALYZE** while checking; **DRAFT** for the memo
- **EXECUTE** requires human approval and is out of scope for this MVP

## Response format

Follow `docs/mrpl/RESPONSE_FORMAT.md` — workflow state, provenance per fact,
governance banner, and labeled FACT/CALCULATION/INTERPRETATION/ASSUMPTION
sections in every reply.

## Limitations

- Empty or missing docs → stop; do not invent SOPs or limits
- Fixture thresholds are fictional and document-local only
- Vision-based extraction is lower-confidence than native text — say so

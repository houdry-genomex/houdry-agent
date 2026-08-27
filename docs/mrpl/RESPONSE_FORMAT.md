# MRPL Response Contract

Every MRPL skill response follows this shape **as plain text/markdown in the
normal chat reply** — no bespoke UI component required. It renders identically
in CLI, TUI, and Desktop chat because it is just structured text the model
writes, not a custom rendering surface.

This is a **content contract**, not a core Hermes change.

## 1. Workflow state block

Show which pipeline stages are done and which is current:

```text
WORKFLOW
✓ Read       — document(s) opened
✓ Extract    — values/text pulled
✓ Analyze    — calculations run (tool-verified)
✓ Verify     — cross-checked against document-local rules
→ Interpret  — current stage
  Draft      — pending
  Approval   — pending (EXECUTE stays locked)
```

Only mark a stage `✓` after the corresponding tool call actually happened in
this turn (`read_file`, `execute_code`/script, etc.). Never mark a stage done
because it "should" have happened.

## 2. Findings block (when applicable)

```text
FINDINGS
⚠ TT-101 — 92 °C exceeds documented threshold (80 °C)
⚠ VT-201 — 4.2 mm/s exceeds documented threshold (3.5 mm/s)
✓ PT-301 — within documented band (0.9–1.3 bar)
✓ FT-401 — within documented rule (|Δ%| ≤ 5%)
```

## 3. Provenance — mandatory per fact/threshold

Every extracted value or rule states its source. If a rule is not present in
any supplied/mounted document, say so explicitly — **never infer or invent
one**:

```text
TT-101: 92 °C
  Source: sample_technical_report.md, §2 Measured values

Threshold: 80 °C
  Source: sample_technical_report.md, §3 Attention thresholds
```

```text
⚠ No documented threshold found for <parameter>.
I will not infer or invent an MRPL acceptance limit.
```

## 4. Labeled content types

Always distinguish, using these exact labels:

| Label | Meaning |
|-------|---------|
| **FACT** | Directly observed / quoted from a source, with citation |
| **CALCULATION** | Deterministic tool/code output (show the tool ran) |
| **VERIFICATION** | Independent re-check of a calculation or comparison |
| **INTERPRETATION** | Judgment applying document-local rules to facts/calcs |
| **ASSUMPTION** | Anything not directly sourced — keep to "none" when possible |
| **RECOMMENDATION** | Suggested next step — always non-binding, human decides |

## 5. Governance banner — required on every MRPL skill response

```text
ACCESS LEVEL
READ      ✓
ANALYZE   ✓
DRAFT     ✓
EXECUTE   🔒 (locked — human approval + integration required)
```

If the user asks for an EXECUTE-tier action (send/submit/file/transmit/modify
an external system), respond with the pattern:

```text
EXECUTE is currently restricted.

I have prepared <artifact>. Human approval is required before <action>.
```

Never silently perform the action, and never just say "I can't do that" without
naming what was prepared and what approval is missing.

## 6. Deliverables, not just chat text

When the task calls for a real artifact, produce the actual file using the
existing productivity skills — do not paste a Word/Excel/PPT-shaped answer as
plain markdown:

| Deliverable | Skill to invoke |
|-------------|------------------|
| Word document / approval note / memo | `docx` |
| Spreadsheet / calculation workbook | `xlsx` |
| Slide deck | `powerpoint` |
| Working code / calculation script | `execute_code` (save via `write_file` if it should persist) |

State the output file path in the response and keep the governance banner —
saving a local file is still **DRAFT**, not EXECUTE.

## 7. Multimodal input

If the source is a scan, photo, handwritten note, or engineering drawing (not
a clean text layer), say so and route to OCR/vision before extracting facts:

- `read_file` first — it reports which pages have no text layer.
- Scanned/complex documents → `ocr-and-documents` skill (marker-pdf) or
  `vision_analyze` on rendered pages/photos.
- Cite the extraction method used (e.g. "vision-extracted from photo, not
  original document text") as part of provenance — this is itself a fact
  about the fact's reliability.

## 8. Grounding — local only

Facts and thresholds should come from the local knowledge mount
(`knowledge/mrpl/`) or files the user explicitly supplies — see
[KNOWLEDGE.md](KNOWLEDGE.md) and the `knowledge-search` skill. Do not use
`web_search` / `web_extract` to fill in MRPL facts, thresholds, or procedures;
those tools remain OPTIONAL/general-purpose only, per the capability matrix.

# MRPL Agent Workflow (provider-independent)

```text
USER REQUEST
    ↓
Intent understanding
    ↓
Select MRPL skill
    ↓
Retrieve relevant document/knowledge     (READ)
    ↓
Extract information
    ↓
Analyze / calculate                      (ANALYZE — deterministic code)
    ↓
Verify (Check)                           (document-local rules only)
    ↓
Generate result                          (DRAFT via report-generation)
    ↓
Human approval if required               (before any EXECUTE)
    ↓
Final response / controlled action
```

## Verification pattern

```text
Extract → Calculate → Check → Explain
```

Label every claim as **FACT**, **CALCULATION**, **INTERPRETATION**, or
**ASSUMPTION**. Prefer `execute_code` / skill scripts over mental arithmetic.

## Skill responsibilities (non-overlapping)

| Skill | Owns |
|-------|------|
| `document-analysis` | Inspect + extract; orchestrate MVP labeling |
| `procedure-lookup` | Retrieve/cite mounted procedures (READ) |
| `engineering-calculation` | Deterministic Calculate + Check |
| `report-generation` | DRAFT memo from verified findings |

## Phase 5 MVP

Document-analysis end-to-end against a **synthetic** fixture (stops at DRAFT):

→ full detail in [MVP_DOCUMENT_ANALYSIS.md](MVP_DOCUMENT_ANALYSIS.md)

Provider switch remains config-only (Azure Luna now; Houdry later).

## Interface decision: Codex-style chat, not a bespoke launcher

MRPL is invoked through **normal Hermes chat** plus **slash commands** for the
named skills (`/document-analysis`, `/procedure-lookup`,
`/engineering-calculation`, `/report-generation`, `/knowledge-search`) —
Hermes already turns any `SKILL.md` into a slash command automatically
(`agent/skill_commands.py`). No new Electron/React launcher screen was built;
this keeps CLI, TUI, and Desktop behavior identical with zero core/UI changes.

Every MRPL skill reply follows the shared
[RESPONSE_FORMAT.md](RESPONSE_FORMAT.md) contract (workflow state, findings,
provenance, governance banner, labeled FACT/CALCULATION/VERIFICATION/
INTERPRETATION/ASSUMPTION/RECOMMENDATION) as plain structured text — this is
what makes the agent's reasoning auditable without a custom UI or exposing
chain-of-thought.

Real work, not just chat replies:

- Multi-step iteration is the existing Hermes agent loop (`max_iterations`) —
  no change needed.
- Deliverables use existing productivity skills (`docx`, `xlsx`, `powerpoint`)
  and `execute_code`, not markdown-shaped text.
- Multimodal input (scans, handwriting, drawings, photos) routes through
  `vision_analyze` / `ocr-and-documents`.
- Local-only grounding uses the new `knowledge-search` skill — no web calls
  for MRPL facts/thresholds/procedures.

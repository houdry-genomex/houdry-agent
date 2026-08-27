# Phase 5 — Document Analysis MVP Workflow

Provider-independent workflow proving:

**document → extract → calculate → check → explain → DRAFT**

on top of Hermes, without Hermes core changes and without Azure/Houdry coupling.

## Workflow architecture

```text
USER REQUEST
    ↓
Intent understanding          (clarify if needed)
    ↓
Select MRPL skills            (document-analysis → engineering-calculation → report-generation)
    ↓
READ — retrieve document      (read_file)
    ↓
EXTRACT — measured values + document-local thresholds
    ↓
ANALYZE — Calculate           (execute_code / verify_report_thresholds.py)
    ↓
ANALYZE — Check               (compare only to thresholds in the document)
    ↓
Explain                       (INTERPRETATION labeled)
    ↓
DRAFT — review summary        (report-generation)
    ↓
STOP                          (no EXECUTE)
```

`procedure-lookup` is **not** required for this MVP (fixture is a report, not an SOP).

## Skills involved

| Skill | Role in MVP |
|-------|-------------|
| `document-analysis` | Orchestrate extract + labeling; refuse invented limits |
| `engineering-calculation` | Deterministic math + check |
| `report-generation` | DRAFT memo |
| `procedure-lookup` | Unused in MVP (available for later READ of real SOPs) |

## Tools involved

| Tool / script | Governance | Use |
|---------------|------------|-----|
| `read_file` | READ | Open fixture / user document |
| `search_files` | READ | Locate paths |
| `skill_view` | READ | Load skill procedures |
| `execute_code` or `verify_report_thresholds.py` | ANALYZE | Deterministic calc/check |
| `write_file` | DRAFT | Optional local draft save |
| External ERP/QMS/email | EXECUTE | **Not implemented** |

## Governance decisions

| Tier | MVP behavior |
|------|----------------|
| READ | Allowed — read fixture |
| ANALYZE | Allowed — code-backed checks |
| DRAFT | Allowed — review summary |
| EXECUTE | **Out of scope** — refuse |

## Test fixture

| File | Purpose |
|------|---------|
| `tests/fixtures/mrpl/sample_technical_report.md` | Fictional report with embedded thresholds |
| `tests/fixtures/mrpl/sample_measurements.json` | Structured twin for deterministic verifier |

**Expected attention tags:** `TT-101`, `VT-201`  
**Expected OK tags:** `PT-301`, `FT-401`

## Example user request

```text
Analyze tests/fixtures/mrpl/sample_technical_report.md.
Identify abnormal values using ONLY the attention thresholds written in that
document, explain why they may require attention, and produce a concise DRAFT
review summary. Do not invent MRPL policy. Do not execute external actions.
```

## Example agent workflow

1. `skill_view("document-analysis")`
2. `read_file` on the markdown fixture
3. Extract Section 2 measurements + Section 3 thresholds (**FACT**)
4. `skill_view("engineering-calculation")` then run
   `verify_report_thresholds.py` on the JSON twin (or equivalent `execute_code`)
5. Confirm attention tags match tool output (**CALCULATION** + **CHECK**)
6. `skill_view("report-generation")` → DRAFT memo with labeled sections
7. Stop — no EXECUTE

## Example final output (shape)

```markdown
# DRAFT — not approved
Governance ceiling: DRAFT

## FACT
- TT-101 measured 92 °C (source: sample_technical_report.md §2)
- …

## CALCULATION
- FT-401 percent_deviation = (48-50)/50*100 = -4% (tool-verified)

## INTERPRETATION
- TT-101 requires attention: 92 > 80 (document §3)
- VT-201 requires attention: 4.2 > 3.5 (document §3)
- PT-301, FT-401 within document rules

## ASSUMPTION
- none (thresholds taken only from the fixture)

## Concise review summary
Two tags (TT-101, VT-201) exceed document-local attention rules; others do not.
No external action taken.
```

## Provider independence

```text
MRPL workflow (skills + fixture + tools)
        ↓
   Hermes core
        ↓
  model.provider = azure     (dev — GPT-5.6 Luna)
   — or later —
  model.provider = custom/houdry  (private fabric)
```

Skills and the verifier script contain **no** Azure/Houdry branches.
Switching providers is config-only (`docs/AZURE_OPENAI.md`, `docs/HOUDRY.md`).

## What this does not include

SharePoint, ERP, QMS, databases, vector RAG, autonomous EXECUTE, messaging.

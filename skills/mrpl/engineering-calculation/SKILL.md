---
name: engineering-calculation
description: Run deterministic engineering calculations in code.
version: 0.2.0
author: Houdry Agent
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [mrpl, calculation, engineering, verify]
    category: mrpl
    related_skills: [document-analysis, report-generation]
---

# Engineering Calculation Skill

## Responsibility

Perform **deterministic calculations** with `execute_code` (or an approved script).
Own the **Calculate** and independent **Check** arithmetic steps.

**Does not:** extract document narrative (`document-analysis`), fetch SOPs
(`procedure-lookup`), or write the DRAFT memo (`report-generation`).
**Does not** invent formulas or limits — they must come from the user or a cited document.

## When to Use

- Percent deviation, unit conversion, threshold comparisons with numeric rules
- MVP: verify fixture measurements against document-local rules via code
- Not for: mental-only arithmetic when a tool can run the same steps

## Prerequisites

- `execute_code` available (respect Hermes approvals)
- Formula + inputs cited (**FACT** sources)

## Inputs

- Measured / nominal values with units
- Formula text and attention rule (from document)
- Optional path to `sample_measurements.json` for the MVP verifier script

## Expected outputs

| Label | Content |
|-------|---------|
| **FACT** | Echo of inputs and cited formula/rule |
| **CALCULATION** | Script/`execute_code` stdout (intermediates) |
| **INTERPRETATION** | Pass/fail vs the cited numeric rule only |
| **ASSUMPTION** | Explicit if any (prefer none) |

## Required tools

- `execute_code` (preferred)
- Optional: `document-analysis` script
  `skills/mrpl/document-analysis/scripts/verify_report_thresholds.py`
- `clarify` if inputs incomplete

## Procedure

1. Restate inputs and the cited formula/rule.
2. Run the calculation in code (print steps).
3. Re-check the comparison in the same run (Extract → Calculate → Check).
4. Return structured results for `document-analysis` / `report-generation`.
5. Do not soft-approve plant action — ceiling remains **ANALYZE** here.

## Validation

- Tool output is the source of numeric truth in the reply
- If approval blocks code execution, stop and report the block

## Safety / approval

- **ANALYZE** tier; honor approval prompts
- No EXECUTE / no external system writes

## Response format

Follow `docs/mrpl/RESPONSE_FORMAT.md` — show CALCULATION as real tool/code
output, then a separate VERIFICATION step re-checking it, not one merged claim.

## Limitations

- Not certified calculation software; humans verify before operational use

# Sample Technical Report — FICTIONAL TEST FIXTURE

> **NOTICE:** This document is **synthetic**. It is **not** an MRPL SOP, standard,
> safety procedure, or plant record. All equipment IDs, measurements, and
> thresholds are **fictional** and exist only to exercise the MRPL document-analysis
> workflow in automated tests and development.

| Field | Value |
|-------|-------|
| Document ID | FIX-MRPL-TR-0001 |
| Title | Weekly condition snapshot — Unit X-100 (fictional) |
| Date | 2026-08-20 |
| Classification | TEST FIXTURE ONLY |
| Author | Synthetic Fixture Generator |

## 1. Scope

This fixture lists measured values for fictional equipment **Unit X-100** and the
**attention thresholds printed in this same document**. Reviewers must use **only**
these document-local thresholds. Do not apply external MRPL policies, codes, or
remembered industry limits.

## 2. Measured values (FACT)

| Tag | Description | Measured | Unit | Nominal |
|-----|-------------|----------|------|---------|
| TT-101 | Bearing temperature | 92 | °C | 70 |
| VT-201 | Housing vibration (RMS) | 4.2 | mm/s | 2.0 |
| PT-301 | Discharge pressure | 1.1 | bar | 1.1 |
| FT-401 | Process flow | 48 | m³/h | 50 |

## 3. Attention thresholds (FACT — document-local only)

These thresholds are **defined by this fixture** for workflow testing. They are
**not** plant acceptance criteria.

| Tag | Attention rule (as written in this fixture) |
|-----|-----------------------------------------------|
| TT-101 | Require attention if measured **> 80** °C |
| VT-201 | Require attention if measured **> 3.5** mm/s |
| PT-301 | Require attention if measured **outside 0.9–1.3** bar (inclusive bounds) |
| FT-401 | Require attention if absolute percent deviation from nominal **> 5%** |

### 3.1 Percent deviation formula (FACT — document-local)

For FT-401 only, this fixture defines:

```text
percent_deviation = (measured - nominal) / nominal * 100
```

Use the absolute value `|percent_deviation|` when comparing to the 5% attention rule.

## 4. Notes for the agent (workflow contract)

1. Treat Section 2 as **FACT** (observed data).
2. Any arithmetic (including percent deviation) is a **CALCULATION** — prefer
   deterministic code (`execute_code` or the skill script), not mental math.
3. Comparing a calculation or measured value to Section 3 rules is still grounded
   in document facts; labeling a tag as “requires attention” is an
   **INTERPRETATION** of those rules.
4. Do **not** invent additional limits, SOPs, or safety policies.
5. Stop at **DRAFT** review summary. Do not EXECUTE external actions.

## 5. Expected deterministic outcomes (for tests)

Given Sections 2–3 only:

| Tag | Outcome |
|-----|---------|
| TT-101 | Requires attention (92 > 80) |
| VT-201 | Requires attention (4.2 > 3.5) |
| PT-301 | Within document band (0.9 ≤ 1.1 ≤ 1.3) |
| FT-401 | Within document rule (\|−4%\| ≤ 5%) |

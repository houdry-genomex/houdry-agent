# Files intended to change / add (Phase 1–5 + response-contract pass)

## Phase 5 additions

| Path | Purpose |
|------|---------|
| `docs/mrpl/MVP_DOCUMENT_ANALYSIS.md` | End-to-end MVP workflow |
| `tests/fixtures/mrpl/*` | Synthetic report + JSON twin |
| `skills/mrpl/document-analysis/scripts/verify_report_thresholds.py` | Deterministic Calculate/Check |
| `tests/skills/test_mrpl_document_analysis_workflow.py` | Workflow tests |
| Skill `SKILL.md` v0.2 responsibility splits | Non-overlapping roles |

## Response-contract / interface-decision pass

Decision: **no bespoke Electron launcher UI.** MRPL is invoked via normal chat
+ slash commands (Hermes already auto-generates `/skill-name` per `SKILL.md`).
Workflow state, provenance, and governance render as structured text in the
existing chat surface — works identically in CLI/TUI/Desktop, zero UI code.

| Path | Purpose |
|------|---------|
| `docs/mrpl/RESPONSE_FORMAT.md` | Shared content contract (workflow state, findings, provenance, governance banner, FACT/CALCULATION/VERIFICATION/INTERPRETATION/ASSUMPTION/RECOMMENDATION labels, deliverables, multimodal, grounding) |
| `skills/mrpl/knowledge-search/SKILL.md` | New — local-only search over the knowledge mount; explicitly forbids `web_search`/`web_extract` for MRPL facts |
| `skills/mrpl/document-analysis/SKILL.md` | + multimodal routing (`vision_analyze`, `ocr-and-documents`) + response-format reference |
| `skills/mrpl/report-generation/SKILL.md` | + real deliverable routing (`docx`, `xlsx`, `powerpoint`) + response-format reference |
| `skills/mrpl/engineering-calculation/SKILL.md` | + response-format reference (Calculation vs Verification split) |
| `skills/mrpl/procedure-lookup/SKILL.md` | + prefers `knowledge-search`; response-format reference |
| `docs/mrpl/WORKFLOW.md` | + "Interface decision: Codex-style chat" section |
| `docs/mrpl/ARCHITECTURE.md` | Linked new doc; noted slash-command auto-exposure |
| `tests/skills/test_mrpl_response_contract.py` | New — contract coverage, no-web-call guarantee, deliverable routing, multimodal routing |

## Deliberately untouched

- Hermes core (`run_agent.py`, `toolsets.py`, `apps/desktop/`)
- Azure / Houdry provider plugins and resolvers (Houdry interchangeability test
  deferred after a local fabric model emitted tool calls as text instead of
  real tool calls — a model-capability issue, not an architecture issue;
  config restored to Azure)
- No Phase 7 pruning
- No SharePoint/ERP/QMS/RAG/EXECUTE integrations
- No new Electron/React components

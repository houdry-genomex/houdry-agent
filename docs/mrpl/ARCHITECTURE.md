# MRPL Agent Architecture

Build the MRPL workflow **on top of Hermes**. Do not turn Hermes core into an
MRPL-specific monolith. Inference (Azure vs Houdry) stays in the provider layer.

```text
                    MRPL Agent
                        |
              MRPL Skills / Knowledge / Policies
                        |
                  Hermes Core
                        |
                LLM Provider Layer
                  /           \
       Azure GPT-5.6 Luna      Houdry fabric
             DEV              PRIVATE GPU
```

## Physical layout (Hermes conventions)

| Conceptual layer | Repository path |
|------------------|-----------------|
| Skills | `skills/mrpl/<skill>/SKILL.md` (auto-exposed as `/skill-name` slash commands) |
| Knowledge mount | `knowledge/mrpl/` (empty scaffold; mount real docs later) |
| Policies / governance docs | `docs/mrpl/policies/`, `docs/mrpl/GOVERNANCE.md` |
| Suggested config overlay | `config/mrpl-agent.defaults.yaml` |
| Architecture docs | `docs/mrpl/` |
| Future integrations | MCP (`mcp_servers:`) or `~/.hermes/plugins/` — not core |

## Layer boundaries

```text
Knowledge source
      ↓
Retrieval/access (file tools, skill references, later MCP)
      ↓
Hermes context (session + skill_view + read_file)
      ↓
MRPL skill (procedure)
      ↓
Governance gate (READ → ANALYZE → DRAFT → EXECUTE)
```

## Provider independence

| Mode | Config |
|------|--------|
| Development | `model.provider: azure` + `AZURE_OPENAI_*` — see `docs/AZURE_OPENAI.md` |
| Private deploy | `model.provider: custom` (aliases `houdry` / `fabric`) + fabric `base_url` — see `docs/HOUDRY.md` |

Skills, tools, and governance must not branch on provider. Only `config.yaml` /
`.env` change when switching backends.

## Phased work

| Phase | Status |
|-------|--------|
| 1 Audit Hermes | Done — this directory |
| 2 Define MRPL architecture | Done — this directory + knowledge scaffold |
| 3 Foundational skills | Done — `skills/mrpl/` |
| 4 Governance mapping | Done — `GOVERNANCE.md` + defaults overlay |
| 5 Workflow examples | Done — `MVP_DOCUMENT_ANALYSIS.md` + fixture + verifier |
| 6 Provider independence | Documented; Azure smoke for MVP; Houdry via config later |
| 7 Hermes pruning | **Not started** — do not begin until MVP proven |

## Related docs

- [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md) — KEEP / DISABLE / OPTIONAL / FUTURE / REMOVE
- [KNOWLEDGE.md](KNOWLEDGE.md) — Layer 1
- [TOOLS.md](TOOLS.md) — Layer 3 classification
- [GOVERNANCE.md](GOVERNANCE.md) — Layer 4
- [WORKFLOW.md](WORKFLOW.md) — generic MRPL turn flow + interface decision
- [RESPONSE_FORMAT.md](RESPONSE_FORMAT.md) — workflow state / provenance / governance content contract
- [MVP_DOCUMENT_ANALYSIS.md](MVP_DOCUMENT_ANALYSIS.md) — Phase 5 end-to-end MVP
- [RUNNING.md](RUNNING.md) — how to run / switch providers

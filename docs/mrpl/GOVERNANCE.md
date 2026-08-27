# Layer 4 — Governance

## Principles

1. Least privilege  
2. Human approval for consequential actions  
3. No secrets embedded in prompts  
4. No API keys committed to Git  
5. Clear separation READ / ANALYZE / DRAFT / EXECUTE  
6. Auditability (sessions + logs)  
7. Provider independence (skills ≠ Azure/Houdry)  
8. No unrestricted shell in production  
9. External integrations explicitly authorized  
10. Sensitive MRPL data should not automatically go to external services  

Azure (dev) vs Houdry (private) changes **where inference runs**, not whether
approvals apply. Do not claim either backend alone satisfies plant security
policy.

## Action tiers

| Tier | Examples | Expected controls |
|------|----------|-------------------|
| **READ** | `read_file`, `search_files`, `skill_view`, `session_search` | Allowed for authorized users; still respect path ACLs on the host |
| **ANALYZE** | Summaries, comparisons, `execute_code` for calc, vision | Prefer sandboxed code; log session; cite sources |
| **DRAFT** | Reports, recommendations, `write_file` of drafts | Human review before operational use; mark drafts clearly |
| **EXECUTE** | Shell that mutates systems, ERP writes, QMS state changes | **Always** human approval; deny-by-default until MCP/tools authorized |

Progressively stronger authorization as consequence increases. Presence of a
Hermes tool does **not** authorize autonomous EXECUTE.

## Hermes mechanisms → MRPL mapping

| MRPL need | Hermes mechanism | Config / code |
|-----------|------------------|---------------|
| Approve dangerous commands | Approvals | `approvals.mode: manual\|smart`, `tools/approval.py` |
| Never auto-bypass hardline | Hardline patterns | `HARDLINE_PATTERNS` (not yolo-bypassable) |
| Deny known-bad patterns | Deny list | `approvals.deny` |
| Permanent allow (careful) | Allowlist | `command_allowlist` |
| Disable unused tools | Platform toolsets | `hermes tools`, `platform_toolsets` |
| Protect instruction files | Protected writes | `security.protected_instruction_files` |
| Log / audit | Logs + session DB | `$HERMES_HOME/logs/`, SQLite sessions |
| Secret redaction in logs | Redacting formatter | `security.redact_secrets` |
| Skill mutation audit | Skills ledger | `skills.ledger` |
| Memory write gate | Memory approval | `memory.write_approval` |
| Optional command scanner | Tirith | `security.tirith_*` |

## YOLO

`approvals.mode: off` / `--yolo` is for local smoke only. **Do not** use for
MRPL production or when proprietary knowledge is mounted against Azure.

## Policy stubs

Site-specific rules belong in:

- Workspace `AGENTS.md` (from `knowledge/mrpl/AGENTS.md.template`)
- `docs/mrpl/policies/` (organizational policy text you add later — empty stubs only)

Do not invent MRPL operational procedures here.

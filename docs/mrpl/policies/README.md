# MRPL policies (stubs)

Add organizational policies here later (data handling, approval matrices,
retention). This directory ships **empty on purpose** — do not invent plant
procedures.

Suggested filenames when you have real content:

- `data-classification.md`
- `approval-matrix.md`
- `external-services.md` (Azure vs on-prem inference rules)

Runtime enforcement still uses Hermes `approvals.*`, toolsets, and host ACLs —
policy markdown guides humans and the agent; it is not a substitute for gates.

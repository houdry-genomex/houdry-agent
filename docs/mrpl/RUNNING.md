# Running the MRPL agent

## Desktop (Windows)

See [DESKTOP.md](DESKTOP.md) for branding, Azure-first Settings, slash skills,
and `%LOCALAPPDATA%\houdry-agent`.

```powershell
$env:HERMES_HOME = "$env:LOCALAPPDATA\houdry-agent"
py -3 scripts\seed_mrpl_desktop_home.py
cd apps\desktop
npm run dev
```

## Prerequisites

```bash
cd /path/to/houdry-agent
source .venv/bin/activate   # or: uv venv && uv pip install -e ".[all]"
export HERMES_HOME="${HERMES_HOME:-$HOME/.houdry-agent}"
```

MRPL skills ship under `skills/mrpl/` and are seeded into `$HERMES_HOME/skills/`
on install/update (same as other bundled skills). If missing locally:

```bash
# After install/update, or manually:
ls skills/mrpl/*/SKILL.md
hermes skills list 2>/dev/null | head
```

## Point at knowledge (optional)

```bash
cd knowledge/mrpl   # or your mount with real docs under sources/
# copy AGENTS.md.template → AGENTS.md and edit site rules
```

## Development — Azure GPT-5.6 Luna

```bash
./scripts/seed-azure-openai-config.sh   # only if config.yaml missing
# Ensure ~/.houdry-agent/.env has AZURE_OPENAI_* secrets
# config.yaml: model.provider: azure, default: <deployment>, api_mode: chat_completions

hermes chat -q 'Load skill document-analysis and summarize its When to Use section.'
```

Details: [../AZURE_OPENAI.md](../AZURE_OPENAI.md)

## Private deploy — Houdry fabric

```bash
# Fabric running: houdry serve + houdry node join
./scripts/seed-houdry-fabric-config.sh   # only if config.yaml missing
# Or edit model.provider: custom (or houdry), base_url: http://HOST:18080/v1, default: auto

hermes chat -q 'Reply with exactly: houdry-ok'
```

Details: [../HOUDRY.md](../HOUDRY.md)

## Switch Azure ↔ Houdry

Change **only** inference config (keep skills/tools/governance):

1. Backup: `cp "$HERMES_HOME/config.yaml" "$HERMES_HOME/config.yaml.bak"`
2. Set `model.provider` / `base_url` / `default` / `api_mode` per docs above  
3. Or restore a known-good backup (`config.yaml.bak-houdry` if you created one)
4. Restart Desktop / CLI session

Do **not** edit MRPL skills when switching providers.

## Governance posture

Use `config/mrpl-agent.defaults.yaml` as a **manual overlay reference**.
Merge carefully into `$HERMES_HOME/config.yaml` — do not overwrite secrets.
Keep `approvals.mode: smart` or `manual` for MRPL work. Avoid `--yolo` with
proprietary knowledge on Azure.

## Phase 5 MVP (document analysis)

Synthetic fixture (fictional thresholds only):

```bash
# Deterministic Extract → Calculate → Check (no LLM required)
python skills/mrpl/document-analysis/scripts/verify_report_thresholds.py \
  tests/fixtures/mrpl/sample_measurements.json \
  --expect-attention TT-101 VT-201
```

Agent-driven DRAFT review (Azure while `model.provider: azure`):

```bash
hermes chat -q "$(cat <<'EOF'
Follow skills document-analysis, engineering-calculation, and report-generation.
Analyze tests/fixtures/mrpl/sample_technical_report.md using ONLY thresholds
written in that document. Run deterministic checks (execute_code or
skills/mrpl/document-analysis/scripts/verify_report_thresholds.py on
tests/fixtures/mrpl/sample_measurements.json). Produce a DRAFT review summary
with FACT / CALCULATION / INTERPRETATION / ASSUMPTION. Do not invent MRPL
policy. Do not EXECUTE external actions.
EOF
)"
```

See [MVP_DOCUMENT_ANALYSIS.md](MVP_DOCUMENT_ANALYSIS.md).

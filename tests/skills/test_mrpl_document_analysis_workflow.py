"""Phase 5 MRPL document-analysis MVP — deterministic workflow tests."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPO / "tests" / "fixtures" / "mrpl"
REPORT_MD = FIXTURE_DIR / "sample_technical_report.md"
MEASUREMENTS_JSON = FIXTURE_DIR / "sample_measurements.json"
VERIFY_SCRIPT = (
    REPO
    / "skills"
    / "mrpl"
    / "document-analysis"
    / "scripts"
    / "verify_report_thresholds.py"
)
MRPL_SKILLS = REPO / "skills" / "mrpl"
PROVIDER_LEAK = re.compile(
    r"\b(azure-foundry|azure-openai|AZURE_OPENAI|model\.provider\s*[:=]|"
    r"openai\.azure|18080/v1|HERMES_LLM_PROVIDER)\b",
    re.I,
)


def _load_verifier():
    spec = importlib.util.spec_from_file_location(
        "verify_report_thresholds", VERIFY_SCRIPT
    )
    mod = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(mod)
    return mod


def test_fixture_is_explicitly_fictional():
    text = REPORT_MD.read_text(encoding="utf-8")
    assert "FICTIONAL" in text.upper() or "synthetic" in text.lower()
    assert "not" in text.lower() and "sop" in text.lower()
    payload = json.loads(MEASUREMENTS_JSON.read_text(encoding="utf-8"))
    assert "FICTIONAL" in payload["fixture_notice"].upper()


def test_deterministic_extract_calculate_check():
    mod = _load_verifier()
    payload = json.loads(MEASUREMENTS_JSON.read_text(encoding="utf-8"))
    report = mod.run_checks(payload)

    assert set(report["attention_tags"]) == {"TT-101", "VT-201"}
    assert set(report["ok_tags"]) == {"PT-301", "FT-401"}
    assert report["governance_ceiling"] == "DRAFT"

    by_tag = {row["tag"]: row for row in report["rows"]}
    assert by_tag["TT-101"]["interpretation"]["requires_attention"] is True
    assert by_tag["VT-201"]["interpretation"]["requires_attention"] is True
    assert by_tag["PT-301"]["interpretation"]["requires_attention"] is False
    assert by_tag["FT-401"]["interpretation"]["requires_attention"] is False

    pct = by_tag["FT-401"]["calculation"]["percent_deviation"]
    assert abs(pct - (-4.0)) < 1e-9
    assert "assumption" in by_tag["TT-101"]


def test_verifier_cli_expect_attention(tmp_path, monkeypatch, capsys):
    mod = _load_verifier()
    rc = mod.main(
        [str(MEASUREMENTS_JSON), "--expect-attention", "TT-101", "VT-201"]
    )
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out["attention_tags"] == ["TT-101", "VT-201"]


def test_markdown_and_json_twins_agree_on_tags():
    payload = json.loads(MEASUREMENTS_JSON.read_text(encoding="utf-8"))
    md = REPORT_MD.read_text(encoding="utf-8")
    for tag in payload["expected_attention_tags"]:
        assert tag in md
    for tag in payload["expected_ok_tags"]:
        assert tag in md
    assert "80" in md and "3.5" in md and "5%" in md


def test_mrpl_skills_have_exclusive_responsibilities():
    responsibilities = {}
    for path in sorted(MRPL_SKILLS.glob("*/SKILL.md")):
        text = path.read_text(encoding="utf-8")
        assert "## Responsibility" in text, path
        # Capture first paragraph after Responsibility heading
        m = re.search(
            r"## Responsibility\n\n(.+?)(\n\n|\n\*\*Does not:)",
            text,
            re.S,
        )
        assert m, path
        responsibilities[path.parent.name] = m.group(1).strip().lower()

    assert "extract" in responsibilities["document-analysis"]
    assert "retriev" in responsibilities["procedure-lookup"]
    assert "determin" in responsibilities["engineering-calculation"]
    assert "draft" in responsibilities["report-generation"]

    # No skill should claim all four verbs as its primary responsibility line.
    assert "sop" not in responsibilities["document-analysis"]
    assert "extract" not in responsibilities["engineering-calculation"]


def test_mrpl_skills_are_provider_agnostic():
    for path in MRPL_SKILLS.glob("*/SKILL.md"):
        text = path.read_text(encoding="utf-8")
        # Body only — author may say "Houdry Agent" without binding inference.
        fm_end = text.index("\n---\n", 3)
        body = text[fm_end + 5 :]
        assert PROVIDER_LEAK.search(body) is None, path
        assert "provider:" not in body.lower()
        assert "base_url" not in body.lower()


def test_mvp_doc_declares_draft_ceiling_and_no_execute():
    mvp = (REPO / "docs" / "mrpl" / "MVP_DOCUMENT_ANALYSIS.md").read_text(
        encoding="utf-8"
    )
    assert "DRAFT" in mvp
    assert "EXECUTE" in mvp
    assert "verify_report_thresholds" in mvp
    assert "sample_technical_report.md" in mvp


def test_percent_deviation_helper():
    mod = _load_verifier()
    assert mod.percent_deviation(48, 50) == -4.0

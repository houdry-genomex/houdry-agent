"""MRPL response-contract wiring: skills reference the shared format,
route multimodal input, produce real deliverables, and never let
knowledge-search reach the web."""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
MRPL_SKILLS = REPO / "skills" / "mrpl"
RESPONSE_FORMAT = REPO / "docs" / "mrpl" / "RESPONSE_FORMAT.md"


def test_response_format_doc_exists_and_has_required_sections():
    text = RESPONSE_FORMAT.read_text(encoding="utf-8")
    for heading in (
        "Workflow state block",
        "Provenance",
        "Labeled content types",
        "Governance banner",
        "Deliverables, not just chat text",
        "Multimodal input",
        "Grounding",
    ):
        assert heading in text, heading
    for label in (
        "FACT",
        "CALCULATION",
        "VERIFICATION",
        "INTERPRETATION",
        "ASSUMPTION",
        "RECOMMENDATION",
    ):
        assert label in text, label


def test_all_mrpl_skills_reference_response_format():
    for path in MRPL_SKILLS.glob("*/SKILL.md"):
        text = path.read_text(encoding="utf-8")
        assert "RESPONSE_FORMAT.md" in text, path


def test_document_analysis_routes_multimodal_input():
    text = (MRPL_SKILLS / "document-analysis" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert "vision_analyze" in text
    assert "ocr-and-documents" in text
    assert "Multimodal input" in text


def test_report_generation_produces_real_deliverables():
    text = (MRPL_SKILLS / "report-generation" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    for skill in ("docx", "xlsx", "powerpoint"):
        assert skill in text, skill
    assert "DRAFT" in text


def test_knowledge_search_skill_forbids_web_tools():
    text = (MRPL_SKILLS / "knowledge-search" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert "web_search" in text and "web_extract" in text
    # Must explicitly forbid using them, not just mention them positively.
    forbid_pattern = re.compile(
        r"(does not|no web|zero calls to).{0,80}web_search", re.I | re.S
    )
    assert forbid_pattern.search(text), "must explicitly forbid web_search usage"


def test_procedure_lookup_prefers_knowledge_search():
    text = (MRPL_SKILLS / "procedure-lookup" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert "knowledge-search" in text


def test_engineering_calculation_separates_calc_from_verification():
    text = (MRPL_SKILLS / "engineering-calculation" / "SKILL.md").read_text(
        encoding="utf-8"
    )
    assert "VERIFICATION" in text
    assert "CALCULATION" in text


def test_mrpl_skill_set_is_slash_command_ready():
    """Every MRPL skill has a valid bare `name` matching its directory —
    this is what Hermes uses to auto-generate `/name` slash commands."""
    import yaml

    for path in MRPL_SKILLS.glob("*/SKILL.md"):
        text = path.read_text(encoding="utf-8")
        fm_end = text.index("\n---\n", 3)
        meta = yaml.safe_load(text[4:fm_end])
        assert meta["name"] == path.parent.name
        assert re.fullmatch(r"[a-z0-9-]+", meta["name"]), meta["name"]

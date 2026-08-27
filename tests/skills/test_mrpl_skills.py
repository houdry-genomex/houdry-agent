"""MRPL foundational skills — structure and provider independence."""
from __future__ import annotations

from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[2]
MRPL_SKILLS = REPO / "skills" / "mrpl"
KNOWLEDGE = REPO / "knowledge" / "mrpl"

EXPECTED = {
    "document-analysis",
    "procedure-lookup",
    "engineering-calculation",
    "report-generation",
}


def test_mrpl_foundational_skills_exist():
    found = {p.parent.name for p in MRPL_SKILLS.glob("*/SKILL.md")}
    assert EXPECTED <= found


def test_mrpl_skills_declare_category_and_required_sections():
    required_headings = (
        "## When to Use",
        "## Prerequisites",
        "## Inputs",
        "## Expected outputs",
        "## Required tools",
        "## Procedure",
        "## Validation",
        "## Safety / approval",
        "## Limitations",
    )
    for path in sorted(MRPL_SKILLS.glob("*/SKILL.md")):
        text = path.read_text(encoding="utf-8")
        assert text.startswith("---\n"), path
        fm_end = text.index("\n---\n", 3)
        meta = yaml.safe_load(text[4:fm_end])
        assert meta["name"] == path.parent.name
        assert meta["metadata"]["hermes"]["category"] == "mrpl"
        for heading in required_headings:
            assert heading in text, f"{path} missing {heading}"


def test_mrpl_knowledge_scaffold_has_no_invented_sops():
    """Sources dirs exist but must not ship proprietary procedure bodies."""
    sources = KNOWLEDGE / "sources"
    assert sources.is_dir()
    for child in sources.iterdir():
        if child.is_dir():
            # Only placeholder keepers — no .md SOP content committed.
            md_files = list(child.glob("*.md"))
            assert md_files == [], f"unexpected docs in {child}: {md_files}"


def test_azure_and_houdry_provider_aliases_still_resolve():
    """MRPL layer must not break provider independence."""
    from hermes_cli.runtime_provider import resolve_requested_provider

    assert resolve_requested_provider("azure") == "azure-foundry"
    assert resolve_requested_provider("azure-openai") == "azure-foundry"
    assert resolve_requested_provider("houdry") == "custom"
    assert resolve_requested_provider("fabric") == "custom"

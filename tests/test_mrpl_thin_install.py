"""Contracts for the MRPL plant thin-install checkout spec."""

from pathlib import Path

from hermes_cli.mrpl_thin_install import overlay_skip_names, parse_top_level_excludes
from hermes_constants import (
    OFFICIAL_GITHUB_OWNER,
    OFFICIAL_GITHUB_REPO,
    OFFICIAL_REPO_URL,
    official_github_archive_url,
    official_github_raw_url,
)

REPO_ROOT = Path(__file__).resolve().parents[1]


def test_official_repo_is_houdry_fork():
    assert OFFICIAL_GITHUB_OWNER == "houdry-genomex"
    assert OFFICIAL_GITHUB_REPO == "houdry-agent"
    assert "houdry-genomex/houdry-agent" in OFFICIAL_REPO_URL
    assert official_github_archive_url(branch="main").endswith(
        "/houdry-agent/archive/refs/heads/main.zip"
    )
    assert official_github_raw_url("main", "scripts/install.ps1").endswith(
        "/houdry-agent/main/scripts/install.ps1"
    )


def parse_nested_excludes(spec: str) -> frozenset[str]:
    """All ``!/path/`` exclude lines in a non-cone sparse-checkout spec."""
    names: set[str] = set()
    for raw in spec.splitlines():
        line = raw.strip()
        if line.startswith("!/"):
            names.add(line)
    return frozenset(names)


def test_sparse_spec_keeps_plugins_memory_for_serve():
    """serve/dashboard imports plugins.memory.config_schema at module load."""
    spec = (REPO_ROOT / "config" / "mrpl-install.sparse-checkout").read_text(
        encoding="utf-8"
    )
    assert "!/plugins/memory/" not in parse_nested_excludes(spec)


def test_sparse_spec_omits_docs_tests_and_keeps_plugins_root():
    spec = (REPO_ROOT / "config" / "mrpl-install.sparse-checkout").read_text(
        encoding="utf-8"
    )
    top = parse_top_level_excludes(spec)
    for name in ("website", "tests", "optional-skills", "evals"):
        assert name in top
    # Nested plugin drops must not skip the whole plugins/ overlay.
    assert "plugins" not in top
    skip = overlay_skip_names(spec)
    assert skip == top

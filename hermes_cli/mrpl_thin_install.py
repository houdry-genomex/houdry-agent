"""Thin the managed plant install tree after clone / ZIP update.

Website and Desktop first-launch clone the full GitHub archive, then this
module (and the installer scripts) apply git sparse-checkout so docs, the
test suite, optional-skills, and unused plugins never occupy disk. The
development git worktree is never touched: thinning runs only when
``git config houdry.thinInstall`` is true, which the installer sets.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

THIN_INSTALL_GIT_CONFIG_KEY = "houdry.thinInstall"
SPARSE_CHECKOUT_RELPATH = Path("config") / "mrpl-install.sparse-checkout"


def parse_top_level_excludes(spec: str) -> frozenset[str]:
    """Names of top-level dirs listed as ``!/name/`` in a non-cone spec.

    Nested excludes (``!/plugins/platforms/``) are not top-level: ZIP overlay
    still copies ``plugins/`` and sparse-checkout then drops the subtrees.
    """
    names: set[str] = set()
    for raw in spec.splitlines():
        line = raw.strip()
        if not line.startswith("!/"):
            continue
        rest = line[2:].strip("/")
        if rest and "/" not in rest:
            names.add(rest)
    return frozenset(names)


def overlay_skip_names(spec: str | None = None) -> frozenset[str]:
    """Top-level names a thin ZIP overlay should not copy onto the live tree."""
    if spec is None:
        return frozenset()
    return parse_top_level_excludes(spec)


def read_sparse_spec(cwd: Path) -> str | None:
    path = Path(cwd) / SPARSE_CHECKOUT_RELPATH
    if not path.is_file():
        return None
    return path.read_text(encoding="utf-8")


def is_thin_install(cwd: Path, git_cmd: list[str] | None = None) -> bool:
    git = list(git_cmd or ["git"])
    try:
        result = subprocess.run(
            git + ["config", "--get", THIN_INSTALL_GIT_CONFIG_KEY],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        return False
    if result.returncode != 0:
        return False
    return result.stdout.strip().lower() in {"true", "1", "yes"}


def apply_thin_checkout(cwd: Path, *, git_cmd: list[str] | None = None) -> bool:
    """Enable sparse-checkout from ``config/mrpl-install.sparse-checkout``.

    Returns True when the spec was written and git config was set. A missing
    spec or missing ``.git`` is a no-op (False) so developer trees are safe.
    """
    cwd = Path(cwd)
    spec = read_sparse_spec(cwd)
    if spec is None:
        return False
    git_meta = cwd / ".git"
    if not git_meta.exists():
        return False
    git = list(git_cmd or ["git"])
    init = subprocess.run(
        git + ["sparse-checkout", "init", "--no-cone"],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if init.returncode != 0:
        return False
    path_proc = subprocess.run(
        git + ["rev-parse", "--git-path", "info/sparse-checkout"],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if path_proc.returncode != 0:
        return False
    sparse_file = Path(path_proc.stdout.strip())
    if not sparse_file.is_absolute():
        sparse_file = cwd / sparse_file
    try:
        sparse_file.parent.mkdir(parents=True, exist_ok=True)
        sparse_file.write_text(spec, encoding="utf-8")
    except OSError:
        return False
    subprocess.run(
        git + ["sparse-checkout", "reapply"],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    subprocess.run(
        git + ["config", THIN_INSTALL_GIT_CONFIG_KEY, "true"],
        cwd=cwd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return True

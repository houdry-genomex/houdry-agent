"""Desktop bootstrap must not hang on optional winget packages.

Plant first-run drives install.ps1 -NonInteractive. Install-SystemPackages
used to call winget for ripgrep/ffmpeg with no timeout; that UAC wait is what
left a clean Windows laptop stuck on "Installing ripgrep and ffmpeg".

install.ps1 only runs on Windows, so these tests lock the contract in source
(same style as test_install_ps1_uv_install_fallback.py).
"""

from __future__ import annotations

from pathlib import Path


_INSTALL_PS1 = Path(__file__).resolve().parents[1] / "scripts" / "install.ps1"


def _ps1() -> str:
    return _INSTALL_PS1.read_text(encoding="utf-8")


def test_noninteractive_skips_optional_winget_packages():
    source = _ps1()
    start = source.index("function Install-SystemPackages")
    body = source[start : source.index("function Install-Repository")]
    assert "$NonInteractive" in body
    assert "Skipping optional ripgrep/ffmpeg install in non-interactive mode" in body
    assert 'winget install --exact --id $pkg' in body
    assert body.index("$NonInteractive") < body.index("winget install --exact --id $pkg")


def test_config_templates_prefer_houdry_desktop_defaults():
    source = _ps1()
    start = source.index("function Copy-ConfigTemplates")
    body = source[start : start + 4000]
    assert r"$InstallDir\config\mrpl-desktop.defaults.yaml" in body
    assert r"$InstallDir\cli-config.yaml.example" in body
    assert body.index("mrpl-desktop.defaults.yaml") < body.index("cli-config.yaml.example")


def test_noninteractive_skips_node_winget_fallback():
    source = _ps1()
    start = source.index("function Test-Node {")
    body = source[start : source.index("function Install-SystemPackages")]
    assert "$NonInteractive" in body
    assert "Skipping winget Node.js install in non-interactive mode" in body
    assert "'install','OpenJS.NodeJS'" in body
    assert body.index("Skipping winget Node.js install in non-interactive mode") < body.index(
        "'install','OpenJS.NodeJS'"
    )


def test_unbound_path_defaults_use_houdry_agent_home():
    source = _ps1()
    assert r"$env:LOCALAPPDATA\houdry-agent" in source
    assert r"$env:LOCALAPPDATA\houdry-agent\hermes-agent" in source
    assert r'else { "$env:LOCALAPPDATA\hermes" }' not in source
    assert r'else { "$env:LOCALAPPDATA\hermes\hermes-agent" }' not in source


def test_mrpl_thin_checkout_reads_spec_before_sparse_checkout_init():
    """`git sparse-checkout init --no-cone` writes its own default pattern
    (`/*` + `!/*/`: root-level files only) and applies it immediately --
    deleting every subdirectory, including config/ (which holds the desired
    sparse-checkout spec file itself) and hermes_cli/, before the next line
    can copy the real patterns in. Verified live: `git sparse-checkout init
    --no-cone` on a clean repo strips every subdirectory on the spot. This
    silently truncated every fresh install down to root-level files only,
    which is why hermes_cli/web_server.py's downstream syntax check kept
    failing on totally healthy clones. The spec's content must be read into
    memory before `sparse-checkout init` runs, and written (never
    `Copy-Item`'d from the now-pruned working tree) afterward.
    """
    source = _ps1()
    start = source.index("function Apply-MrplThinCheckout")
    body = source[start : source.index("function Write-Info")]
    read_idx = body.index("Get-Content -LiteralPath $spec -Raw")
    # The explanatory comment above also mentions "git sparse-checkout init
    # --no-cone" in backticks -- anchor on the actual invocation (with its
    # redirection) so the comment text doesn't satisfy the ordering check.
    init_idx = body.index("git sparse-checkout init --no-cone 2>$null")
    write_idx = body.index("Set-Content -LiteralPath $sparsePath -Value $specContent")
    assert read_idx < init_idx < write_idx
    assert "Copy-Item -LiteralPath $spec" not in body


def test_existing_checkout_with_foreign_origin_is_not_reused():
    """A pre-existing ~/.hermes (real prior Hermes Agent user, or a leftover
    from an earlier broken attempt) can be a clone of a different repo
    entirely. install.ps1's "update in place" path must not fetch/checkout
    against a foreign origin -- it should treat the checkout as invalid and
    fall through to a fresh clone of houdry-genomex/houdry-agent, same as any
    other broken repo.
    """
    source = _ps1()
    start = source.index("function Install-Repository")
    body = source[start : source.index("if (-not $didUpdate)")]
    assert "git -c windows.appendAtomically=false remote get-url origin" in body
    assert '[regex]::Escape("$RepoOwner/$RepoName")' in body
    assert "$originOk" in body
    assert "$revParseOk -and $statusOk -and $hasCommit -and $originOk" in body


def test_web_server_syntax_check_self_heals_before_failing_bootstrap():
    """A truncated/corrupted checkout of hermes_cli/web_server.py (Windows AV
    or OneDrive interfering with git's file write during checkout) used to
    fail the whole "dependencies" bootstrap stage immediately. Restore the
    single file from git and re-check before giving up.
    """
    source = _ps1()
    start = source.index("function Install-Dependencies")
    body = source[start : source.index("function Install-HermesCommandLaunchers")]
    assert 'throw "dashboard backend source failed syntax check: hermes_cli/web_server.py' in body
    assert "git -c windows.appendAtomically=false checkout -- hermes_cli/web_server.py" in body
    # The self-heal restore + re-check must happen before the final throw.
    restore_idx = body.index("checkout -- hermes_cli/web_server.py")
    throw_idx = body.index('throw "dashboard backend source failed syntax check')
    assert restore_idx < throw_idx

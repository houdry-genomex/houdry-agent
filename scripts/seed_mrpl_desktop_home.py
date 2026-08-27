#!/usr/bin/env python3
"""Seed $HERMES_HOME for Desktop MRPL (Azure DEV + governance overlay).

Windows default home: %LOCALAPPDATA%\\houdry-agent
Never overwrites an existing config.yaml. Never invents secrets.

  python scripts/seed_mrpl_desktop_home.py
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "config" / "mrpl-desktop.defaults.yaml"


def _default_home() -> Path:
    # Import after sys.path so a source checkout works without install.
    sys.path.insert(0, str(ROOT))
    from hermes_constants import get_hermes_home

    return get_hermes_home()


def _append_env_placeholders(env_path: Path) -> bool:
    existing = env_path.read_text(encoding="utf-8") if env_path.is_file() else ""
    placeholders = (
        ("AZURE_OPENAI_API_KEY", ""),
        ("AZURE_OPENAI_ENDPOINT", "https://YOUR_RESOURCE.openai.azure.com"),
        ("AZURE_OPENAI_DEPLOYMENT", "gpt-5.6-luna"),
    )
    missing = [f"{key}={value}" for key, value in placeholders if f"{key}=" not in existing]
    if not missing:
        return False
    prefix = "" if not existing or existing.endswith("\n") else "\n"
    env_path.write_text(existing + prefix + "\n".join(missing) + "\n", encoding="utf-8")
    return True


def seed(home: Path | None = None) -> int:
    home_dir = home or _default_home()
    home_dir.mkdir(parents=True, exist_ok=True)
    config_path = home_dir / "config.yaml"
    env_path = home_dir / ".env"

    if not TEMPLATE.is_file():
        print(f"Missing template: {TEMPLATE}", file=sys.stderr)
        return 1

    if config_path.is_file():
        print(f"config.yaml already exists at {config_path} (left unchanged)")
        print("To switch to Azure DEV manually: model.provider: azure, default: gpt-5.6-luna, api_mode: chat_completions")
    else:
        shutil.copyfile(TEMPLATE, config_path)
        print(f"Wrote {config_path} (Azure + MRPL overlay)")

    if _append_env_placeholders(env_path):
        print(f"Appended Azure placeholders to {env_path} (edit with real values)")
    else:
        print(f".env already has Azure keys at {env_path}")

    print("PROD (Houdry fabric): python scripts/seed_mrpl_desktop_home.py is Azure-only;")
    print("  use scripts/seed-houdry-fabric-config.sh when switching inference.")
    return 0


def main() -> int:
    override = os.environ.get("HERMES_HOME", "").strip()
    home = Path(override) if override else None
    return seed(home)


if __name__ == "__main__":
    raise SystemExit(main())

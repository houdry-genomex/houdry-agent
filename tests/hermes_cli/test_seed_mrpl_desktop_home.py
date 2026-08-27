import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from seed_mrpl_desktop_home import seed  # noqa: E402


def test_seed_writes_azure_mrpl_config_when_missing(tmp_path: Path) -> None:
    assert seed(tmp_path) == 0
    config = (tmp_path / "config.yaml").read_text(encoding="utf-8")
    assert "provider: azure" in config
    assert "gpt-5.6-luna" in config
    assert "api_mode: chat_completions" in config
    assert "write_approval: true" in config
    env = (tmp_path / ".env").read_text(encoding="utf-8")
    assert "AZURE_OPENAI_API_KEY=" in env
    assert "AZURE_OPENAI_DEPLOYMENT=gpt-5.6-luna" in env


def test_seed_does_not_overwrite_existing_config(tmp_path: Path) -> None:
    (tmp_path / "config.yaml").write_text("model:\n  provider: custom\n", encoding="utf-8")
    assert seed(tmp_path) == 0
    assert (tmp_path / "config.yaml").read_text(encoding="utf-8") == "model:\n  provider: custom\n"

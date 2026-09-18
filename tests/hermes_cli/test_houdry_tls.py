"""TOFU pinning of a Houdry control-plane CA for LAN HTTPS."""

from pathlib import Path

from hermes_cli.houdry_tls import httpx_verify_for_url, is_houdry_lan_https, pin_houdry_ca


def test_is_houdry_lan_https_only_private_houdry_ports():
    assert is_houdry_lan_https("https://192.168.29.48:18080/v1")
    assert is_houdry_lan_https("https://10.0.0.8:8090")
    assert not is_houdry_lan_https("http://192.168.29.48:18080/v1")
    assert not is_houdry_lan_https("https://api.openai.com/v1")
    assert not is_houdry_lan_https("https://example.com:18080/v1")


def test_httpx_verify_public_stays_default():
    assert httpx_verify_for_url("https://api.openai.com/v1") is True


def test_pin_houdry_ca_writes_pem(tmp_path, monkeypatch):
    monkeypatch.setenv("HERMES_HOME", str(tmp_path))

    class _Resp:
        status_code = 200
        text = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n"

    class _Client:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def get(self, url):
            assert url.endswith("/v1/pki/ca")
            return _Resp()

    monkeypatch.setattr("httpx.Client", _Client)

    path = pin_houdry_ca("https://192.168.29.48:18080/v1")
    assert path
    assert Path(path).is_file()
    assert "BEGIN CERTIFICATE" in Path(path).read_text(encoding="utf-8")
    assert httpx_verify_for_url("https://192.168.29.48:18080/v1") == path

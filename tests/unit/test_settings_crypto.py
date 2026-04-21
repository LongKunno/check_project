import pytest

from src.engine.settings_crypto import SettingsCryptoError, decrypt_setting, encrypt_setting


def test_encrypt_setting_requires_configured_secret(monkeypatch):
    monkeypatch.delenv("SETTINGS_ENCRYPTION_KEY", raising=False)
    monkeypatch.delenv("JWT_SECRET_KEY", raising=False)

    with pytest.raises(SettingsCryptoError, match="SETTINGS_ENCRYPTION_KEY"):
        encrypt_setting("secret-value")


def test_decrypt_setting_raises_on_invalid_token(monkeypatch):
    monkeypatch.setenv("SETTINGS_ENCRYPTION_KEY", "unit-test-secret")

    with pytest.raises(SettingsCryptoError, match="Không thể giải mã"):
        decrypt_setting("not-a-valid-token")

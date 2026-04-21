import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


class SettingsCryptoError(RuntimeError):
    """Raised when encrypted settings cannot be safely encrypted/decrypted."""


def _get_encryption_secret() -> str:
    secret = (
        os.getenv("SETTINGS_ENCRYPTION_KEY", "").strip()
        or os.getenv("JWT_SECRET_KEY", "").strip()
    )
    if not secret:
        raise SettingsCryptoError(
            "Thiếu SETTINGS_ENCRYPTION_KEY hoặc JWT_SECRET_KEY để mã hóa cấu hình đã lưu."
        )
    return secret


def _derive_fernet_key() -> bytes:
    secret = _get_encryption_secret()
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_settings_cipher() -> Fernet:
    return Fernet(_derive_fernet_key())


def encrypt_setting(value: str) -> str:
    if not value:
        return ""
    token = get_settings_cipher().encrypt(value.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_setting(value: str) -> str:
    if not value:
        return ""
    try:
        decrypted = get_settings_cipher().decrypt(value.encode("utf-8"))
        return decrypted.decode("utf-8")
    except InvalidToken as exc:
        raise SettingsCryptoError(
            "Không thể giải mã cấu hình đã lưu. Hãy kiểm tra secret mã hóa hoặc lưu lại giá trị này."
        ) from exc

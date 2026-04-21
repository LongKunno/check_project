import base64
import hashlib
import os

from cryptography.fernet import Fernet, InvalidToken


def _derive_fernet_key() -> bytes:
    secret = (
        os.getenv("SETTINGS_ENCRYPTION_KEY")
        or os.getenv("JWT_SECRET_KEY")
        or "change-me-in-production-please"
    )
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
    except InvalidToken:
        return ""

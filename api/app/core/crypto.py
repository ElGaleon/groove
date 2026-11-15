"""Encryption of stored Discogs tokens (Fernet, key from the environment)."""

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings


class CryptoError(RuntimeError):
    pass


def _fernet() -> Fernet:
    key = get_settings().fernet_key
    if not key:
        raise CryptoError("FERNET_KEY non impostata")
    try:
        return Fernet(key.encode())
    except ValueError as exc:
        raise CryptoError("FERNET_KEY non valida") from exc


def encrypt(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise CryptoError("Token non decifrabile con la chiave attuale") from exc

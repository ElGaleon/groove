from sqlalchemy import select, text

from app.core.crypto import decrypt, encrypt
from app.models import DiscogsConnection, Household, User


def test_roundtrip_and_not_plaintext():
    token = encrypt("secret-token-123")
    assert "secret-token-123" not in token
    assert decrypt(token) == "secret-token-123"


def test_tokens_are_stored_encrypted(db):
    h = Household(name="F")
    db.add(h)
    db.flush()
    u = User(household_id=h.id, email="a@example.com", password_hash="x", display_name="A")
    db.add(u)
    db.flush()
    db.add(
        DiscogsConnection(
            user_id=u.id,
            discogs_username="anna",
            token_encrypted=encrypt("tok-plain"),
            token_secret_encrypted=encrypt("sec-plain"),
        )
    )
    db.commit()
    raw = db.execute(
        text("SELECT token_encrypted, token_secret_encrypted FROM discogs_connections")
    ).one()
    assert "tok-plain" not in raw[0] and "sec-plain" not in raw[1]
    conn = db.scalar(select(DiscogsConnection))
    assert decrypt(conn.token_encrypted) == "tok-plain"
    assert decrypt(conn.token_secret_encrypted) == "sec-plain"

# Security

Groove holds one family's private data. The threat model is modest — a small private app on the
public internet — but the basics are enforced by code and tests.

## Authentication

- **Passwords:** argon2id (`app/core/security.py`), minimum `min_password_length` (10).
  Verification against a dummy hash when the e-mail is unknown, so timing does not reveal which
  e-mails exist; the error is the same (`invalid_credentials`).
- **Rate limiting:** `login_max_failures` (5) failures per e-mail in `login_window_minutes` (10)
  → `429 too_many_attempts`. Attempts are stored in `login_attempts` and purged by housekeeping.
- **Sessions:** a random token (`secrets.token_urlsafe(32)`) in the `groove_session` cookie —
  `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when `PUBLIC_BASE_URL` is `https://`. Only the
  SHA-256 hash is stored (`sessions.token_hash`). Lifetime `session_days` (30). Expired sessions
  are deleted on use and by housekeeping.
- **Registration:** the first member creates the household; afterwards registration needs a valid
  invite (`invite_required`). Invites expire after `invite_days` (7), are single-use (row locked
  while consumed) and revocable.
- **Password recovery without e-mail:** another member of the same household creates a one-time
  link (24 h; a new one cancels the previous). Nobody can create one for themself
  (`reset_not_allowed`). Using it ends every other session of that member.

## Authorisation and isolation

- Every data endpoint depends on `get_current_user`.
- Every query on member data is scoped to `user.household_id`. Data of another household is
  answered as **404 not found**, never 403, so ids cannot be probed.
- Inside the household all members have the same rights (ownership is a label).
- Tests: every new endpoint gets a test that another household cannot read or change the data.

## CSRF

With `SameSite=Lax` cookies, cross-site form posts are the remaining risk. The middleware in
`app/main.py` rejects every non-`GET/HEAD/OPTIONS` request without `X-Requested-With: groove`
(`403 csrf_header_missing`); browsers cannot add custom headers to cross-site form submissions.
The web `api()` helper adds it automatically.

## Secrets

- `.env` is never committed; `.env.example` lists names only.
- Discogs consumer key/secret live only in API settings. Members' Discogs tokens and OAuth
  secrets are **Fernet-encrypted** at rest (`app/core/crypto.py`, `FERNET_KEY`). Losing the key
  only means members must reconnect Discogs.
- No secret or token is ever returned by the API or bundled in the front end:
  `api/tests/api/test_discogs_secrets.py` enforces it.
- Backups (`/api/backup` and `scripts/backup.sh`) never contain tokens; the JSON export has no
  covers and names owners by display name only.

## Uploads and outbound requests

- Covers: JPEG/PNG/WebP only, `max_cover_bytes` (5 MB), decoded and re-encoded with Pillow to a
  square JPEG — the original bytes are never served.
- Covers fetched from a URL are accepted only from Discogs image hosts (`bad_cover_url`), which
  prevents the API from being used to fetch arbitrary URLs.
- Request bodies over 11 MB are refused by Caddy before reaching the API.

## Transport and headers

Caddy (`web/Caddyfile`) obtains HTTPS certificates automatically when `SITE_ADDRESS` is a domain
and sends on every response: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, a restrictive
`Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, and no `Server` header.
Swagger UI and `/api/openapi.json` are off in Docker Compose (`API_DOCS_ENABLED=false`).

## Container

The API image runs as an unprivileged `groove` user (it starts as root only to `chown` the covers
volume, then drops privileges with `setpriv`).

## Privacy

- Cover images from Discogs belong to their creators; they are for private family use. Do not
  publish them or commit `api/covers/`.
- The browser sends typed addresses only to Nominatim and requests only map tiles from the tile
  servers. No analytics.

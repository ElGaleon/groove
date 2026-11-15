# CLAUDE.md — api/app/

Application package. Imports are absolute from `app.` (`from app.models import Record`).

## Where things go

| Need | Put it in |
|---|---|
| New endpoint | `api/routers/<domain>.py` (thin), register in `main.py` if it's a new router |
| Shared request dependency | `api/deps.py` |
| Business logic / queries | `services/<domain>.py` |
| New table or column | `models/<domain>.py` + Alembic revision |
| Request/response shape | `schemas/<domain>.py` (export it via `__all__` / `schemas/__init__.py`) |
| External service client | `integrations/<service>/` (client + mapping, pure functions where possible) |
| Config value | `core/config.py` `Settings` |
| Error code | `core/errors.py` constants |

## Conventions

- Routers: `APIRouter(prefix="/api/<plural>", tags=[...])`, explicit `response_model`,
  explicit `status_code` for 201/204. Declare collection routes before `/{id}` routes.
- Services take `db: Session` and the current `User`; they commit. Routers don't commit.
- Background import (`services/importer.py`) runs in a worker thread started in `main.lifespan`;
  job state lives in the DB so it resumes after restart. Keep each page commit durable.
- Discogs calls go through `integrations/discogs/client.py` (rate limited, retries with backoff).
  Map Discogs payloads in `integrations/discogs/mapping.py`, never in services or routers.
- Cover images: `services/covers.py` stores resized JPEGs in `settings.covers_dir`; they are served
  only to signed-in members with private caching.
- Amounts: integer minor units + currency (`core/money.py`). Times: `core/clock.utcnow()`.
- Passwords: argon2 (`core/security.py`). Tokens stored only as hashes. Discogs tokens: Fernet
  (`core/crypto.py`).
- Docstrings are short and say why; keep that style.

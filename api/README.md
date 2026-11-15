# Groove — API

FastAPI backend for Groove, the family vinyl collection. It serves everything under `/api`, stores data
in PostgreSQL and talks to Discogs on behalf of each member.

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 · Pydantic Settings ·
argon2 · Fernet (cryptography) · httpx · Pillow · uv · ruff · pytest

## Quick start

Requirements: [uv](https://docs.astral.sh/uv/) (it installs Python 3.12) and a running
PostgreSQL. The simplest is the dev database from the project root:

```bash
docker compose -f ../docker-compose.dev.yml up -d
```

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8000
```

- Health check: <http://localhost:8000/api/health>
- Interactive docs (OpenAPI): <http://localhost:8000/api/docs>

## Configuration

Settings are read from environment variables or a `.env` file (see `../.env.example` and
`app/core/config.py`).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLAlchemy URL, e.g. `postgresql+psycopg://groove:groove@localhost:5432/groove` |
| `PUBLIC_BASE_URL` | Public URL of the app; `https://` makes the session cookie `Secure` and is used for the Discogs OAuth callback |
| `FERNET_KEY` | Key that encrypts members' Discogs tokens |
| `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET` | Discogs application credentials |
| `COVERS_DIR` | Where cover images are stored (default `covers/`) |

Generate a Fernet key:

```bash
uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Project layout

```
app/
  main.py          app factory, CSRF middleware, error handlers, router registration
  core/            config, db, security, crypto, errors (AppError + codes), money, clock
  models/          SQLAlchemy tables per domain (accounts, records, locations, discogs)
  schemas/         Pydantic request/response models per domain
  services/        business rules and queries (records, covers, importer, backup, Discogs, …)
  integrations/    external clients (Discogs: client + mapping)
  api/             deps.py (session/auth dependencies) and routers/ (thin HTTP layer)
alembic/           database migrations
scripts/           export_openapi.py, mock_discogs.py (fake Discogs), reset_e2e_db.py
tests/             pytest suite, mirrors app/
```

## API conventions

- Routers: `auth`, `household`, `invites`, `records`, `locations`, `purchases`, `discogs`, `backup`.
- Session cookie `groove_session` (HttpOnly, SameSite=Lax). Every non-GET request must send the
  header `X-Requested-With: groove` (CSRF protection).
- Errors always look like `{ "code": "...", "detail": "...", "field": "..." }`. `code` is the
  stable contract (see `app/core/errors.py`); clients translate it.
- Amounts are integers in minor units with an ISO currency.
- All data is scoped to the member's household.

## Common tasks

```bash
uv run pytest                                       # tests (create a throwaway groove_test DB)
uv run pytest tests/api/test_records.py -k create   # a subset
uv run ruff check .                                 # lint
uv run alembic revision --autogenerate -m "name"    # new migration
uv run python -m scripts.export_openapi             # write web/src/shared/schemas/openapi.json
```

After changing schemas or endpoints, regenerate the front-end schemas with
`cd ../web && npm run schemas` — `tests/test_openapi_snapshot.py` fails until you do.

## Docker

`Dockerfile` builds a slim image that runs `alembic upgrade head` and then uvicorn on port 8000.
It is started by the root `docker-compose.yml`; covers are stored in the `covers` volume.

See also: [tests/README.md](tests/README.md) · [project README](../README.md)

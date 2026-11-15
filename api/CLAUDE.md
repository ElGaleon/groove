# CLAUDE.md — api/

FastAPI service under `/api`. Python 3.12, managed with **uv** (never pip). Read the root
[CLAUDE.md](../CLAUDE.md) first for cross-cutting rules.

## Commands

```bash
uv sync                                          # install (dev group included)
uv run uvicorn app.main:app --reload --port 8000 # docs at http://localhost:8000/api/docs
uv run pytest                                    # needs dev Postgres (docker-compose.dev.yml)
uv run pytest tests/api/test_records.py -k name  # single test
uv run ruff check .
uv run alembic revision --autogenerate -m "short_name"   # new migration
uv run alembic upgrade head
```

## Layering (top calls down, never up)

```
api/routers/  → parse request, call a service, return a schema. No queries, no business rules.
services/     → business rules, queries, db.commit(). Raise AppError for expected failures.
integrations/ → external HTTP clients (Discogs). No DB access.
models/       → SQLAlchemy tables, one file per domain, re-exported from models/__init__.py.
schemas/      → Pydantic request/response models per domain, re-exported from schemas/__init__.py.
core/         → config, db, security, crypto, errors, money, clock. Imports nothing from above.
```

See the per-folder guides: [app/CLAUDE.md](app/CLAUDE.md), [alembic/CLAUDE.md](alembic/CLAUDE.md),
[tests/CLAUDE.md](tests/CLAUDE.md).

## Rules

- Authenticated endpoints depend on `get_current_user` (`app/api/deps.py`); scope every query to
  `user.household_id`. Soft-deleted records have `deleted_at` set — filter them out.
- Raise `AppError(status, CODE, "English detail", field=...)`; add new codes to
  `app/core/errors.py`. Don't return ad-hoc `HTTPException`s.
- Settings come from env via `app.core.config.get_settings()`; add new ones there and to
  `../.env.example` (name only, no real value).
- After any change to schemas or routes run `cd ../web && npm run schemas`
  (otherwise `tests/test_openapi_snapshot.py` fails).
- Add a pytest for every endpoint or rule you change; follow `tests/` mirroring `app/`.
- Line length 100, ruff rules `E F I B UP`. `Depends/Query/File` in defaults is allowed.
- The Docker image runs `alembic upgrade head` on start: migrations must work on a live DB.

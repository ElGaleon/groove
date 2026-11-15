# CLAUDE.md — Groove

Monorepo for **Groove**, a private web app where one family (a "household") shares a vinyl collection.
Italian is the default UI language; code, identifiers, API paths, routes and comments are English.

| Folder | What | Guide |
|---|---|---|
| `api/` | Python 3.12 · FastAPI · SQLAlchemy 2 · Alembic · PostgreSQL 16 | [api/CLAUDE.md](api/CLAUDE.md) |
| `web/` | React 19 · TypeScript · Vite · Tailwind 4 · shadcn (base-ui) · TanStack Query · zod | [web/CLAUDE.md](web/CLAUDE.md) |
| `openspec/` | Specs and change proposals (spec-driven workflow) | [openspec/CLAUDE.md](openspec/CLAUDE.md) |
| `scripts/` | Backup / restore of the Docker deployment | [scripts/CLAUDE.md](scripts/CLAUDE.md) |

Folder-level `CLAUDE.md` files hold the rules for that area; read them before editing there.
Background on how the app is built (architecture, data model, API, UI design, security, Discogs,
development, deployment) is in [docs/](docs/README.md): read `docs/architecture.md` first when
the task spans both sides or you are new to the codebase.

## Commands (run from the folder shown)

```bash
docker compose -f docker-compose.dev.yml up -d   # root: dev Postgres on 127.0.0.1:5432 (needed by every test suite)
cd api && uv sync && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --port 8000
cd web && npm install && npm run dev             # Vite proxies /api -> :8000
docker compose up --build                        # root: full stack on http://localhost:8080
```

Checks before calling a change done — run the ones for the side you touched:

```bash
cd api && uv run ruff check . && uv run ruff format --check . && uv run pytest
cd web && npm run format:check && npm run lint && npm test && npm run build
cd web && npm run schemas:check                  # after any Pydantic model / endpoint change
cd web && npm run e2e                            # browser flows (slow; when UI flows change)
```

## Cross-cutting rules

- **API contract is shared.** After changing a Pydantic schema or endpoint, run
  `cd web && npm run schemas`: it re-exports `web/src/shared/schemas/openapi.json` from the API
  and regenerates the zod schemas in `web/src/shared/schemas/generated/`.
  `api/tests/test_openapi_snapshot.py` fails until you do. Commit both sides together.
- **Errors** are `{ code, detail, field? }`. `code` is the contract (listed in
  `api/app/core/errors.py`); `detail` is English for logs. The front end translates the `code`.
  Never change the meaning of an existing code.
- **Household isolation.** Every query on member data must be scoped to
  `user.household_id`. A record from another household is "not found", never "forbidden".
- **CSRF.** Every non-GET request needs `X-Requested-With: groove` (the web `api()` helper adds it).
- **Secrets never reach the browser.** Discogs consumer key/secret and member tokens
  (Fernet-encrypted) stay server side; `api/tests/api/test_discogs_secrets.py` enforces it.
  Never commit `.env`; `.env.example` holds names only.
- **Money** is an integer in minor units plus an ISO currency (`api/app/core/money.py`,
  `web/src/shared/lib/money.ts`). No floats for amounts.
- **Time**: use `app.core.clock.utcnow()` (tests patch it), never `datetime.now()`.
- **Migrations only go forward.** Add a new Alembic revision; never edit an applied one.
- **Tests never call the real Discogs.** Use `api/tests/discogs_mock.py` (pytest) or
  `api/scripts/mock_discogs.py` (Playwright).
- Cover images are private household data from Discogs: do not publish them or commit `api/covers/`.

## Workflow

- Non-trivial features go through OpenSpec: `/opsx:propose` → `/opsx:apply` → `/opsx:archive`
  (see [openspec/CLAUDE.md](openspec/CLAUDE.md)). Small fixes can skip it.
- Keep changes scoped; match the surrounding style (short docstrings that say *why*).
- Long command output may be piped through `sqz compress` (see `~/AGENTS.md`).
- Don't touch `backups/`, `.env`, `.idea/`, `web/screenshots/`, `web/test-results/`.

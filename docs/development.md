# Development

How to work on Groove day to day: setup, workflow, checks, tests and recipes for common changes.
Folder rules are in the `CLAUDE.md` files; this page ties them together.

## Setup

```bash
docker compose -f docker-compose.dev.yml up -d      # Postgres on 127.0.0.1:5432 (groove/groove)
cd api && uv sync && uv run alembic upgrade head
cd api && uv run uvicorn app.main:app --reload --port 8000
cd web && npm install && npm run dev                # http://localhost:5173, /api -> :8000
```

Tooling: **uv** for Python (never pip), **npm** for the web, **ruff** and **oxlint** for lint,
**pytest**, **Vitest** and **Playwright** for tests.

## Workflow

1. **Non-trivial features go through OpenSpec** (`openspec/`):
   `/opsx:explore` → `/opsx:propose` → `/opsx:apply` → `/opsx:archive`. A change has
   `proposal.md` (why/what), `design.md` (how), `tasks.md` (checklist) and delta specs.
   Small fixes can skip it.
2. Keep code and specs consistent: if the implementation diverges, update the change
   (`/opsx:update`).
3. Keep changes scoped and match the surrounding style (short docstrings that say *why*).
4. Run the checks for the side you touched before calling it done.

Specs use English structure (`### Requirement:`, `#### Scenario:`, **WHEN/THEN**, SHALL) with
Italian prose. Scenarios should map to tests.

## Checks

| When | Command |
|---|---|
| API changed | `cd api && uv run ruff check . && uv run pytest` |
| Web changed | `cd web && npm run lint && npm test && npm run build` |
| Pydantic model or route changed | `cd web && npm run schemas` then `npm run schemas:check` |
| UI flow changed | `cd web && npm run e2e` |
| Release check | `cd web && npm run e2e:release` |

CI (`.github/workflows/ci.yml`) runs API lint + tests on a Postgres 16 service, web lint + tests +
build + `schemas:check`, dependency audits, image builds and (on `main`) the deploy.

## Testing strategy

| Layer | Tool | Where | Notes |
|---|---|---|---|
| API endpoints & rules | pytest + `TestClient` | `api/tests/api/` | Fresh `groove_test` DB, all migrations, tables truncated per test. Send `HEADERS` on mutating requests. Assert on `code` / `field`. |
| Core & integrations | pytest | `api/tests/core/`, `api/tests/integrations/` | Crypto, migrations from scratch, Discogs client against the fake. |
| Contract | pytest | `api/tests/test_openapi_snapshot.py` | API vs committed `openapi.json`. Fix by running `npm run schemas`, not by editing the test. |
| Components & logic | Vitest + Testing Library (jsdom) | `web/src/**/*.test.ts(x)` | Next to the code. |
| Architecture | Vitest | `web/src/architecture.test.ts` | Import rules between `app`, features, `shared`, `i18n`. |
| Copy | Vitest | `web/src/i18n/no-literal-text.test.ts` | No literal text in JSX or a11y attributes. |
| Browser flows | Playwright (Chromium) | `web/e2e/` | Starts fake Discogs (8020), API (8010, fresh `groove_e2e`) and Vite (5180). Locale `it-IT`. One worker. |

Rules that apply everywhere:

- Never call the real Discogs or a real database from tests.
- Every new endpoint gets a household-isolation test.
- Patch `app.core.clock.utcnow()` for time, never `datetime.now()`.
- Visual snapshots (`*-snapshots/`) are updated only for intended UI changes.

## Recipes

### Add an API endpoint

1. Schema in `api/app/schemas/<domain>.py` (export it from `schemas/__init__.py`).
2. Logic in `api/app/services/<domain>.py`: take `(db, user, …)`, scope to `user.household_id`,
   filter `deleted_at`, commit, raise `AppError` with a code from `core/errors.py`.
3. Thin route in `api/app/api/routers/<domain>.py` with `response_model` and status code;
   register a new router in `app/main.py`.
4. Tests in `api/tests/api/test_<domain>.py`, including another household.
5. `cd web && npm run schemas`; commit API and generated schemas together.

### Add a column or table

1. Edit `api/app/models/<domain>.py`.
2. `cd api && uv run alembic revision --autogenerate -m "what_changed"`; review enums, defaults,
   indexes and backfills (new `NOT NULL` needs a `server_default` or backfill).
3. `uv run alembic upgrade head` and `uv run pytest tests/core/test_migrations.py`.
4. Never edit an applied revision.

### Add an error code

1. Constant in `api/app/core/errors.py` (never reuse or change the meaning of an existing one).
2. Message in `t.errors.codes` in **both** `web/src/i18n/locales/it.ts` and `en.ts`.
3. Test that asserts the `code`.

### Add a page

1. Component in `web/src/features/<feature>/pages/`, exported from the feature's `index.ts`.
2. Address in `web/src/shared/lib/routes.ts` (and `patterns` if it has parameters).
3. Route in `web/src/app/App.tsx` (lazy-load it if it is opened rarely).
4. Texts in both catalogs; check it at phone width.

### Call the API from the web

```ts
const { data } = useQuery({
  queryKey: ['records', params],
  queryFn: ({ signal }) => api(`/api/records?${params}`, { schema: RecordList, signal }),
})
```

- Use generated schemas from `@/shared/schemas` (refined in the feature's `schemas.ts`).
- Show errors with `errorMessage(err, t.…fallback)`.
- After mutating records or locations, call `invalidateCollection(queryClient)`.

### Add a UI primitive

`cd web && npx shadcn add <name>` (lands in `src/shared/ui/`). Keep primitives text-free; put
app-level compositions in `src/shared/components/`.

### Add a setting

Field on `Settings` in `api/app/core/config.py`, name (no value) in `.env.example`, and in
`docker-compose.yml` if the container needs it.

### Add a language

See "Adding a language" in the [root README](../README.md#adding-a-language).

## Don'ts

- Don't touch `backups/`, `.env`, `.idea/`, `web/screenshots/`, `web/test-results/`.
- Don't commit `api/covers/` or any cover image.
- Don't hand-edit `web/src/shared/schemas/generated/`.
- Don't weaken `architecture.test.ts` or `no-literal-text.test.ts` to make code pass.
- Don't run `docker compose down -v` or `scripts/restore.sh` unless explicitly asked.

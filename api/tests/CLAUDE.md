# CLAUDE.md — api/tests/

pytest suite. Run from `api/`: `uv run pytest` (needs dev Postgres on localhost:5432 —
`docker compose -f ../docker-compose.dev.yml up -d`).

- `conftest.py` creates a fresh `groove_test` database, runs all migrations, and truncates every
  table before each test. It also sets fake Discogs credentials, a random `FERNET_KEY` and
  disables the import worker. Env vars are set **before** importing `app` — keep it that way.
- Layout mirrors `app/`: `api/` (endpoint tests via `TestClient`), `core/`, `integrations/`.
- Mutating requests must send `HEADERS` (`X-Requested-With: groove`) from `conftest.py`.
- Discogs: use the fake in `discogs_mock.py`; never hit the network.
- Assert on the error `code` (and `field`), not on `detail` text.
- Cover household isolation: when adding an endpoint, test that another household can't see or
  change the data.
- `test_openapi_snapshot.py` compares the API with `web/src/shared/schemas/openapi.json`; fix by
  running `npm run schemas` in `web/`, not by editing the test.
- `fixtures/prototype_backup.json` is the backup format fixture — update it only on purpose.

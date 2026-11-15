# API tests

pytest suite for the API. Layout mirrors `app/`:

```
tests/
  conftest.py             fresh groove_test database, migrations, per-test truncation, client fixtures
  discogs_mock.py         fake Discogs used by the tests (no network)
  fixtures/               sample backup file
  api/                    endpoint tests (auth, records, purchases, locations, Discogs, backup, …)
  core/                   crypto, migrations
  integrations/discogs/   Discogs client
  test_openapi_snapshot.py  API vs committed OpenAPI document
```

## Running

Start the dev database from the project root, then run from `api/`:

```bash
docker compose -f ../docker-compose.dev.yml up -d
uv run pytest
```

The suite drops and recreates a database named `groove_test` on every run, so it never touches
your dev data. Override the server with `TEST_ADMIN_URL`
(default `postgresql://groove:groove@localhost:5432/postgres`).

## Writing tests

- Send `HEADERS` from `conftest.py` on POST/PATCH/DELETE (CSRF header).
- Assert on the error `code` and `field`, not on the English `detail`.
- For a new endpoint, also test that a member of another household cannot read or change the data.
- Use the fake Discogs; never call the real service.

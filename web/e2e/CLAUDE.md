# CLAUDE.md — web/e2e/

Playwright browser tests. Run from `web/`. Needs the dev Postgres
(`docker compose -f ../docker-compose.dev.yml up -d`) and, once, `npx playwright install chromium`.

```bash
npm run e2e                          # all specs except the release path
npx playwright test e2e/shelf.spec.ts
npm run e2e:release                  # release-path.spec.ts alone, from an empty database
```

`playwright.config.ts` starts everything itself: the fake Discogs (`api/scripts/mock_discogs.py`,
port 8020), the API on port 8010 against a fresh `groove_e2e` database
(`api/scripts/reset_e2e_db.py`), and Vite on port 5180. Workers = 1, not parallel.

- Browser locale is pinned to `it-IT`: selectors read the Italian texts. Prefer roles and
  accessible names (`getByRole`, `getByLabel`) over CSS selectors.
- Never point tests at the real Discogs or a real database.
- `release-path.spec.ts` registers the first member, so it must stay isolated (`E2E_RELEASE=1`).
- Visual snapshots live in `*-snapshots/`; update with `--update-snapshots` only for intended
  UI changes.
- `fixtures/prototype-backup.json` is the backup import fixture.

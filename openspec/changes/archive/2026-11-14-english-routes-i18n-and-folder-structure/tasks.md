# Tasks

## 1. Python restructure (no behaviour change)

- [x] 1.1 Create `core/` (config, db, security, crypto, money, errors) and move the modules with their imports updated; verify `uv run pytest -q` and `ruff check` pass
- [x] 1.2 Split `models.py` into `models/` by domain with `app.models` re-exporting everything; verify `alembic upgrade head` from scratch, `alembic check` shows no drift, and `pytest` passes
- [x] 1.3 Split `schemas.py` into `schemas/` by domain and update imports; verify `pytest` and the OpenAPI document (`/api/openapi.json`) is unchanged in paths and models
- [x] 1.4 Move the Discogs HTTP client and mapping to `integrations/discogs/` and keep the rate limiter shared; verify the Discogs client, connect, search, import and secrets tests pass
- [x] 1.5 Extract the business rules out of the routers into `services/` (records, covers, importer, backup, Discogs connection) so routers only parse, call and return; verify `pytest` passes and no router imports `app.models` queries beyond dependencies
- [x] 1.6 Move routers to `api/routers/`, register them in `main.py`, and mirror the packages under `tests/`; verify `pytest`, `ruff`, `docker compose build api` and a started API answering `/api/health`

## 2. Web restructure (no behaviour change)

- [x] 2.1 Create `app/` (main, router table, providers, Layout, RequireAuth) and `shared/` (ui, hooks, lib, ResponsiveModal, Field, Notice, Page) and move files; verify `tsc -b`, `oxlint`, `vitest`
- [x] 2.2 Move code into `features/` one feature at a time (auth, collection, records, shelf, places, family, settings, discogs), each with an `index.ts` public surface; verify `tsc -b` and `vitest` after each feature
- [x] 2.3 Add an import rule check (features import others only through `index.ts`; `shared` imports no feature) as a test or lint rule; verify it fails on a deliberate violation and passes on the tree
- [x] 2.4 Verify the build (`npm run build`), `docker compose build web`, and the full e2e suite on the moved tree

## 3. English addresses

- [x] 3.1 Add `app/routes.ts` with typed builders and replace every path literal in components and strings; verify with a source search that no Italian path remains
- [x] 3.2 Rename the routes and add the `legacyRedirects` table (params and query kept); verify with component tests that each old address lands on the new one, including `/invito/:token` joining a family
- [x] 3.3 Point the Discogs callback redirect and invitation links to the English addresses; verify the API tests for `/settings?discogs=` and a browser test of an invite link
- [x] 3.4 Audit API paths, query parameters, JSON keys and codes for Italian words (script over the OpenAPI document) and rename any found, accepting the old name where stored; verify with the audit test
- [x] 3.5 Update e2e specs and README to the new addresses; verify the e2e suite passes

## 4. API error codes

- [x] 4.1 Add `AppError` and the single handler, with the codes module and English `detail`; keep `CodedHTTPException` as an alias until all raises are converted; verify unit tests for the response shape
- [x] 4.2 Convert every `HTTPException` and coded raise (auth, invites, household, records, locations, purchases, discogs, backup) to `AppError` with a code; verify that API tests assert `code` and none asserts Italian text
- [x] 4.3 Map Pydantic validation errors to `code` + `field`; verify tests for missing title, bad year, bad currency and an invalid backup file
- [x] 4.4 Make the client `ApiError`/`errorMessage` read `code` and `field`; verify with vitest including the unknown-code fallback

## 5. i18n foundation and migration

- [x] 5.1 Add the `i18n/` engine (plain TypeScript, no library: active-language catalog with Italian fallback, detection member > localStorage > browser > `it`, `lang` on `<html>`, Intl helpers) and a provider that re-renders the app on a switch; verify with unit tests for detection order and fallback
- [x] 5.2 Move `strings.ts` into the Italian catalog `i18n/locales/it.ts` (sections per feature plus `errors`) whose shape is the type every language must follow; verify `tsc -b` and the parity test
- [x] 5.3 Migrate auth and family screens to `useTranslation`; verify their tests and a browser check in Italian
- [x] 5.4 Migrate the collection (filters, summary, views), records (dialog, detail, Discogs step, refresh) and settings screens; verify unit tests and the browser tests pass in Italian
- [x] 5.5 Migrate places (map, locations) and the shelf (including the canvas back cover and its redraw on language change); verify the shelf and map browser tests
- [x] 5.6 Write the English catalogs for all namespaces; verify a test that Italian and English have the same keys and the same interpolation placeholders
- [x] 5.7 Replace `it-IT` hard-coding in money and date formatting with the active locale; verify unit tests for both languages (`1.234,50 €` vs `€1,234.50`)
- [x] 5.8 Replace the literal-text source check with one that covers the catalogs rule (no words in JSX or visible attributes, including `features/**`); verify it passes and fails on a planted literal

## 6. Member language

- [x] 6.1 Add the nullable `users.language` column with migration (and downgrade) and expose it in `/api/auth/me`; verify the migration test and an API test
- [x] 6.2 Accept `language` (`it` | `en`) in `PATCH /api/auth/preferences` with validation; verify API tests for valid, invalid and clearing
- [x] 6.3 Add one `LanguageSelect` used in Settings, as a sub-menu of the account menu and on the auth screens, applying the language live and saving it to the server when signed in; verify a browser test that switching from the menu changes the screen without reload, Settings shows the same language, and the choice persists after sign-out and in a new browser context
- [x] 6.4 Use the browser language before sign-in; verify a browser test with an English `Accept-Language` on `/sign-in`

## 7. Documentation and release check

- [x] 7.1 Update README (addresses and redirects, languages, how to add a language, folder structure of `api/` and `web/`); verify by following the "add a language" steps with a throwaway locale
- [x] 7.2 Run the whole verification: `pytest`, `ruff`, `vitest`, `tsc -b`, `oxlint`, `npm run build`, `docker compose up --build`, e2e suite and the release-path test; verify all pass on a clean checkout
- [x] 7.3 Update the OpenSpec change `adopt-shadcn-frontend-with-purchase-data` and `family-vinyl-collection-app` task texts that quote Italian addresses or file paths; verify with `openspec validate --strict` on all changes

## Workflow follow-up

- Remove the Italian redirects after one release cycle.
- Archive the change after review.

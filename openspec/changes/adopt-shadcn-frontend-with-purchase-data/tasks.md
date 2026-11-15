# Tasks

## 1. API data model

- [ ] 1.1 Add the Alembic migration (record version/purchase/value columns, `locations` table) and models; verify `alembic upgrade head` from scratch and `downgrade -1` in a test database
- [ ] 1.2 Extend schemas and `record_out` with the new fields and validation (non-negative amounts, channel, location of the same household); verify with API tests on create/update/validation errors
- [ ] 1.3 Make duplicate detection version-aware (catalogue number rule) and cover it with tests
- [ ] 1.4 Extend filters and options (country, format, year) and verify with tests on combined filters

## 2. API locations, summary and places

- [ ] 2.1 Implement `/api/locations` CRUD with kind/address/URL validation, household scoping and search by name; verify with tests including another household
- [ ] 2.2 Implement the in-use 409 on delete and `POST /api/locations/{id}/reassign`; verify with tests
- [ ] 2.3 Implement `GET /api/records/summary` (totals per currency, left-out count, same filters as the list); verify with a test beyond one page
- [ ] 2.4 Implement `GET /api/purchases/places?year=` (mapped, unmapped, online, per channel for `both`); verify with tests

## 3. API Discogs

- [ ] 3.1 Extend `/api/discogs/search` with `page`, barcode detection, catalogue number, country and paging fields; verify with mocked-Discogs tests
- [ ] 3.2 Add `GET /api/discogs/releases/{id}/value` and `POST /api/records/{id}/refresh-value` (manual value is never overwritten); verify with mocked-Discogs tests including no copies, 401 and 429
- [ ] 3.3 Keep the importer filling catalogue number when Discogs provides it; verify with the import test

## 4. Web foundation

- [ ] 4.1 Install the shadcn components needed (map, field, command, popover, tabs, drawer, sheet, dropdown-menu, navigation-menu, toggle-group, select, switch, sonner, table, scroll-area) and react-hook-form + zod; verify `npm run build`
- [ ] 4.2 Add data hooks (records, summary, options, locations, places, discogs search/value) on react-query with money helpers and tests for money and filters; verify with vitest
- [ ] 4.3 Build the new shell (header, centred nav, account menu, hamburger sheet) and routes; verify in the browser on desktop and 375 px

## 5. Web collection

- [ ] 5.1 Build the Collection page: summary, toolbar, views (shelf, grid, list), inline filters and phone bottom sheet; verify in the browser on both sizes
- [ ] 5.2 Build the record dialog (sections Disc, Version, Purchase, Value) with location picker and duplicate warning, and the record detail dialog with edit/delete/undo; verify with component tests and the browser
- [ ] 5.3 Build the Discogs search-first step (live search, barcode, paging, owned markers, errors, Enter by hand) and value import; verify with tests of the hook and a browser run against the mock Discogs

## 6. Web map, family and settings

- [ ] 6.1 Build the Map page (shadcn map, numbered markers, tooltip, detail, online list, no-position list, year filter, locations management with reassign-and-delete, point picker with geocoding); verify in the browser and by keyboard
- [ ] 6.2 Restyle Family (view, invites), Settings (Discogs status and connection, import link) and the auth screens into the new shell without changing their behaviour; verify the existing tests still pass
- [ ] 6.3 Add refresh-values dialog (summary of updated, unchanged, to confirm, failed); verify with a test and the browser

## 7. Compose and end-to-end

- [ ] 7.1 Confirm the web image builds the new front end and `docker compose up --build` serves it with the API and the database; verify a clean build
- [ ] 7.2 Smoke test the full stack: register, add a record with version and price, create a location, see it on the map, connect Discogs (mock), search and add from Discogs; verify in the browser
- [ ] 7.3 Update `README.md` (new features, map, Discogs value) and run all tests (`pytest`, `vitest`) and the build

## Workflow follow-up

- Archive the change after review.

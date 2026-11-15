# Design

## Context

Observed today (see proposal.md for motivation):

- **API**: `api/app` is flat: `main.py`, `config.py`, `db.py`, `auth.py`, `security.py`, `crypto.py`, `errors.py`, `models.py` (all tables, 250 lines), `schemas.py` (36 classes, 360 lines), `records.py` (helpers), `discogs.py` (HTTP client), `discogs_service.py`, `importer.py`, `covers.py`, `money.py`, plus `routers/` with the big ones `records.py` (480), `discogs.py` (480), `backup.py` (350). Business rules (duplicates, purchase and value application, import, backup mapping) sit inside routers. Paths are already English (`/api/records`, `/api/purchases/places`…). Errors are `HTTPException(detail="<Italian sentence>")` (43 places) or `CodedHTTPException(status, Italian detail, code)`; the validation handler builds an Italian sentence. Tests live flat in `api/tests` and import `app.*`.
- **Web**: Vite + React 19 + react-router, `src/` with `components` (30+ files, mixed features), `pages`, `shelf` (3D module), `lib`, `hooks`, `components/ui` (shadcn), loose `filters.ts`, `records.ts`, `discogs.ts`, `locations.ts`, `api.ts`, `auth*.ts(x)`. All text is in `strings.ts` (one object, about 446 lines), read as `t.xxx`; some formatting hard-codes `it-IT` (`lib/money.ts`, `RecordDetail`). Routes are Italian (`/accedi`, `/dischi/:id`…) and appear as literals in about 15 places and in e2e specs. A test scans `.tsx` for literal Italian text.

Constraints: no behaviour change in the restructure; keep Alembic revisions and the Docker build (`api/Dockerfile` copies `app/`; `web/Dockerfile` builds `web/`) working; tests stay green after every group.

## Goals / Non-Goals

**Goals:**
- Feature-oriented layout on both sides, where a feature's code, types, API calls, texts and tests sit together.
- English addresses with redirects; a single place defines every route.
- Italian + English with a per-member choice stored on the server; API errors as codes.

**Non-Goals:**
- New features, visual changes, more languages, translating user data, changing API versions or auth.

## Decisions

### 1. Python layout: core / models / schemas / services / integrations / api
```
api/app/
  main.py                  # app factory, middleware, router registration
  core/                    # config.py, db.py, security.py, crypto.py, errors.py, money.py, i18n-free helpers
  models/                  # base.py, accounts.py (Household, User, Invite, Session, LoginAttempt), records.py, locations.py, discogs.py (connection, pending, import job)
  schemas/                 # same split: auth.py, household.py, records.py, locations.py, purchases.py, discogs.py, backup.py
  services/                # records.py (filters, duplicates, purchase/value), covers.py, importer.py, backup.py, discogs_connection.py
  integrations/discogs/    # client.py (HTTP, OAuth, rate limiter), mapping.py
  api/routers/             # thin: parse input, call a service, return a schema (auth, invites, household, records, locations, purchases, discogs, backup)
api/tests/                 # mirrors the packages: tests/api/, tests/services/, tests/integrations/
```
*Why:* routers of 480 lines mix HTTP, rules and persistence; the split makes rules testable without HTTP and keeps imports one-directional (`api → services → models/core`, `integrations` only used by services). *Alternatives:* keep flat and only split `models.py`/`schemas.py` (smaller win, routers stay fat); full hexagonal ports and adapters (heavier than a family app needs).
Models are re-exported from `app.models` (`__init__`) so Alembic's `target_metadata` and existing imports keep working; moves are done with `git mv`-style steps and import rewrites, one domain at a time, with the full API test suite run after each.

### 2. Web layout: app / features / shared / i18n
```
web/src/
  app/            # main.tsx, App.tsx (routes table), providers (query, auth, i18n), Layout, RequireAuth, routes.ts
  features/
    auth/         # pages (SignIn, Register, Join), auth context/provider, api
    collection/   # pages (Home), components (FilterBar, RecordViews, CollectionSummary, Cover, Delta), hooks (useFilters, useRecordPages), api, filters.ts
    records/      # RecordDialog(+Provider), RecordDetail, DiscogsSearchStep, RefreshDialog, api, types, money rules
    shelf/        # the 3D module and ShelfView, ShelfHoverCard
    places/       # Purchases page, PurchaseMaps, LocationDialog/Picker, locations api, geocode
    family/       # Family page, invites, members api
    settings/     # Settings dialog, BackupSection, currency/language hooks
    discogs/      # status hook, import page, connect
  shared/
    ui/           # shadcn components (unchanged), ResponsiveModal, Field, Notice, Page
    hooks/        # use-mobile
    lib/          # api client (ApiError), money, utils, queries
  i18n/           # index.ts (setup), locales/{it,en}/<namespace>.json, format.ts (Intl helpers)
```
Each feature exposes its pages and public hooks through an `index.ts`; features import each other only through those files, and `shared` never imports from `features`. A path alias `@/features/...` is already available through `@/`. *Why:* components, hooks and API calls of one screen currently sit in four folders; the grouping matches how the specs are organised. *Alternative:* type-based folders as today (rejected: the reason for this change).

### 3. Routes: one table, English names, redirect layer
`app/routes.ts` exports typed path builders (`routes.record(id)`, `routes.newRecord`, …) and the router uses them; components never write path literals. A `legacyRedirects` array maps the old Italian paths to the new ones with `<Navigate replace>` preserving params and `search`. The API callback for Discogs redirects to `/settings?discogs=…` (the API builds it from one constant). Redirects stay for one release cycle and are listed in the README so they can be removed later. The e2e specs use the builders' values.

### 4. i18n with our own typed catalogs (no library)
*Decision changed during implementation:* instead of `i18next`/`react-i18next`, the app uses two typed TypeScript catalogs, `i18n/locales/it.ts` (default, complete, and the shape every language must follow through the `Catalog` type) and `en.ts`. `t` is a proxy to the merged active catalog (Italian underneath, so a missing text falls back to Italian and never shows a key name); plurals and interpolation are plain functions in the catalog (`count: (n) => …`), as `strings.ts` already did. `LanguageProvider` re-renders the tree on a language change by keying it on the language. A language is added by one file plus three registrations that the compiler enforces (see the README). *Why:* two small languages, no lazy loading, no plural rules beyond one/other; the catalog type gives compile-time key checking that string keys of a library do not, and removes a dependency and a second way to write each text. A test keeps the same keys and placeholders in both languages and another (`no-literal-text.test.ts`) keeps words out of JSX and visible attributes. *Alternatives:* `react-i18next` (the original plan: JSON namespaces, `useTranslation('<ns>')`, `fallbackLng`); FormatJS/ICU (heavier, same result here).
**Language detection and storage:** active language = member preference from `/api/auth/me` (`language`), else `localStorage` (set on explicit choice before sign-in), else `navigator.language`, else `it`. `PATCH /api/auth/preferences` accepts `language` (`it` | `en`); one `LanguageSelect` component is used in the Settings dialog (next to the currency one) and in the account menu (a sub-menu with the two languages and a check on the current one); on the auth screens a compact version sits in the card footer. All three call the same hook, which updates the active catalog, `localStorage` and, when signed in, the server. The root element's `lang` attribute follows the language.
**Formatting:** `i18n/format.ts` provides `formatMoney`, `formatDate`, `formatNumber` taking the active locale (`it-IT`, `en-GB`); `lib/money` and `RecordDetail` stop hard-coding `it-IT`. Stored values do not change.
**Back cover of the 3D shelf:** its canvas texts come from the same catalogs (the shelf module already receives labels as options) and are redrawn when the language changes.

### 5. API errors as codes
A single `AppError(status, code, detail, field=None)` replaces `HTTPException` and `CodedHTTPException`; one handler returns `{"code": …, "detail": <English>, "field": …}`. The validation handler maps Pydantic error types to codes (`required`, `invalid`, `too_short`, …) with the field name. Codes are listed in one module (`core/errors.py`) as constants and documented in the spec. The client's `ApiError` keeps `code`, `field`, `status`; `errorMessage(error)` translates `errors:<code>` (field-specific `errors:<field>.<code>` first) and falls back to `errors:generic`. The `detail` text is English only; tests assert `code`. Existing codes (`duplicate`, `in_use`, `discogs_*`, `invalid_backup`…) are kept. *Alternative:* send `Accept-Language` and translate on the server (two catalogs to maintain in two languages, cannot translate texts built by the client).

### 6. Order of work and safety net
Python restructure first (isolated, covered by 175 tests), then the web restructure (covered by 32 unit tests and the e2e specs), then routes, error codes, i18n foundation, string migration feature by feature, language preference. Each group ends green: `pytest`, `ruff`, `vitest`, `tsc -b`, `oxlint`, build, and the e2e suite (with `E2E_PG_PORT` when the shared dev database is unstable). Moves and content changes are never mixed in the same step so diffs stay reviewable.

## Risks / Trade-offs

- [Large move breaks imports or hides regressions] → move one package or feature at a time, run the full suite after each, no logic edits in move steps.
- [Alembic and Docker depend on module paths (`app.models`, `app/` copy)] → re-export models from `app.models`, keep `alembic/env.py` importing `app.models`, run `alembic upgrade head` from scratch and `docker compose build` at the end of the Python group.
- [Old invitation links and bookmarks] → permanent-for-now redirects, covered by tests, listed in the README for later removal.
- [Missing translations] → fallback to Italian, plus a test that every key of the Italian catalog exists in English and the reverse.
- [Error `detail` language change breaks a client] → the only client is this web app; it is updated in the same change; `code` is the contract.
- [Two sessions editing the same tree] → do the restructure in one uninterrupted stretch per side and rebase other work first.

## Migration Plan

1. Alembic: add nullable `users.language` (`it`/`en`), no backfill (null means "not chosen yet"); downgrade drops it.
2. Deploy API then web from the same compose build (`APP_VERSION`). The API accepts both old and new bodies where a field was renamed.
3. Rollback: previous images by `APP_VERSION`; the migration is additive.

## Open Questions

- How long to keep the Italian redirects (proposed: until the next archive of this change's follow-up; removal is a one-line deletion of `legacyRedirects`).

# Proposal

## Why

The app speaks Italian everywhere, including places that are not text for the reader: browser addresses (`/accedi`, `/dischi/nuovo`, `/impostazioni`), API error messages and code comments' vocabulary. Every user-facing string is hard-coded in one 446-line `strings.ts`, so the app cannot be offered in another language, and code and files have grown without a structure (about 3,700 Python lines in a flat `app/` plus five very large routers, and 60+ React files split only into `components`, `pages` and loose modules). Family members and future contributors need an English-addressed app that can be shown in Italian or English, and a layout that makes each feature easy to find.

## What Changes

- **English addresses.** Every browser address becomes English (`/sign-in`, `/register`, `/invite/:token`, `/records/new`, `/records/:id`, `/map`, `/family`, `/settings`, `/import`). The old Italian addresses keep working for a transition period by redirecting to the new ones (invitation links already sent must not break). The API paths are audited: they are already English; any Italian path segment, query value or JSON key found is renamed (with the old name accepted where a client could have stored it).
- **Translations.** The React app gets an i18n layer with Italian (default) and English catalogs, one section per feature, replacing `strings.ts`. The member chooses the language in Settings; the choice is saved on the server and follows them across devices; before sign-in the browser language is used. Dates, numbers and money are formatted for the active language.
- **API errors as codes.** The API stops sending Italian sentences as the contract: every error carries a stable English `code` (and an English `detail` for logs and developers); the client turns codes into translated messages. Field errors carry the field name and a code.
- **Folder structure.** Python `api/app` is reorganised into `core/` (config, db, security, crypto, errors), `models/` and `schemas/` split by domain, `services/` (business rules now living inside routers), `integrations/discogs/` and `api/routers/`; React `web/src` is reorganised into `app/` (router, providers, layout), `features/<name>/` (components, hooks, api, pages, tests), `shared/` (ui kit, hooks, lib) and `i18n/`. Behaviour does not change.
- **BREAKING:** public browser addresses change (old ones redirect); API error `detail` text changes from Italian to English (clients must use `code`). No database change except one nullable `users.language` column.

## Capabilities

### New Capabilities

- `english-addresses`: the set of browser addresses, their English names, redirects from the former Italian ones, and the API path naming rule.
- `localization`: languages offered, default and fallback, per-member choice stored on the server, formatting of dates, numbers and money, and the rule that no user-facing text is hard-coded in components.
- `api-error-codes`: the error response contract (stable `code`, English `detail`, optional `field`) and the translation of codes by the client.

### Modified Capabilities

<!-- None: the capabilities these touch (family-sharing, collection-catalog, discogs-integration, collection-views, app-shell) live in changes that are not archived yet; this change adds cross-cutting contracts beside them. -->

## Impact

- **API** (`api/app/**`, `api/tests/**`): files moved and imports rewritten; error responses reworked (`HTTPException` details and the validation handler); `users.language` column + migration + `PATCH /api/auth/preferences` accepts `language`; tests updated to assert `code`s.
- **Web** (`web/src/**`, `web/e2e/**`): every file moves; routes renamed; an `i18n/` module with typed Italian and English catalogs (no library); all components read texts through `t`; e2e specs updated to the new addresses and to both languages where relevant.
- **Docs and ops**: README (addresses, languages, structure), Discogs callback now redirects to `/settings?discogs=…`; invitation links produced after the change use `/invite/:token`.
- **Out of scope**: translating covers, Discogs data or user-entered text; languages beyond Italian and English; right-to-left layouts; changing API versions or auth; behaviour changes of any feature.

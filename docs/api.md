# API

FastAPI service mounted under `/api`. Interactive docs at `/api/docs` when `API_DOCS_ENABLED` is
true (default in local dev, **off** in Docker Compose). The committed OpenAPI snapshot is
`web/src/shared/schemas/openapi.json`.

## Conventions

- Paths and JSON fields are English, `snake_case`. Routers use
  `APIRouter(prefix="/api/<plural>")`, an explicit `response_model` and explicit status codes
  for `201` / `202` / `204`.
- Collection routes (`/records/options`, `/records/summary`, …) are declared **before**
  `/{id}` routes.
- Everything except the public auth/invite/reset checks requires a session
  (`Depends(get_current_user)`); see [security.md](security.md).
- Every non-GET request must send `X-Requested-With: groove`, or it is refused with
  `403 csrf_header_missing`.
- Lists are paged with `offset` / `limit` and answer `{ items, total, offset, limit }`.
- Money fields are `{ amount_minor, currency }`-style integers in minor units.

## Endpoint map

### Health

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | `{ "status": "ok" }`; used by the Docker health check |

### Auth — `routers/auth.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/auth/status` | Public. Whether the app still needs its first member (setup). |
| POST | `/api/auth/register` | Public. First member creates the household; later members need an invite token. Sets the session cookie. |
| POST | `/api/auth/login` | Public. Rate limited per e-mail (`too_many_attempts`, 429). |
| POST | `/api/auth/logout` | Ends the current session. |
| GET | `/api/auth/me` | The signed-in member. |
| PATCH | `/api/auth/preferences` | `language`, `default_currency` (only sent fields change). |
| POST | `/api/auth/password` | Change password (needs the current one). |
| GET | `/api/auth/password-reset/check` | Public. Is a reset link still usable? |
| POST | `/api/auth/password-reset` | Public. Set a new password with a reset token; ends all other sessions, signs in. |

### Household and invites — `routers/household.py`, `routers/invites.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/household` | Household name and members. |
| POST | `/api/household/leave` | Leave; records become shared. The last member must confirm deleting the collection. |
| POST | `/api/household/members/{member_id}/password-reset` | Create a one-time reset link for **another** member. |
| POST | `/api/invites` | Create an invite; the token is returned once. |
| GET | `/api/invites` | Invites with their status. |
| GET | `/api/invites/check` | Public. Is an invite token valid? |
| DELETE | `/api/invites/{invite_id}` | Revoke. |

### Records — `routers/records.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/records` | Filters `q, owner, genre, decade, label, country, format, year, discogs`; `sort` (`title|artist|year|added`), `order`, `offset`, `limit` (≤ 100). |
| GET | `/api/records/options` | Values for the filter controls, from what is in the collection. |
| GET | `/api/records/summary` | Spent / value / difference per currency over **all** matches. |
| GET | `/api/records/random` | `count` random records following the filters, avoiding `exclude` ids (3D shelf). |
| POST | `/api/records` | Create. `409 duplicate` with the `existing` record if it looks like one already there. |
| GET | `/api/records/{id}` | Read. |
| PATCH | `/api/records/{id}` | Update. |
| DELETE | `/api/records/{id}` | Soft delete. |
| POST | `/api/records/{id}/restore` | Undo a delete within `undo_seconds`, else `undo_expired`. |
| POST | `/api/records/{id}/refresh-value` | Discogs market value. Answers `status`: `updated`, `unchanged`, `no_value` or `proposal` (manual value kept; pass `replace_manual=true` to overwrite). |
| POST | `/api/records/{id}/cover` | Upload front cover (JPEG/PNG/WebP, ≤ 5 MB). |
| POST | `/api/records/{id}/back-cover` | Upload back cover. |
| GET | `/api/records/{id}/cover` | Image, `ETag` + private caching. |
| GET | `/api/records/{id}/back-cover` | Image. |

### Places — `routers/locations.py`, `routers/purchases.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/locations` | Household places. |
| POST | `/api/locations` | Create (`kind`: `physical`, `online`, `both`). |
| PATCH | `/api/locations/{id}` | Update. |
| POST | `/api/locations/{id}/reassign` | Move its records to another place. |
| DELETE | `/api/locations/{id}` | Delete; `409 in_use` (with `count`) if records still use it. |
| GET | `/api/purchases/places` | Map data: physical places with coordinates, without, and online, optionally for one `year`. |

### Discogs — `routers/discogs.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/discogs/status` | Configured? Connected? Username, status. Never tokens. |
| POST | `/api/discogs/connect` | Start OAuth; returns the Discogs URL to open. |
| GET | `/api/discogs/callback` | Discogs redirects the browser here; ends with a redirect to Settings. |
| DELETE | `/api/discogs/connection` | Disconnect (imported records stay). |
| POST | `/api/discogs/import` | Queue an import (`202`); one at a time per member. |
| GET | `/api/discogs/import/latest` | Progress of the latest import. |
| GET | `/api/discogs/search` | Search releases (`q`, `page`), marking ones already in the collection. |
| POST | `/api/discogs/records/{id}/cover` | Store a Discogs cover on a record (Discogs hosts only). |
| GET | `/api/discogs/records/{id}/tracklist` | Fetched once, then cached on the record. |
| GET | `/api/discogs/releases/{release_id}/value` | Market value of a release (used when adding). |

### Backup — `routers/backup.py`

| Method | Path | Notes |
|---|---|---|
| GET | `/api/backup` | Download the collection as JSON (no covers, no tokens, owners by display name). |
| POST | `/api/backup/import` | Add records and places from a backup file; nothing is deleted. Max ~10 MB. |

## Error contract

Every error is JSON:

```json
{ "code": "record_not_found", "detail": "Record not found", "field": "title" }
```

- `code` — stable, machine-readable, **the contract**. Never change the meaning of an existing
  code. Constants live in `api/app/core/errors.py`.
- `detail` — English, for developers and logs. The UI never shows it.
- `field` — for validation errors, the first offending field (`fields` lists all).
- Extra keys are allowed when the client needs them (`existing` for `duplicate`, `count` for
  `in_use`, `min_length` for `password_too_short`).

Raise errors with `AppError(status, code, "detail", field=..., **extra)`; don't return ad-hoc
`HTTPException`s. Pydantic validation errors are mapped to `required` or `invalid` + `field`
(422).

On the web side, `errorMessage(err, fallback)` in `web/src/shared/lib/api.ts` translates the code
through `t.errors.codes[code]` (and `t.errors.fields[field]`). **Adding a code means adding its
message to both `it.ts` and `en.ts`.**

Codes currently in use, by area:

| Area | Codes |
|---|---|
| Auth & session | `not_authenticated`, `csrf_header_missing`, `invalid_credentials`, `too_many_attempts`, `email_taken`, `password_too_short`, `wrong_current_password` |
| Invites & resets | `invite_required`, `invite_invalid`, `invite_not_found`, `reset_invalid`, `reset_not_allowed` |
| Household | `last_member_confirmation_required` |
| Records | `record_not_found`, `duplicate`, `undo_expired`, `invalid_owner`, `invalid_owner_filter`, `invalid_location`, `invalid_exclude_list`, `not_linked_to_discogs` |
| Covers | `no_cover`, `no_back_cover`, `image_too_large`, `unsupported_image_format`, `invalid_image`, `bad_cover_url` |
| Places | `location_not_found`, `in_use`, `choose_different_location` |
| Backup | `invalid_backup`, `backup_too_large` |
| Discogs | `discogs_not_configured`, `discogs_not_connected`, `discogs_expired`, `discogs_bad_app_credentials`, `discogs_error` |
| Validation | `required`, `invalid` |
| Client only | `response_shape` (the response did not match the zod schema) |

## Schema pipeline

After changing a Pydantic model or a route:

```bash
cd web && npm run schemas
```

This runs `api/scripts/export_openapi.py`, writes `web/src/shared/schemas/openapi.json` and
regenerates `web/src/shared/schemas/generated/zod.gen.ts`. Feature `schemas.ts` files build on
the generated schemas. `api/tests/test_openapi_snapshot.py` and `npm run schemas:check` (CI)
fail until both are up to date. Never edit `generated/` by hand.

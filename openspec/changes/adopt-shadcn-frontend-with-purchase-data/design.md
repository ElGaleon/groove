# Design

## Context

The repository already has a FastAPI + SQLAlchemy + Alembic API with sessions, households, invites, records, server-side Discogs OAuth (per-member connection, search, collection import, covers) and a React 19 + Vite + Tailwind + shadcn (base-nova, Base UI) front end with react-query and react-router. The new front end was prototyped elsewhere with browser-only storage; its UI (header, views, filters, form, map) is reused here while its data layer is replaced by the API. See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals:**
- One app: the new UI on top of the existing auth, family, invites, Discogs and covers.
- Purchase and value data, locations and the map served by the API, with totals over the whole collection.
- `docker compose up --build` works with the new front end.

**Non-Goals:**
- Migrating the prototype's browser data; changing the 3D shelf; currency conversion; importing prices from Discogs collections.

## Decisions

### 1. Host app: the existing `web/`, new shell and pages
Keep `web/` (auth, react-query, router, family/invite/settings/import pages, shelf) and replace the layout, home, add/edit and detail screens with the new UI. *Why:* auth, invites and Discogs OAuth flows already work and have tests; rewriting them in a prototype tree would duplicate them. *Alternative:* copy the prototype and port the auth screens into it: more risk, no benefit.

### 2. Record columns instead of a purchases table
Add nullable columns to `records`: `catalog_no`, `country`, `purchase_amount_minor`, `purchase_currency`, `purchase_date`, `purchase_location_id` (FK, `ON DELETE RESTRICT`), `purchase_channel`, `value_amount_minor`, `value_currency`, `value_source`, `value_measure`, `value_fetched_at`, `value_num_for_sale`. *Why:* one purchase per record, simpler queries and filters. *Alternative:* a `purchases` table (only useful with several purchases per record, not required).

### 3. Money as integer minor units + ISO currency
Same as the prototype: no floats; gain/loss and totals only within one currency. Fraction digits come from `Intl` on the client; the API stores and sums integers.

### 4. Server-side aggregates
`GET /api/records/summary` (same filters as the list) returns totals per currency and the count left out; `GET /api/purchases/places?year=` returns the three groups. *Why:* the list is paginated (48), so the client cannot compute them. Aggregation in SQL with `GROUP BY`.

### 5. Locations are household resources
Table `locations` (`household_id`, `name`, `kind`, `address`, `lat`, `lng`, `url`) with CRUD under `/api/locations`; `DELETE` answers 409 `{code: "in_use", count}` when referenced; `POST /api/locations/{id}/reassign` moves purchases then the member deletes. Validation of kind/address/URL mirrors the prototype's schema, in Pydantic.

### 6. Discogs extended on the server
`/api/discogs/search` gains `page` and barcode detection (8-14 digits → `barcode=`), and returns `catalog_no`, `country`, `page`, `pages`. New `GET /api/discogs/releases/{id}/value?currency=` calls `/marketplace/stats/{id}` with the member's OAuth token, rate-limited by the existing limiter, returning `{lowest_price, currency, num_for_sale}`. The client builds the `value` object (source `discogs`). *Why:* secrets stay on the server; the prototype's browser token is not used. Bulk refresh is a client loop over a per-record endpoint `POST /api/records/{id}/refresh-value` that applies the manual-value rule server-side and returns `updated | unchanged | proposal | failed`.

### 7. Geocoding from the browser
Address → coordinates via Nominatim from the browser (one request at a time), since it needs no secret and only the address is sent. *Alternative:* proxy it through the API (extra moving part, no privacy gain).

### 8. Map with `@shadcn-map/map`
The registry component (Leaflet + OpenFreeMap vector tiles) wrapped in two small components: purchase map (numbered markers, tooltip, keyboard) and point picker. Map and its dependencies load lazily (own chunk).

### 9. Front-end structure
Pages: Collection (views + filters + summary), Map, Family, Settings, Import, sign-in/register/join (existing). Dialog/Drawer `ResponsiveModal` for forms. Filters and view state stay in the URL as today (`useFilters`), extended with country, format and year. Strings stay in `strings.ts`.

### 10. Compose
No new service. The web Dockerfile already builds `npm run build` and serves with Caddy proxying `/api`; keep it and verify a clean build and a smoke run.

## Risks / Trade-offs

- [Discogs marketplace stats need an authorised member] → the value endpoint requires an active connection and returns a clear error otherwise; manual value always works.
- [Rate limits on bulk value refresh] → per-record calls through the shared limiter; the client stops on 429 and reports failed items.
- [Nominatim policy] → one request at a time, only on explicit "Find", result cached in the saved location.
- [Large front-end rewrite] → keep route paths (now English, with redirects from the Italian ones: see `english-routes-i18n-and-folder-structure`) and the existing tests green where behaviour is unchanged; add tests for new behaviour.
- [Prototype data stays in browsers] → out of scope; backup export in the prototype is not carried over.

## Migration Plan

1. Alembic migration adds columns and `locations` (nullable, no backfill; downgrade drops them).
2. Deploy API then web (same compose build). Rollback: previous images by `APP_VERSION`; the migration is additive.

## Open Questions

- Default currency (EUR proposed, stored per browser in settings).

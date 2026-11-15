# Proposal

## Why

The family wants a cleaner, mobile-first front end (clear header, account menu, hamburger on phones, grid/list/shelf views, readable filters) and richer records: the **version** (pressing) of each vinyl, what it was **bought for**, what it is **worth now**, and **where it was bought**, with a map of purchases. A prototype of this front end exists (`time-sheet-ai-agent/prototypes/editions-app`) but keeps its data only in the browser, so it has no sign-in, no family, no invites and no Discogs link. The product must be one app, on the existing API, started with `docker compose`.

## What Changes

- Records gain version details (catalogue number, country, on top of the existing label, year, format and note), a purchase (price, currency, date, place, channel) and a current value (manual, or taken from Discogs with its source and date). The API computes nothing the client cannot, but it serves the totals so they cover the whole collection and not just the loaded page.
- New **locations** (shops, markets, websites) shared by the household: physical, online, or both; physical ones have an address and coordinates.
- New **purchase map** with the physical places, an online list, and a period filter, built on the shadcn map component (`@shadcn-map/map`).
- Discogs search becomes **search-first** when the member has connected Discogs: live search as they type, barcode and catalogue number, pagination, "already in the collection" markers, version and value imported on selection, and a visible "enter by hand" action. The current value comes from the member's Discogs authorisation on the server.
- The web front end is replaced by the new shell: centred navigation, account menu (Settings, Family, Discogs, Sign out), hamburger menu on phones, filters in a bottom sheet on phones. The existing sign-in, registration, invite, family, settings and import screens keep working and are restyled into the new shell. The existing 3D shelf (8 random records) stays.
- `docker compose up --build` builds and serves everything (web, API, database) with the new front end.

## Capabilities

### New Capabilities

- `record-pricing`: version details, purchase price and current value of a record, gain/loss and collection totals.
- `purchase-locations`: household-shared purchase places (physical, online, both) and their link to purchases.
- `purchase-map`: map of physical purchase places, online purchases list, period filter, keyboard and mobile use.
- `discogs-add-flow`: search-first adding with Discogs, live search, barcode, pagination, market value.
- `app-shell`: header, navigation, account menu, responsive views and filters of the new front end.

### Modified Capabilities

<!-- None: the capabilities of change family-vinyl-collection-app are not archived yet, so these requirements are new and live beside them. -->

## Impact

- **API** (`api/`): Alembic migration (new record columns, `locations` table), new routers (`locations`, `purchases`), changes to `records` (fields, filters, options, summary, duplicate rule) and `discogs` (search params, release value), tests.
- **Web** (`web/`): new shell and pages, data hooks on the existing react-query setup, shadcn components (`map`, field, command, popover, tabs, drawer, sheet, dropdown-menu, navigation-menu, toggle-group, select, etc.), tests.
- **Compose**: no new services; the web image builds the new front end.
- **Privacy**: purchase places are family data; only the address typed by a member is sent to the geocoder and only tile requests reach the map provider. Discogs secrets stay on the server.
- **Out of scope**: moving data from the browser-only prototype, multi-household, currency conversion, importing purchase data from Discogs, editing the 3D shelf scene.

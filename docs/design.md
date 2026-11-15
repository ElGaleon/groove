# Design

How Groove looks and behaves, and the rules that keep new screens consistent. The behaviour
behind each screen is specified in `openspec/specs/` (e.g. `vinyl-collection`, `purchase-map`,
`auth-screens`, `localization`).

## Product principles

1. **Answer "do we already have it?" in seconds, on a phone, in a shop.** Search is the first
   control on the collection page and works on title, artist and catalogue number, accent- and
   punctuation-insensitive.
2. **Everything works by hand.** Discogs is an accelerator (search, import, covers, values), never
   a requirement. "Enter by hand" is always one tap away.
3. **The family is the unit.** Records, places and values are shared; ownership is a label, not a
   permission. Any member can edit any record.
4. **Never lose data silently.** Deletes can be undone, imports only add, a manual value is never
   overwritten without confirmation, leaving the family keeps the records as shared.
5. **Private by default.** Covers and data are visible only to signed-in members; only addresses
   (to geocoding) and tile requests (to the map) leave the browser.

## Information architecture

| URL (`routes.ts`) | Screen | Feature |
|---|---|---|
| `/sign-in` | Sign in | `auth` |
| `/register` | Register (first member creates the household) | `auth` |
| `/invite/:token` | Join the household | `auth` |
| `/reset-password/:token` | Choose a new password | `auth` |
| `/` | Collection: summary, toolbar, shelf / grid / list | `collection` |
| `/records/new` | Add a record (dialog over the collection) | `records` + `discogs` |
| `/records/:id` | Record detail (dialog over the collection) | `records` |
| `/map` | Purchases map, online purchases, places | `places` |
| `/family` | Members, invites, reset links | `family` |
| `/settings` | Profile, language, currency, password, Discogs, backup (dialog over the collection) | `settings` |
| `/import` | Discogs import progress | `discogs` |

URLs are English. Former Italian URLs (`/accedi`, `/dischi/:id`, `/mappa`, …) redirect to the
English ones keeping parameters and query, so old invite links and bookmarks keep working.
Components never write a path literal: they use `routes` / `patterns`.

**Dialog routes.** Record detail, add-record and settings render *over* the collection
(`OnCollection` in `app/App.tsx`): closing them returns to the same scroll position and filters,
and the URL is shareable.

## App shell

- `SiteHeader`: brand mark, primary sections (Collection, Map) and the account menu (Settings,
  "Refresh values" when Discogs is linked, Family, language, sign out). Below the `md`
  breakpoint the sections move into a hamburger sheet. Touch targets are at least 44 px
  (`h-11` / `min-h-11`) on phones.
- `Layout`: header, then the page in one centred column.
- Auth screens use their own `AuthLayout`: on phones a dark band with a half-hidden record above
  the form; on wide screens the form on one side and a dark panel with a large record on the
  other. It follows `prefers-color-scheme`.

## The collection

```
┌ Summary ─────────────────────────────────────────────┐
│ N records · spent / value / difference per currency  │
├ Toolbar ─────────────────────────────────────────────┤
│ [search……………]  [filters]  [shelf|grid|list]  [sort]  │
├ View ────────────────────────────────────────────────┤
│ 3D shelf (10 random) │ grid of covers │ table/list    │
└──────────────────────────────────────────────────────┘
```

- **Summary** totals come from `/api/records/summary` and cover every match, not just the page.
  Amounts are shown per currency; nothing is converted. Gains are green, losses red (`Delta`).
- **Filters:** owner, genre, decade, label, country, format, year, "linked to Discogs". Options
  come from `/api/records/options` (only values that exist). On phones the filters open in a
  bottom sheet.
- **State in the URL:** search, filters, sort, view and paging are query parameters, so reload,
  back/forward and shared links keep them.
- **Views:**
  - *Shelf* — a three.js scene (`features/shelf/shelf-scene.ts`, framework-free, GSAP animation)
    with 10 random records from `/api/records/random`; "show 10 more" avoids repeats. Hover shows
    a card; click opens the record. WebGL resources are disposed on unmount.
  - *Grid* — cover tiles, loading more on demand.
  - *List* — dense table for scanning and sorting.
- **Owner colours:** each member gets a stable colour by their position in the household
  (`--owner-1` … `--owner-6` in `index.css`), used by `OwnerBadge` and the owner filter. Shared
  records have a neutral badge.

## Record detail and editing

Sections: identity (title, artist, year, label, genres, format, note), **version** (catalogue
number, country), **purchase** (price + currency, date, place, channel), **value** (amount +
currency, source and date; refresh from Discogs when linked), covers (front/back upload or from
Discogs), tracklist (from Discogs, cached), owner.

- A duplicate on save (`409 duplicate`) shows the existing record instead of a generic error.
- Delete shows a toast with **Undo** (10 s window).
- "Refresh values" (account menu, `RefreshDialog`) asks Discogs for every linked record and shows
  what changed; a manual value becomes a *proposal* the member accepts or ignores.

## Adding a record

1. With Discogs linked: a search field that searches as you type (title, artist, barcode,
   catalogue number), paged results, "already in the collection" markers. Choosing a result
   pre-fills the form and fetches the market value.
2. Always available: "Enter by hand" opens the empty form.
3. The place picker can create a new place inline (`LocationDialog`).

## Map

`/map` shows physical places with coordinates on a Leaflet/MapLibre map (vector tiles from
OpenFreeMap, light or dark style; raster OSM fallback), with clustering and full screen; a list of
online purchases; a year filter; and place management, including "move the records and delete".
Addresses are geocoded in the browser with Nominatim.

## Design system

- **Components:** shadcn/ui on **base-ui** (style `base-nova`), in `web/src/shared/ui/`. Add new
  ones with `npx shadcn add <name>`; keep their API. Compose screens from the app building blocks
  in `shared/components/` (`Page`, `Section`, `Field`, `PasswordField`, `SubmitButton`,
  `ResponsiveModal`, `Notice`, `SearchField`, `LanguageSelect`, `VinylSpinner`, `BrandMark`)
  before creating new ones.
- **Icons:** `lucide-react`.
- **Styling:** Tailwind CSS 4 utility classes, merged with `cn()`. No CSS modules, no inline
  style objects for theming.
- **Tokens:** CSS variables in `web/src/index.css` (`--background`, `--foreground`, `--primary`,
  `--muted`, `--destructive`, `--border`, `--radius`, chart and owner colours) in OKLCH, with a
  `.dark` set. Use the semantic Tailwind colours (`bg-background`, `text-muted-foreground`, …),
  never raw hex values.
- **Typography:** Geist Variable (`@fontsource-variable/geist`) for body and headings.
- **Feedback:** toasts with `sonner`; inline messages with `Notice`; loading with `Skeleton` or
  `VinylSpinner`.
- **Modals:** `ResponsiveModal` — a centred `Dialog` on desktop, a bottom `Drawer` on mobile,
  with a scrolling body and a sticky footer that respects the safe area.

## Responsive rules

- Mobile breakpoint: **768 px** (`useIsMobile`). Design phone-first; the shop use case is a phone.
- Below it: hamburger menu, filters in a bottom sheet, modals as drawers, two-button footers in a
  grid.
- Use `dvh` units and `env(safe-area-inset-*)` for full-height surfaces.
- Check every new screen at phone width (`views-responsive.spec.ts` covers the main ones).

## Language and copy

- Italian is the default and the fallback; English is complete. Catalogs:
  `web/src/i18n/locales/it.ts` (defines the `Catalog` type) and `en.ts`.
- **No literal user-facing text in components**, including `aria-label`, `placeholder`, `title`,
  `alt` (`no-literal-text.test.ts`). Use `t.<section>.<key>`; plurals and values are functions in
  the catalog.
- Dates, numbers and money use `web/src/i18n/format.ts` and `shared/lib/money.ts`; never
  `toLocaleString` with a hard-coded locale.
- Error messages come from API error codes (`t.errors.codes`), never from the API `detail`.
- Tone: short, friendly, concrete, addressed to a family member ("Add a record", not "Create
  entity").

## Accessibility

- Prefer semantic roles and accessible names; Playwright tests select by `getByRole` /
  `getByLabel`, so an unlabeled control is also a broken test.
- Every form field has a label (`Field`); errors are tied to their field.
- Icon-only buttons need a translated `aria-label`.
- Colour is never the only signal (owner badges carry a name; deltas carry a sign/arrow).

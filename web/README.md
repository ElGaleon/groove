# Groove — Web

Single-page front end for Groove, the family vinyl collection: 3D shelf, grid and list views, record
details with purchase and value data, purchase map, Discogs search and import. Italian by
default, English available.

**Stack:** React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui (base-ui) · TanStack Query ·
React Router 7 · zod · three.js · Leaflet / MapLibre · Vitest · Playwright · oxlint

## Quick start

Requirements: Node.js 20+ and the API running on port 8000 (see [../api/README.md](../api/README.md)).

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). Requests to `/api` are proxied to
`http://localhost:8000`; set `API_PROXY` to point somewhere else.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type check (`tsc -b`) and production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Unit and component tests (Vitest + Testing Library, jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | oxlint |
| `npm run schemas` | Export OpenAPI from the API and regenerate zod schemas |
| `npm run schemas:check` | Fail if the generated schemas are out of date |
| `npm run e2e` | Browser tests (Playwright) — see [e2e/README.md](e2e/README.md) |
| `npm run e2e:release` | Full release path from an empty database |

## Project layout

```
src/
  app/              entry point, router, layout, header, providers
  features/<name>/  auth, collection, records, discogs, places, family, settings, shelf
                    each with components/, hooks/, pages/ and an index.ts public entry
  shared/
    ui/             shadcn components
    components/     app building blocks (Page, Field, ResponsiveModal, …)
    hooks/          generic hooks
    lib/            api client, routes, money, query helpers, utils
    schemas/        OpenAPI snapshot + generated zod schemas
  i18n/             catalogs (it, en), t(), date/number/currency formatting
e2e/                Playwright tests
scripts/            gen-schemas.mjs
tools/schema-gen/   isolated install of the OpenAPI → zod generator
```

### Architecture rules

Checked by `src/architecture.test.ts`:

- A feature imports another feature only through its `index.ts` (`@/features/records`).
- `shared/` and `i18n/` never import features or `app/`.
- No dependency cycles between features.

### Conventions

- All user-facing text lives in `src/i18n/locales/it.ts` and `en.ts`
  (`no-literal-text.test.ts` enforces it).
- All URLs come from `src/shared/lib/routes.ts`. Old Italian URLs redirect to the English ones.
- Every API response is validated with zod via `api()` in `src/shared/lib/api.ts`.
- `@/` is an alias for `src/`.

## Adding a UI component

```bash
npx shadcn add <component>
```

Components are written to `src/shared/ui/` (configured in `components.json`).

## Production

`Dockerfile` builds the app and serves `dist/` with [Caddy](https://caddyserver.com/), which also
reverse-proxies `/api/*` to the API container (`Caddyfile`). Set `SITE_ADDRESS` to a domain to get
automatic HTTPS. See the root [README](../README.md) for deployment.

# CLAUDE.md — web/src/features/

One folder per domain: `auth`, `collection`, `records`, `discogs`, `places`, `family`,
`settings`, `shelf`.

## Shape of a feature

```
<name>/
  index.ts        public surface — the ONLY file other features may import
  pages/          routed screens
  components/     UI used by this feature (or exported via index.ts)
  hooks/          React hooks (use-*.ts)
  schemas.ts      zod schemas (built on @/shared/schemas generated ones) for forms/responses
  <name>.ts       API calls and query helpers for the domain
  *.test.ts(x)    tests next to the code
```

## Rules

- Cross-feature imports: `import { Cover } from '@/features/records'` only. If you need
  something internal, export it from `index.ts`, or move it to `shared/` if it's generic.
- Never import from `@/app`. No cycles between features (checked by `architecture.test.ts`).
- Data fetching: `useQuery`/`useMutation` with `api()` + a zod schema; invalidate with
  `invalidateCollection` after changes to records or places.
- Text: `t.<section>.<key>` from `@/i18n`; add keys to both locale catalogs.
- `shelf/` is the three.js 3D shelf (`shelf-scene.ts`); keep it framework-free and dispose
  WebGL resources on unmount.
- `places/` uses Leaflet/MapLibre; addresses go only to the geocoding service.

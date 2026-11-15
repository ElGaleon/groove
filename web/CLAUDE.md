# CLAUDE.md — web/

React 19 + TypeScript + Vite single-page app. Read the root [CLAUDE.md](../CLAUDE.md) first.

## Commands

```bash
npm install
npm run dev              # http://localhost:5173, proxies /api -> http://localhost:8000 (API_PROXY overrides)
npm test                 # vitest (jsdom), includes architecture and no-literal-text checks
npx vitest run src/features/records   # subset
npm run lint             # oxlint
npm run build            # tsc -b + vite build — the type check
npm run schemas          # regenerate zod schemas from the API (needs uv + api/)
npm run schemas:check    # fail if generated schemas are stale
npm run e2e              # Playwright, see e2e/CLAUDE.md
```

## Structure (enforced by `src/architecture.test.ts`)

```
src/app/              shell: router, layout, header, providers. Nothing imports from here.
src/features/<name>/  auth, collection, records, discogs, places, family, settings, shelf
                      components/ hooks/ pages/ + index.ts (the only public entry point)
src/shared/           ui/ (shadcn), components/, hooks/, lib/, schemas/ — never imports features or app
src/i18n/             catalogs (it.ts, en.ts), t(), formatting
e2e/                  Playwright tests
```

- Import another feature only via `@/features/<name>` (its `index.ts`), never a deep path.
- No import cycles between features. No `../..` out of a feature folder.
- `@/` aliases `src/`.

More detail: [src/CLAUDE.md](src/CLAUDE.md), [src/features/CLAUDE.md](src/features/CLAUDE.md),
[src/shared/CLAUDE.md](src/shared/CLAUDE.md), [src/i18n/CLAUDE.md](src/i18n/CLAUDE.md),
[e2e/CLAUDE.md](e2e/CLAUDE.md).

## Rules

- **No literal user-facing text in components** — add keys to `src/i18n/locales/it.ts` and
  `en.ts` and use `t.…`. `src/i18n/no-literal-text.test.ts` fails otherwise.
- **No hard-coded paths** — use `routes` from `@/shared/lib/routes`.
- **All API calls** go through `api(path, { schema })` from `@/shared/lib/api` with a zod schema
  (prefer the generated ones from `@/shared/schemas`). Show errors with `errorMessage(err, fallback)`.
- Server state uses TanStack Query; after mutating records/locations call
  `invalidateCollection(queryClient)` from `@/shared/lib/queries`.
- UI primitives: shadcn components in `src/shared/ui/` (add with `npx shadcn add <name>`;
  style `base-nova`, icons `lucide-react`). Style with Tailwind classes and `cn()`.
- Must work on phones: check narrow widths (filters in a bottom sheet, hamburger menu).
- Don't edit `src/shared/schemas/generated/` by hand.

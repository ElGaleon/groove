## Context

Facts from the code today:
- `api<T>()` (`web/src/shared/lib/api.ts`) ends with `return data as T`: no runtime check. 52 call sites in 21 files.
- 53 hand-written interfaces and types in the web code describe API shapes; the API has 47 Pydantic models in `api/app/schemas/`.
- 17 forms keep values in `useState` and repeat server rules as HTML attributes.
- Collection filters live in the address bar and are read in `features/collection/filters.ts`.
- FastAPI already serves `/api/openapi.json`, so the shapes exist in machine-readable form.
- Error texts already follow one convention: the server sends a code (`password_too_short`, `required`, `invalid` + `field`) and the client translates it in `errorMessage()`.
- Web and API ship together (one Docker stack), so strict checking of what the web uses cannot clash with an older server.

## Goals / Non-Goals

**Goals:** catch bad data at the edge; one definition per shape; same limits in client and server; messages in the member's language; no change to the API.
**Non-Goals:** replace Pydantic on the server; a new form framework; validating images or Three.js data; changing screens.

## Decisions

1. **Where schemas come from: generate from OpenAPI, refine by hand.** The API describes every response and request body in `/api/openapi.json`. A generator turns it into zod schemas (candidates: `@hey-api/openapi-ts` with its zod plugin, `openapi-zod-client`, `orval`). A first task is a one-hour spike on this repository to pick the one that handles our models (nullable fields, enums, `Literal`, dates) and emits zod 4. Hand-written schemas are the fallback, per feature, in `schemas.ts`. Generated output goes to `web/src/shared/schemas/generated/` and is committed, so a build needs no running API. Rejected: hand-writing everything (the drift problem stays) and sharing schemas between Python and TypeScript (no good tool for it).
2. **Drift check.** A script `api/scripts/export_openapi.py` writes `openapi.json` from the FastAPI app without a server; a vitest test regenerates the schemas in memory and compares them with the committed ones. CI and `npm test` fail on a difference, naming the shape.
3. **Strictness at the boundary.** `api(path, { schema })` runs `schema.safeParse`. Objects are non-strict (unknown keys dropped). On failure it throws `ResponseShapeError` (extends `ApiError` with code `response_shape`), logs endpoint, status and the first issue path with `console.error` (never the values: they can be personal data), and the UI shows `t.errors.generic`. The same behaviour in dev, test and production: a family app prefers an honest error to silently wrong data. The `schema` argument becomes required once all call sites have moved; until then the old signature works, so the migration can go feature by feature.
4. **Forms: zod without a form library.** A small hook `useFormSchema(schema)` returns `validate(values)` with per-field codes; fields show messages through `errorMessage()`. Zod issues carry our codes (`too_small` → `password_too_short` with `min_length`, missing → `required`, invalid format → `invalid` + `field`), so the catalogs stay the only place with words and the client messages equal the server's. Rejected: `react-hook-form` (a new dependency and a rewrite of 17 forms for little gain at this size); `zodResolver` can be added later without touching schemas.
5. **Limits are shared.** Form rules read their numbers from the generated schemas where the OpenAPI document carries them (`minLength`, `maxLength`, `enum`). Where it does not (the password minimum is a server setting), the server exposes it once (`GET /api/auth/status` gains `min_password_length`) and the form uses it. No magic number is typed twice.
6. **Address bar and files.** `filters.ts` parses `URLSearchParams` with a schema using `catch()`/defaults so garbage falls back to defaults. The backup import parses the file with the backup schema before the request and reports the first problem in plain words (new texts in the catalogs).
7. **Bundle.** Zod 4 is tree-shakable; use the core API, and measure the build (`npm run build`) before and after. If the cost is over about 15 kB gzipped, switch the hot paths to `zod/mini`.
8. **Order of migration.** auth → family → settings/backup → records → collection (+ filters) → places → discogs. Each step ends with green unit and e2e tests.

## Risks / Trade-offs

- A generator that does not fit our OpenAPI could cost more than it saves: the spike decides, and the fallback is hand-written schemas plus a smaller drift test (compare field names).
- Strict responses turn a server slip into a visible error where today it may pass unnoticed: that is the point, and the e2e suite covers each screen.
- More code in `shared/schemas`: generated and committed, excluded from lint and formatting.

## Migration Plan

No data or API change. Ship per feature; roll back by reverting the web code. The only server change is the optional `min_password_length` field in `/api/auth/status` and the OpenAPI export script.

## Outcome (decisions taken while building)

- **Generator:** `@hey-api/openapi-ts` 0.99 with its zod plugin, kept in `web/tools/schema-gen/` with its own `package.json` because it needs the TypeScript 5 compiler API while the app uses TypeScript 7. `npm run schemas` exports the OpenAPI document (`api/scripts/export_openapi.py`), commits it as `web/src/shared/schemas/openapi.json` and writes `generated/zod.gen.ts`.
- **Drift:** `api/tests/test_openapi_snapshot.py` fails when the API's document differs from the committed copy; `npm run schemas:check` fails when the generated file is not what the copy produces.
- **Lists** drop a row with the wrong shape and log it (`listOf`); single objects fail with `ResponseShapeError`.
- **Backup file:** the server takes a plain object, so its `BackupFile` model is not in the OpenAPI document; the browser check (`features/settings/schemas.ts`) is hand-written and light, the server still validates in depth.
- **Bundle:** zod with all generated schemas costs about 31 kB gzipped (the main bundle went from about 423 kB to about 461 kB, which also includes the new auth screens). That is above the 15 kB trigger of decision 7; accepted for a self-hosted app whose bundle is dominated by three.js and maps. A later step can switch the generator to its `mini` output.
- **Not migrated:** the location dialog, whose rules depend on the kind of place (physical needs coordinates, online needs a URL) and are not in the server schema.
- **Server change:** `GET /api/auth/status` also returns `min_password_length`.

## Open Questions

None: both questions are answered in the outcome above.

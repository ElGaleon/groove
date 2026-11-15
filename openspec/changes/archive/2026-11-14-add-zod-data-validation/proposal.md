# Proposal

## Why

The web app trusts the server blindly. `api<T>()` in `shared/lib/api.ts` returns `data as T`, so a wrong or changed response shape surfaces later as a blank screen or a `NaN`, far from its cause. The same shapes are written by hand twice: 53 interfaces in the web code mirror the Pydantic models of the API (47 models), and the 17 forms repeat server limits as HTML attributes (`minLength={10}`). Query-string filters (`?view=grid&year=1960&sort=title`) and the backup file a member uploads are parsed without any check. Zod gives one place to describe a shape, check it at runtime and derive its TypeScript type.

## What Changes

- Add `zod` to the web app and a `schemas` layer: one schema per API shape, types derived with `z.infer`, no hand-written duplicates.
- `api()` takes the response schema and checks the answer at the boundary; a mismatch becomes a clear coded error and is reported, never a downstream crash. Fields the app does not know are ignored, so the server can add fields without breaking an open client.
- Forms (sign-in, registration, invitation, reset, family, record, settings, import) validate with schemas before sending, with the same limits as the server; messages come from the Italian and English catalogs through the error codes the app already has.
- URL filters of the collection and the uploaded backup file are parsed with schemas (defaults, coercion, a readable error for a bad file).
- Schemas are generated from the API's OpenAPI document (`/api/openapi.json`) where possible, with a check that fails the build when they drift; thin hand-written refinements add form-only rules.
- **No change to the API or to what members see**, except clearer messages for invalid input and bad files.

## Capabilities

### New Capabilities
- `client-data-validation`: how the web app checks the data it receives, reads and sends (API responses, form input, URL parameters, uploaded files) and keeps those checks in step with the API.

### Modified Capabilities

None.

## Impact

- Web: new dependency `zod` (4.x, plus a generator as a dev dependency if the spike confirms one); `shared/lib/api.ts`; a new `shared/schemas` folder (generated) and `schemas.ts` per feature for form rules; 21 files with 52 API call sites migrate in steps; `features/collection/filters.ts`; `features/settings/components/BackupSection.tsx`.
- API: a script that writes `openapi.json` without starting the server; no endpoint changes.
- Tooling: a drift check in the test run; a rule in `architecture.test.ts` that `shared` does not import features.
- Out of scope: replacing Pydantic as the source of truth on the server; validating images; a form library (see design).

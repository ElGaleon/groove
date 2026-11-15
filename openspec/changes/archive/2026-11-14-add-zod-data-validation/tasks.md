## 1. Spike and foundations

- [x] 1.1 Spike: run the candidate generators on `/api/openapi.json`, compare output (nullable, enums, dates, zod 4) and pick one; note the choice in design.md (done: `@hey-api/openapi-ts` 0.99 with the zod plugin)
- [x] 1.2 Add `zod` (and the chosen generator as a dev dependency); measure the bundle before and after
- [x] 1.3 Add `api/scripts/export_openapi.py` (no server) and the `npm run schemas` command that generates `web/src/shared/schemas/generated/`
- [x] 1.4 Add the drift checks: a pytest that compares the API's OpenAPI document with the committed copy, and `npm run schemas:check` that compares the generated schemas with what that copy produces
- [x] 1.5 Add the architecture rule: `shared/schemas` imports nothing from features or the app shell

## 2. The boundary

- [x] 2.1 Extend `api()` with an optional `schema`, `ResponseShapeError` (code `response_shape`) and logging without values
- [x] 2.2 Unit tests: valid answer, wrong type, missing field, extra field, 204, error answers unchanged
- [x] 2.3 Add the catalog texts for `response_shape` and the new form messages (it/en)

## 3. Forms

- [x] 3.1 Add the form-validation helper (zod issues to our codes, per-field messages through `errorMessage()`)
- [x] 3.2 Expose `min_password_length` in `GET /api/auth/status` and use it in the forms
- [x] 3.3 Migrate sign-in, registration, invitation, reset and family password forms
- [x] 3.4 Migrate the record dialog (title, artist, year with the server's limits); settings and import have no typed fields; the location dialog keeps its own kind-dependent rules

## 4. Migrate the call sites, feature by feature

- [x] 4.1 auth and family
- [x] 4.2 settings and backup (validate the uploaded file; new messages)
- [x] 4.3 records and discogs
- [x] 4.4 collection, including the address-bar parser in `filters.ts` with defaults
- [x] 4.5 places
- [x] 4.6 Make `schema` required in `api()` and delete the hand-written interfaces that the schemas replace

## 5. Verification

- [x] 5.1 Run vitest, tsc, oxlint, build, pytest and the whole e2e suite
- [x] 5.2 `openspec validate --strict`; update the README (how to regenerate the schemas) and archive

# Groove documentation

These pages explain how Groove is built and why. They are written for people **and AI coding
agents** who need to understand the app before changing it. The binding rules for each folder
stay in the `CLAUDE.md` files; these pages give the background those rules rely on.

## Reading order

| # | Page | Read it to learn |
|---|---|---|
| 1 | [architecture.md](architecture.md) | The system as a whole: containers, request lifecycle, back-end layers, front-end structure, background worker |
| 2 | [data-model.md](data-model.md) | Tables, relationships, invariants (one household, soft delete, money, normalised keys) |
| 3 | [api.md](api.md) | Endpoint map, error contract, auth/CSRF, OpenAPI → zod pipeline |
| 4 | [design.md](design.md) | UI and UX: screens, shell, views, design system, responsive rules, i18n |
| 5 | [security.md](security.md) | Sessions, passwords, CSRF, household isolation, secrets, headers |
| 6 | [discogs.md](discogs.md) | OAuth per member, search, import worker, covers, market value |
| 7 | [development.md](development.md) | Workflow, checks, testing strategy, recipes for common changes |
| 8 | [deployment.md](deployment.md) | Docker Compose, Caddy, CI/CD, backups, upgrades and rollbacks |

## Where the truth lives

| Question | Source of truth |
|---|---|
| What must the app do? | `openspec/specs/<capability>/spec.md` |
| What is being changed right now? | `openspec/changes/<change>/` |
| What are the rules for editing folder X? | `X/CLAUDE.md` (and every parent `CLAUDE.md`) |
| What does the API look like? | `web/src/shared/schemas/openapi.json` (snapshot of FastAPI's OpenAPI) |
| Which error codes exist? | `api/app/core/errors.py` + `t.errors.codes` in `web/src/i18n/locales/it.ts` |
| Which URLs does the app have? | `web/src/shared/lib/routes.ts` |
| Which settings exist? | `api/app/core/config.py` and `.env.example` |

If these pages and the code disagree, the code (and the specs) win: fix the page.

## Glossary

| Term | Meaning |
|---|---|
| **Household** | The family. Exactly one per installation; every member belongs to it. |
| **Member** | A user account (`users` table). Italian UI: *familiare*. |
| **Record** | A vinyl item in the collection (`records` table). Italian UI: *disco*. |
| **Owner** | The member a record belongs to; `NULL` means *shared* by the family. |
| **Version / pressing** | A specific release of an album, told apart by catalogue number and country. |
| **Purchase** | Price, currency, date, place and channel of buying a record (columns on `records`). |
| **Value** | Current value of a record, `manual` or from `discogs` (lowest price for sale). |
| **Location / place** | A shop, market or website where records are bought: `physical`, `online` or `both`. |
| **Channel** | Whether a purchase happened in person or online; implied by the place unless it is `both`. |
| **Minor units** | Integer amount in the currency's smallest unit (cents for EUR). |
| **Import job** | A background Discogs collection import, stored in `import_jobs`. |
| **Capability** | An OpenSpec area of behaviour (e.g. `vinyl-collection`, `purchase-map`). |

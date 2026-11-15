# Design

## Context

Greenfield project: the repository holds only the OpenSpec setup. The visual starting point is a single-file prototype (`time-sheet-ai-agent/prototypes/vinyl-shelf/index.html`) that renders ten procedurally drawn sleeves on two shelves with Three.js and GSAP, with a second transparent canvas for the selected sleeve, a shrink-wrap film layer, and a flip. It has no data layer and no build step.

Constraints: a family of a few people, a collection expected to pass 150 records (plan for 500), phone and desktop, a requested stack of React and Python, and Discogs credentials that must stay secret. See proposal.md for motivation and the specs for requirements.

## Goals / Non-Goals

**Goals:**
- A small, conventional CRUD stack that one person can run and maintain.
- Per-member Discogs access, unlocked in Settings, with the app fully usable without it.
- Reuse the prototype's scene as a module that shows 8 real records.

**Non-Goals:**
- Live updates between members, offline editing, writing back to Discogs, audio, native apps.
- Horizontal scaling: the design assumes one API instance.
- Fine-grained roles; every member is equal.

## Decisions

**1. Stack: React + TypeScript front end, FastAPI + PostgreSQL back end.**
Front end: Vite, React, React Router and TanStack Query for server data (filters and infinite scroll map onto query keys and paged requests). Back end: Python 3.12, FastAPI, SQLAlchemy 2 with Alembic migrations, Pydantic models, PostgreSQL. Dependencies managed with `uv`, linting with `ruff`.
*Alternatives:* Django (more built in, but the API-plus-SPA shape suits FastAPI and the typed schemas), a backend-as-a-service (not Python, and the Discogs secrets and import worker need custom server code anyway), SQLite (fine at this size, but Postgres is the safer default for concurrent writes and `random()` / trigram search).

**2. Single origin, cookie sessions.** The API serves under `/api` behind the same host as the static front end, so there is no CORS. Sign-in sets an HttpOnly, Secure, SameSite=Lax session cookie backed by a `sessions` table; state-changing requests also require a custom header, which together block cross-site request forgery. Passwords are hashed with argon2id; there is a minimum length of 10 and a per-email attempt limit (5 failures in 10 minutes) stored in the database.
*Alternatives:* JWT in local storage (token theft by script injection), magic links (needs email delivery to be set up).

**3. Data model.** `households` (one row), `users(household_id, email, password_hash, display_name)`, `invites(token_hash, household_id, created_by, expires_at, used_at, revoked_at)`, `sessions`, `records`, `discogs_connections`, `discogs_oauth_pending`, `import_jobs`.
`records` holds title, artist, year, label, genres (array), format, note, `owner_id` (nullable foreign key to `users`, `ON DELETE SET NULL`), `cover_path`, `tracklist` (JSON, nullable), `discogs_release_id`, `discogs_username` and `discogs_instance_id` (set for imported rows), normalised `title_key` and `artist_key` for matching, `created_by`, timestamps and `deleted_at`.
A null owner means shared; when a member leaves, their records keep existing and `owner_id` becomes null. Soft deletion supports the 10-second undo. A unique key on `(discogs_username, discogs_instance_id)` makes re-imports idempotent.

**4. Catalogue queries run on the server.** `GET /api/records` takes search text, owner (`any`, a user id, or `shared`), genre, decade, label, sort and an offset/limit; the grid and list page through it. Search uses `ILIKE` on title and artist, backed by a trigram index. A separate `GET /api/records/random?count=8` takes the same filters plus an `exclude` list of ids and uses `ORDER BY random() LIMIT 8`; if exclusions leave fewer than 8, the server allows repeats so the shelf is full. Filter options (genres, decades, labels, owners) come from one summary endpoint.

**5. Duplicate check.** Creating a record compares `discogs_release_id`, or the normalised title and artist, with existing records. A match returns a conflict answer containing the existing record; the client may repeat the request with `allow_duplicate=true` to add another copy.

**6. Discogs: per-member OAuth 1.0a, secrets on the server.** The application's Discogs consumer key and secret live in environment variables. In Settings, "Connect" calls the API, which obtains a request token (kept in `discogs_oauth_pending`), and returns the Discogs authorisation URL; Discogs redirects to the API callback, which exchanges the verifier for an access token and stores token and secret in `discogs_connections`, encrypted at rest with a Fernet key from the environment. Nothing from Discogs reaches the browser. Disconnect deletes the row. A 401 from Discogs marks the connection `expired`. All Discogs calls send the required User-Agent header and respect the authenticated limit of about 60 requests per minute with a shared limiter and backoff.
*Alternatives:* members paste a personal access token (simplest, but every member would handle a secret by hand), one shared account (cannot import each member's own collection).

**7. Import runs in a background worker backed by the database.** Starting an import writes an `import_jobs` row (member, owner mode, total, processed, status). One in-process worker started with the API picks up pending and running jobs, including after a restart, reads the member's Discogs collection in pages of 100, inserts only new releases (`ON CONFLICT DO NOTHING`, so member edits are never overwritten and releases removed on Discogs are never deleted), downloads covers, and updates progress, which the client polls. Imported rows get the member as owner, or no owner when "shared" is chosen. Rate-limit or 5xx answers cause a backoff and retry; persistent failure marks the job `failed` and keeps what was imported.
*Alternatives:* a task queue such as Celery or RQ with Redis (extra services for a once-in-a-while job at this scale), running the import inside the request (it would time out).

**8. Track lists are fetched on demand.** The collection listing from Discogs has no track list; fetching one per release would multiply requests. The track list is requested the first time a record is flipped, from Discogs with the current member's connection when there is one, saved on the record, and reused. Without a connection or a Discogs release id, the back shows the "no track list" note.

**9. Covers on server storage.** Imported and Discogs-search covers are downloaded, cropped to square and saved as ~600 px JPEG on a server volume; uploaded covers (JPEG, PNG or WebP, up to 5 MB) are validated, re-encoded with Pillow and saved the same way. Covers are served from `GET /api/records/{id}/cover` only to signed-in members, with `Cache-Control: private` and an ETag. Because it is the same origin, Three.js can load them as textures with the session cookie.

**10. Shelf module.** Ported from the prototype as `mountShelf(host, options)` returning `setRecords`, `select`, `dispose`. Changes: 8 sleeves (two shelves of four), covers from URLs instead of canvas drawings, a generated placeholder when no cover exists, pointer events for tap and hover, `prefers-reduced-motion`, quality tiers (pixel ratio, shadow size, film layer) chosen at start, and a fallback to the grid when WebGL is unavailable. The shrink-wrap film keeps the custom blending that does not write alpha, which avoids the dark outline seen in the prototype. Eight textures at a time keeps memory small, so no cache is needed beyond disposing the previous set on shuffle.

**11. Views and shopping lookup.** One filter state (search, owner, genre, decade, label, sort) lives in the URL and is shared by shelf, grid and list. A search field in the top bar is reachable on every screen and opens the grid or list with the text applied, which answers "do we already have this?". Discogs results from the add screen are matched against the collection by release id, or by normalised title and artist, and marked with the owner or "shared".

**12. Deployment and testing.** Docker Compose runs `api`, `db` and a small web server serving the built front end and proxying `/api`. Backend tests use pytest against a throwaway PostgreSQL, with Discogs replaced by recorded fixtures. Front-end unit tests use Vitest; one Playwright end-to-end path runs against a mocked Discogs server. The 3D scene is checked by hand with screenshots.

## Risks / Trade-offs

- [Discogs rate limit (about 60 requests per minute) slows a first import] → Paced requests, visible progress, work continues in the background.
- [Discogs terms limit how its images are used] → Private family use only, covers never exposed outside signed-in members; stated in the README. Uploaded covers are an alternative.
- [The in-process worker stops if the API restarts mid-import] → Jobs are in the database and resume at startup; imports are idempotent.
- [One API instance only] → Acceptable for a family; the worker and limiter would need rework to scale out.
- [Passwords are weaker than link-based sign-in] → Strong hashing, length minimum, attempt limits; a password reset is not included in this change (listed as an open question).
- [Discogs OAuth needs the application registered on Discogs and a public callback URL] → A one-time setup step in the README; local development uses a tunnel or the real hosted URL.
- [Phones run out of GPU memory] → Only 8 textures of ~600 px, plus the quality tier.
- [Random picks can feel repetitive on a small collection] → The shuffle avoids repeating the previous set whenever enough records exist.

## Migration Plan

Greenfield, so no data migration.
1. Register the application on Discogs and note the consumer key and secret.
2. Provide environment values (database URL, session secret, Fernet key, Discogs key and secret) from `.env.example`.
3. `docker compose up`, apply Alembic migrations, register the first member to create the household.
4. Invite the family; each member connects Discogs in Settings if they want imports.

Rollback: redeploy the previous image; database changes are forward-only migrations, corrected with a new migration.

## Open Questions

- Where to host it (a small VPS, Fly.io or Render). It affects only the deploy task.
- How a member who forgot their password gets back in. This change has no reset flow; one can be added later (for example a reset link set up by an existing member) as its own change.

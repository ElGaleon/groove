# Tasks

## 1. Project setup

- [x] 1.1 Create the Python API skeleton (FastAPI, SQLAlchemy 2, Alembic, `uv`, `ruff`, pytest) with a `/api/health` endpoint; verify `pytest` passes and `GET /api/health` returns 200
- [x] 1.2 Create the React front end (Vite, TypeScript, React Router, TanStack Query, Vitest) with a placeholder home page; verify `npm run build` and `npm test` succeed
- [x] 1.3 Add `docker-compose.yml` (api, PostgreSQL, web server proxying `/api` on the same origin), `.env.example` listing variable names only, and a `.gitignore` excluding `.env*` and the covers volume; verify `docker compose up` serves the front end and the health endpoint from one origin
- [x] 1.4 Write the README sections for local run and tests; verify a fresh clone follows them to a running app

## 2. Accounts and household (family-sharing)

- [x] 2.1 Add migrations for `households`, `users`, `invites` and `sessions`; verify `alembic upgrade head` runs on an empty database
- [x] 2.2 Implement first-household registration and refusal of registration without an invitation afterwards; verify API tests for both scenarios
- [x] 2.3 Implement invites (create, copy link, expire after 7 days, single use, revoke) and joining by invite; verify API tests for valid, expired, used and revoked invites
- [x] 2.4 Implement sign-in and sign-out with argon2id hashing, the 10-character minimum, the generic wrong-credentials error and the 5-failures-in-10-minutes limit; verify API tests for each case
- [x] 2.5 Implement the session cookie (HttpOnly, Secure, SameSite=Lax) with the custom-header requirement on state-changing requests, and change password signing out other sessions; verify API tests that a request without the header is rejected and that other sessions end
- [x] 2.6 Enforce that every records, covers and settings endpoint requires a signed-in member; verify tests that anonymous requests, including for a cover image, get 401 and no data
- [x] 2.7 Implement leave household (records become shared, last member confirmation deletes the collection); verify tests for both scenarios
- [x] 2.8 Build the sign-in, registration, invite-join and member screens in React; verify a browser test of the invite flow with two accounts

## 3. Catalogue API and manual CRUD (collection-catalog)

- [x] 3.1 Add the `records` migration with owner (nullable, set to null when the user is removed), Discogs fields, normalised keys, soft delete and the trigram index; verify the migration applies and the index exists
- [x] 3.2 Implement create, read, update and soft-delete endpoints with validation (title and artist required) and an undo endpoint valid for 10 seconds; verify API tests for validation, delete and undo
- [x] 3.3 Implement the optional owner on create and update (a member, or none for shared); verify tests that setting, changing and clearing the owner work and that a non-member id is rejected
- [x] 3.4 Implement cover upload (JPEG, PNG, WebP, up to 5 MB, re-encoded to ~600 px square) and the private cover endpoint with ETag; verify tests for a valid image, an oversized file, a non-image file and the placeholder case
- [x] 3.5 Implement the list endpoint with search, owner (including `shared`), genre, decade, label, sorting and offset/limit, plus the filter-options summary endpoint; verify tests for each filter, combinations, no results, and that 500 records answer in under one second
- [x] 3.6 Implement the duplicate check (same Discogs release or same normalised title and artist) returning the existing record and accepting `allow_duplicate`; verify tests for the warning, cancel and add-another-copy paths
- [x] 3.7 Implement the random endpoint (`count`, same filters, `exclude` list, repeats allowed only when needed); verify tests that the set follows the filters, avoids the excluded ids, and still returns 8 records on a collection of 8 or 9
- [x] 3.8 Build the add, edit, remove (confirmation and undo) and cover upload forms with the owner selector; verify a browser test of adding a record by hand with and without an owner

## 4. Discogs integration (discogs-integration)

- [x] 4.1 Add migrations for `discogs_connections`, `discogs_oauth_pending` and `import_jobs`, and the Fernet encryption helper for stored tokens; verify a unit test that tokens are stored encrypted and decrypt back
- [x] 4.2 Implement the connect flow (request token, authorisation URL, callback exchange, store connection) and disconnect, including cancelled and failed authorisation; verify tests against a mocked Discogs OAuth server for success, cancel and failure
- [x] 4.3 Implement the shared Discogs client with User-Agent, the shared rate limiter, backoff on 429 and 5xx, and marking a connection `expired` on 401; verify tests with mocked responses for each case
- [x] 4.4 Implement the Settings screen with connect, disconnect, connected username and expired states; verify a browser test of each state against the mock
- [x] 4.5 Implement locking of the Discogs features for members without a connection (add screen offers only manual entry, with a pointer to Settings); verify a test that a non-connected member can still run every manual action and gets a clear error from Discogs endpoints
- [x] 4.6 Implement Discogs-to-record mapping and the import job with its database-backed worker that resumes after a restart, inserts only new releases, keeps member edits, never deletes, and fetches covers; verify tests using a saved sample collection response for first import, re-import with one new release, preserved edits, a removed release, and resume after a simulated restart
- [x] 4.7 Implement owner choice for imports (importing member by default, or shared); verify tests for both
- [x] 4.8 Implement failure handling (rate limit wait, Discogs unavailable keeps imported records, private and empty collection messages); verify mocked tests for each
- [x] 4.9 Build the import screen with progress polling; verify a browser test that progress advances and the import completes with the page closed and reopened
- [x] 4.10 Implement Discogs search in the add screen, creating the form from a chosen result, with results marked as already in the collection (owner or shared); verify tests for a matching and a non-matching result and for no results
- [x] 4.11 Implement on-demand track list (fetched on first flip, saved, reused; none without connection or release id); verify tests that the second request makes no Discogs call and that the no-connection case returns the "not available" state
- [x] 4.12 Verify that no Discogs credential or token appears in any API response or in the front-end bundle, by test and by searching the build output
- [x] 4.13 Document registering the application on Discogs, the environment variables and the private-use note on covers in the README; verify the documented steps work on a clean setup

## 5. Views and filters (collection-views)

- [x] 5.1 Build the shared filter bar (search, owner, genre, decade, label, sort) with its state in the URL; verify a test that the state survives switching view and reloading
- [x] 5.2 Build the list view with thumbnail, title, artist, year, owner and sortable columns; verify a browser test that sorting by year orders the rows and shows the indicator
- [x] 5.3 Build the grid view with infinite scroll and lazily loaded covers; verify a browser test on a seeded 200-record collection that the first rows load first and more load on scroll
- [x] 5.4 Build the record detail page with all data, owner, note and edit and remove actions; verify opening from a list row and from a grid card
- [x] 5.5 Build the top-bar quick search reachable from every screen, answering "do we already have it?" with the owner, and the not-found state offering to add; verify tests for a found and a not-found album
- [x] 5.6 Make the layout responsive for phones (no hover-only features); verify screenshots at 375 px and 1280 px
- [x] 5.7 Move all user-facing text into one Italian strings file (now the translation catalogs in `web/src/i18n/locales/`, see `english-routes-i18n-and-folder-structure`); verify by a source search that no hard-coded user-facing text remains

## 6. 3D shelf (collection-views)

- [x] 6.1 Port the prototype scene into a `shelf` module with `mountShelf`, `setRecords`, `select` and `dispose`, split into scene, materials, records and interaction files with Three.js bundled; verify the shelf renders 8 sleeves (two shelves of four) in the running app
- [x] 6.2 Load sleeve textures from the cover endpoint, generate the placeholder cover when absent, and dispose textures when the set changes; verify a check that texture count stays at 8 after 20 shuffles
- [x] 6.3 Wire the shelf to the random endpoint with the active filters, the "Show 8 others" button, the fewer-than-8 and empty states, and the import action shown only when Discogs is connected; verify tests for each state and that a shuffle never repeats the previous set on a large collection
- [x] 6.4 Use pointer events so tap selects on phones, keep the hover lift on desktop, and keep the select, switch, Escape and return behaviour; verify on a phone-sized viewport
- [x] 6.5 Show title, artist, year and owner beside the selected sleeve, with edit, remove and open-detail actions; verify that editing from the shelf saves and the shelf state is kept
- [x] 6.6 Implement flip with the back showing record data and track list, or the "not available" note; verify flip and flip back, and the no-track-list case
- [x] 6.7 Keep the film layer on blending that does not write alpha and confirm no dark outline around a selected light cover; verify by screenshot
- [x] 6.8 Add quality tiers, `prefers-reduced-motion` handling and the fallback to the grid with a message when WebGL is unavailable; verify by emulating the setting and by forcing context creation to fail

## 7. Release

- [x] 7.1 Add a Playwright end-to-end path (register, invite a second member, add by hand with an owner, connect Discogs to the mock, import, browse in the three views, select and flip on the shelf); verify it passes with one command
- [ ] 7.2 Deploy on the owner's own VPS with Docker Compose (HTTPS through Caddy, migrations on start, household created by the first registration), following the README; verify sign-in and an invite work at the production URL on a phone and a desktop browser. The owner runs this step; the repository side (Caddy domain, restart policy, versioned images) is done and was checked locally over HTTP
- [ ] 7.3 Connect the real Discogs application and import the owner's real collection; verify the record count matches Discogs
- [x] 7.4 Write the deploy, backup and rollback steps in the README; verify by following them for a redeploy of the previous image

## Workflow follow-up

- Archive the change after the owner has reviewed the running app.

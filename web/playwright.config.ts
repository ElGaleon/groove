import { defineConfig } from '@playwright/test'

const API_PORT = 8010
const WEB_PORT = 5180
const DISCOGS_PORT = 8020
// Postgres for the browser tests: the dev database by default, or another one (E2E_PG_PORT) so a
// container that gets stopped elsewhere does not break a long run.
const PG_PORT = process.env.E2E_PG_PORT ?? '5432'
const E2E_DB = `postgresql+psycopg://groove:groove@localhost:${PG_PORT}/groove_e2e`

// End-to-end tests run the real API on a throwaway database and the dev front end in front of it.
// Needs the dev database: docker compose -f docker-compose.dev.yml up -d
export default defineConfig({
  testDir: './e2e',
  // The release path starts from an empty database (it registers the first member), so it runs
  // on its own: `npm run e2e:release`. Everything else runs with `npm run e2e`.
  testMatch: process.env.E2E_RELEASE ? '**/release-path.spec.ts' : undefined,
  testIgnore: process.env.E2E_RELEASE ? [] : ['**/release-path.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000, // long flows on a dev server that compiles on first request
  // The dev server compiles on first request (three.js, UI kit): allow for a cold start.
  expect: { timeout: 15_000 },
  // The tests read the Italian texts: pin the browser language (the app follows the browser's).
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure', locale: 'it-IT' },
  webServer: [
    {
      // A fake Discogs: OAuth, a 230-release collection, search and track lists.
      command: `uv run python scripts/mock_discogs.py ${DISCOGS_PORT}`,
      cwd: '../api',
      url: `http://localhost:${DISCOGS_PORT}/oauth/identity`,
      reuseExistingServer: false,
    },
    {
      command: `uv run python scripts/reset_e2e_db.py && uv run uvicorn app.main:app --port ${API_PORT}`,
      cwd: '../api',
      env: {
        E2E_ADMIN_URL: `postgresql://groove:groove@localhost:${PG_PORT}/postgres`,
        DATABASE_URL: E2E_DB,
        PUBLIC_BASE_URL: `http://localhost:${WEB_PORT}`,
        DISCOGS_API_URL: `http://localhost:${DISCOGS_PORT}`,
        DISCOGS_WEB_URL: `http://localhost:${DISCOGS_PORT}`,
        DISCOGS_CONSUMER_KEY: 'e2e-key',
        DISCOGS_CONSUMER_SECRET: 'e2e-secret',
        // Throwaway key for the throwaway e2e database.
        FERNET_KEY: 'kC3i6m0y8lP2YcQJm0b2o8h0m3nq7yq1r8w0o1b9m4s=',
        IMPORT_POLL_SECONDS: '0.5',
        DISCOGS_RATE_PER_MINUTE: '100000',
      },
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      env: { API_PROXY: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})

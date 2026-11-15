# Deployment and operations

Groove runs as three Docker Compose services on one Linux host. Step-by-step instructions for a
first install are in the [root README](../README.md#deploying-to-your-own-server-vps); automated
deploys from GitHub Actions are described in [.github/DEPLOY.md](../.github/DEPLOY.md).

## Topology

| Service | Listens | Persists |
|---|---|---|
| `web` (Caddy) | host `HTTP_PORT` → 80, `HTTPS_PORT` → 443 | `caddy_data` (certificates) |
| `api` (uvicorn, single process) | 8000 inside the network | `covers` → `/srv/api/covers` |
| `db` (PostgreSQL 16) | 5432 inside the network | `dbdata` |

The Compose project name is fixed (`name: groove`), so containers and volumes are always
`groove-*` / `groove_*`. Startup is gated by health checks (`db` → `api` → `web`). All services
use `restart: unless-stopped`.

Caddy (`web/Caddyfile`):

- `/api/*` → `api:8000`, body limit 11 MB;
- `/assets/*` → static files cached for a year (hashed names);
- everything else → `index.html` with `Cache-Control: no-cache` (SPA fallback, so a deploy is
  picked up immediately);
- security headers on every response (see [security.md](security.md));
- automatic HTTPS when `SITE_ADDRESS` is a domain.

The API container runs `alembic upgrade head` and then uvicorn on every start.

## Configuration

All configuration is environment variables from `.env` (template: `.env.example`).

| Variable | Used by | Purpose |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | db, api | Database credentials (`POSTGRES_PASSWORD` is required) |
| `DATABASE_URL` | api (outside Docker) | Built by Compose from the values above |
| `FERNET_KEY` | api | Encrypts members' Discogs tokens |
| `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET` | api | Discogs application credentials |
| `PUBLIC_BASE_URL` | api | Public URL; `https://` makes cookies `Secure`; OAuth callback base |
| `API_DOCS_ENABLED` | api | Swagger UI and OpenAPI JSON (off by default in Compose) |
| `SITE_ADDRESS` | web | Domain for Caddy (default `:80`, plain HTTP) |
| `HTTP_PORT`, `HTTPS_PORT` | web | Host ports (defaults 8080 / 8443; use 80 / 443 on a server) |
| `API_IMAGE`, `WEB_IMAGE`, `APP_VERSION` | compose | Image names and tag (empty = built locally) |

Other API settings (session length, limits, Discogs rate) have defaults in
`api/app/core/config.py` and can be overridden by environment variables of the same name.

## CI/CD

`.github/workflows/ci.yml`, on every push and pull request:

1. API: `ruff check` + `pytest` on a Postgres 16 service.
2. Web: `oxlint`, `vitest`, `tsc + vite build`, `schemas:check`.
3. Audit: `npm audit` and `pip-audit` (reports, does not block).
4. Images: build `groove-api` and `groove-web` (pushed to GHCR only from `main`).
5. Deploy (push to `main`, all green): over SSH runs `scripts/deploy.sh <version> <registry>
   <user>` on the server — backup, pull images, restart, wait for the API health check, and roll
   back to the previous version if it does not become healthy.

## Backups

| What | How | Contents |
|---|---|---|
| Server backup | `scripts/backup.sh` (cron nightly) | `backups/<YYYYmmdd-HHMMSS>/db.dump` (`pg_dump -Fc`) + `covers.tar` |
| Restore | `scripts/restore.sh <dir>` | Asks to type `si`, **replaces** DB and covers, restarts |
| In-app export | Settings → Backup (`GET /api/backup`) | JSON of records and places; no covers, no tokens |
| In-app import | Settings → Backup (`POST /api/backup/import`) | Adds records and places; never deletes |

`backups/` is git-ignored (it is the family's data). Copy it off the server regularly.

## Upgrades and rollbacks

- Upgrade: back up, then `APP_VERSION=<new> docker compose up -d --build` (or let CI deploy).
- Roll back: `APP_VERSION=<old> docker compose up -d --no-build` (old images stay on the host).
- Migrations only go forward. If the new version applied a migration the old one does not
  understand, restore the backup taken before the upgrade.

## Operational don'ts

- Never run `docker compose down -v`: it deletes `dbdata`, `covers` and `caddy_data`.
- Never run `scripts/restore.sh` without an explicit decision: it is destructive.
- Never write secrets into `backups/` or commit `.env`.
- Keep `scripts/*.sh` POSIX `sh` (`set -eu`); they run on a plain VPS and from cron.

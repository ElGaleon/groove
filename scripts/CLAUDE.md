# CLAUDE.md — scripts/

Operational shell scripts for the Docker Compose deployment (POSIX `sh`, `set -eu`). They `cd`
to the project root and talk to the running `db` and `api` containers.

- `backup.sh` — `pg_dump -Fc` of the database + tar of `/srv/api/covers` into
  `backups/<YYYYmmdd-HHMMSS>/`.
- `restore.sh <backup-dir>` — asks for confirmation, then **replaces** database and covers and
  restarts the stack. Destructive: never run it without the user's explicit request.

Rules: keep them POSIX `sh` (they run on a plain Linux VPS and from cron), keep user messages in
Italian like the existing ones, and never write secrets into `backups/`. Don't run
`docker compose down -v` anywhere — it deletes the data volumes.

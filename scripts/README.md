# Scripts

Backup and restore for the Docker Compose deployment. Run them from anywhere; they switch to the
project root and use the running `db` and `api` containers.

## Backup

```bash
scripts/backup.sh
```

Writes `backups/<YYYYmmdd-HHMMSS>/db.dump` (PostgreSQL custom format) and `covers.tar`.

Nightly with cron:

```bash
0 3 * * * cd /path/to/project && scripts/backup.sh >> backups/backup.log 2>&1
```

Copy `backups/` off the server regularly.

## Restore

```bash
scripts/restore.sh backups/20261113-030000
```

Asks you to type `si`, stops the app, **replaces** the database and covers with the backup, and
starts everything again.

> `backups/` is git-ignored: it contains your family's data.

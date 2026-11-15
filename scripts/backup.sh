#!/bin/sh
# Backup of the database and the cover images into ./backups/<timestamp>/ (run from the project folder).
# Usage: scripts/backup.sh        Restore: see "Ripristino" in the README.
set -eu
cd "$(dirname "$0")/.."
stamp=$(date +%Y%m%d-%H%M%S)
dir="backups/$stamp"
mkdir -p "$dir"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB"' > "$dir/db.dump"
docker compose exec -T api tar -C /srv/api -cf - covers > "$dir/covers.tar"
echo "Backup salvato in $dir ($(du -sh "$dir" | cut -f1))"

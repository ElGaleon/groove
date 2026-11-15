#!/bin/sh
# Restores a backup made by scripts/backup.sh. It REPLACES the current data.
# Usage: scripts/restore.sh backups/20261113-101500
set -eu
cd "$(dirname "$0")/.."
dir="${1:?indica la cartella del backup, per esempio backups/20261113-101500}"
[ -f "$dir/db.dump" ] && [ -f "$dir/covers.tar" ] || { echo "Backup non valido: $dir"; exit 1; }
printf 'Questo sostituisce i dati attuali con %s. Scrivi "si" per continuare: ' "$dir"
read -r answer
[ "$answer" = "si" ] || { echo "Annullato."; exit 1; }
docker compose stop api web
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < "$dir/db.dump"
docker compose run --rm --no-deps -T --entrypoint sh api -c 'rm -rf /srv/api/covers/* && tar -C /srv/api -xf -' < "$dir/covers.tar"
docker compose up -d
echo "Ripristino completato."

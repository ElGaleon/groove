#!/bin/sh
# Deploy of a version published by GitHub Actions (run on the VPS, from the project folder).
# Usage: scripts/deploy.sh <version> <registry> <registry-user>   (registry token on stdin)
#   e.g. echo "$TOKEN" | scripts/deploy.sh 3f2c1ab ghcr.io/owner owner
# Steps: backup, pull the images, restart, wait for the API; on failure go back to the
# previous version. Never runs `docker compose down -v`.
set -eu
cd "$(dirname "$0")/.."

version=${1:?versione mancante}
registry=${2:?registry mancante}
registry_user=${3:?utente registry mancante}

[ -f .env ] || { echo "Manca il file .env in $(pwd): copialo da .env.example e compilalo." >&2; exit 1; }

# Set (or add) KEY=value in .env, leaving every other line as it is.
set_env() {
	if grep -q "^$1=" .env; then
		sed -i "s|^$1=.*|$1=$2|" .env
	else
		printf '%s=%s\n' "$1" "$2" >> .env
	fi
}

wait_healthy() {
	i=0
	while [ "$i" -lt 40 ]; do
		id=$(docker compose ps -q api)
		state=$( [ -n "$id" ] && docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo assente)
		[ "$state" = healthy ] && return 0
		i=$((i + 1))
		sleep 3
	done
	return 1
}

previous=$(sed -n 's/^APP_VERSION=//p' .env | tail -n 1)

echo "Accesso al registry $registry..."
docker login "${registry%%/*}" -u "$registry_user" --password-stdin >/dev/null

if [ -n "$(docker compose ps -q db 2>/dev/null)" ]; then
	echo "Backup prima dell'aggiornamento..."
	sh scripts/backup.sh
fi

set_env API_IMAGE "$registry/groove-api"
set_env WEB_IMAGE "$registry/groove-web"
set_env APP_VERSION "$version"

echo "Scarico la versione $version..."
if ! docker compose pull api web; then
	docker logout "${registry%%/*}" >/dev/null 2>&1 || true
	[ -n "$previous" ] && set_env APP_VERSION "$previous"
	echo "Download non riuscito: resta in funzione la versione precedente." >&2
	exit 1
fi
docker logout "${registry%%/*}" >/dev/null 2>&1 || true

docker compose up -d --no-build --remove-orphans

if wait_healthy; then
	docker image prune -f >/dev/null
	echo "Versione $version in funzione."
	exit 0
fi

echo "L'API non risponde: log recenti:" >&2
docker compose logs --tail 50 api >&2 || true
if [ -n "$previous" ] && [ "$previous" != "$version" ]; then
	echo "Ritorno alla versione $previous (le migrazioni già applicate restano: vedi backups/)." >&2
	set_env APP_VERSION "$previous"
	docker compose up -d --no-build --remove-orphans
fi
exit 1

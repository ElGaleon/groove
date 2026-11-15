# Deploy automatico sulla VPS

Il workflow `.github/workflows/ci.yml` fa, a ogni push e pull request:

1. **API** — `ruff check` + `pytest` su un Postgres 16 di servizio.
2. **Web** — `oxlint`, `vitest`, `tsc + vite build`, `schemas:check`.
3. **Audit** — `npm audit` e `pip-audit` (segnala, non blocca il deploy).
4. **Immagini** — build di `groove-api` e `groove-web` (pubblicate su GHCR solo da `main`).
5. **Deploy** (solo push su `main`, dopo che tutto è verde) — via SSH lancia
   `scripts/deploy.sh` sulla VPS: backup → pull delle immagini → riavvio → attesa
   dell'healthcheck → ritorno alla versione precedente se l'API non risponde.

## Preparazione della VPS (una volta)

```sh
# Docker + plugin compose installati; un utente dedicato nel gruppo docker
sudo adduser --disabled-password deploy && sudo usermod -aG docker deploy
sudo -u deploy mkdir -p /home/deploy/groove
# Copia .env.example in /home/deploy/groove/.env e compilalo (POSTGRES_PASSWORD, FERNET_KEY,
# SITE_ADDRESS=tuo.dominio, HTTP_PORT=80, HTTPS_PORT=443, PUBLIC_BASE_URL=https://tuo.dominio)
```

Chiave SSH solo per il deploy (sul tuo computer):

```sh
ssh-keygen -t ed25519 -f groove_deploy -N "" -C "github-actions-groove"
ssh-copy-id -i groove_deploy.pub deploy@<host>
ssh-keyscan -p 22 <host>        # output → secret VPS_KNOWN_HOSTS
```

## Secret del repository (Settings → Environments → `production`)

| Secret | Valore |
|---|---|
| `VPS_HOST` | IP o hostname della VPS |
| `VPS_USER` | `deploy` |
| `VPS_PORT` | porta SSH (facoltativo, default 22) |
| `VPS_PATH` | `/home/deploy/groove` |
| `VPS_SSH_KEY` | contenuto di `groove_deploy` (chiave privata) |
| `VPS_KNOWN_HOSTS` | output di `ssh-keyscan` (blocca attacchi man-in-the-middle) |

Consigliato: in **Settings → Branches** proteggi `main` richiedendo i check `API · ruff + pytest`
e `Web · lint + test + build`; nell'environment `production` puoi aggiungere un'approvazione
manuale prima di ogni deploy.

## Rollback manuale

```sh
cd /home/deploy/groove
sed -i 's/^APP_VERSION=.*/APP_VERSION=<sha-precedente>/' .env
docker compose up -d --no-build
```

Le migrazioni vanno solo avanti: se una versione nuova ha cambiato il database, per tornare
indietro serve anche `scripts/restore.sh backups/<cartella>` (backup fatto da ogni deploy).

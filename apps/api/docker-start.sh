#!/bin/sh
# Start command for the self-hosted Docker Compose stack (docker-compose.yml).
#
# When .env doesn't set JWT_SECRET or CALENDAR_ENCRYPTION_KEY, generate them
# once and keep them in the api_secrets volume, so logins and stored calendar
# credentials survive restarts and rebuilds.
set -e

SECRETS_DIR=/app/secrets
mkdir -p "$SECRETS_DIR"

# $1 = variable name, $2 = random bytes encoding (base64 or hex)
ensure_secret() {
  file="$SECRETS_DIR/$1"
  if [ -z "$(printenv "$1")" ]; then
    if [ ! -s "$file" ]; then
      node -e "process.stdout.write(require('crypto').randomBytes(32).toString('$2'))" > "$file"
      echo "[Start] Generated $1 in the api_secrets volume"
    fi
    export "$1=$(cat "$file")"
  fi
}

ensure_secret JWT_SECRET base64
ensure_secret CALENDAR_ENCRYPTION_KEY hex

# Compose does not permit nesting variable defaults, so assemble the local
# Postgres connection string here only when the user did not provide one.
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="postgresql://${POSTGRES_USER:-opensunsama}:${POSTGRES_PASSWORD:-opensunsama}@postgres:5432/${POSTGRES_DB:-opensunsama}"
fi

exec node dist/index.js

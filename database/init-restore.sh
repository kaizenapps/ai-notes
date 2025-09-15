#!/bin/sh
set -eu

# init script runs inside postgres container on first initialization
# It restores /docker-entrypoint-initdb.d/01-database.sql whether it's a
# custom-format dump or a plain SQL file.

DB_NAME=${POSTGRES_DB:-session_notes}
DB_USER=${POSTGRES_USER:-session_user}
SQL_PATH="/docker-entrypoint-initdb.d/01-database.sql"

if [ ! -f "$SQL_PATH" ]; then
  echo "[init-restore] No database file found at $SQL_PATH, skipping."
  exit 0
fi

# Detect custom-format dump
# Custom dump starts with: PGDMP\n
if head -c 5 "$SQL_PATH" | grep -q "PGDMP"; then
  echo "[init-restore] Detected custom-format dump. Restoring with pg_restore..."
  # Create the target DB if not already created by entrypoint
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" WITH TEMPLATE=template0 ENCODING='UTF8';" || true
  # Restore
  pg_restore -v -U "$DB_USER" -d "$DB_NAME" "$SQL_PATH"
  echo "[init-restore] pg_restore completed."
else
  echo "[init-restore] Detected plain SQL. Restoring with psql..."
  psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f "$SQL_PATH"
  echo "[init-restore] psql restore completed."
fi

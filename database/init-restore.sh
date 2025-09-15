#!/bin/sh
set -eu

# init script runs inside postgres container on first initialization
# It restores /docker-entrypoint-initdb.d/01-database.sql whether it's a
# custom-format dump or a plain SQL file.

DB_NAME=${POSTGRES_DB:-session_notes}
DB_USER=${POSTGRES_USER:-session_user}
# Support either custom dump (.dump) or plain SQL (.sql)
DUMP_PATH="/docker-entrypoint-initdb.d/01-database.dump"
SQL_PATH="/docker-entrypoint-initdb.d/01-database.sql"
READY_FLAG="/var/lib/postgresql/data/.restored_ok"

rm -f "$READY_FLAG" || true

# Prefer custom dump if present, else use SQL
SRC_FILE=""
if [ -f "$DUMP_PATH" ]; then
  SRC_FILE="$DUMP_PATH"
elif [ -f "$SQL_PATH" ]; then
  SRC_FILE="$SQL_PATH"
else
  echo "[init-restore] No database dump found (.dump or .sql), skipping."
  exit 0
fi

# Detect custom-format dump
# Custom dump starts with: PGDMP\n
if head -c 5 "$SRC_FILE" | grep -q "PGDMP"; then
  echo "[init-restore] Detected custom-format dump. Restoring with pg_restore..."
  # Restore
  # Drop/clean if objects exist; ignore owner/privileges; map ownership to DB_USER
  if pg_restore \
    --clean --if-exists \
    --no-owner --no-privileges \
    --role "$DB_USER" \
    -v -U "$DB_USER" -d "$DB_NAME" "$SRC_FILE"; then
    echo "[init-restore] pg_restore completed."
    touch "$READY_FLAG"
  else
    echo "[init-restore] pg_restore failed." >&2
    exit 1
  fi
else
  echo "[init-restore] Detected plain SQL. Restoring with psql..."
  if psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -f "$SRC_FILE"; then
    echo "[init-restore] psql restore completed."
    touch "$READY_FLAG"
  else
    echo "[init-restore] psql restore failed." >&2
    exit 1
  fi
fi

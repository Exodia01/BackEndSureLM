#!/bin/bash
# PostgreSQL backup script for SureLM
# Usage: ./scripts/backup-db.sh [output_directory]
#
# Requires: pg_dump (from postgresql-client), running PostgreSQL container
# The backup is a plain SQL dump suitable for pg_restore.

set -euo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${OUTPUT_DIR}/surelm_0-${TIMESTAMP}.sql"

# Read from environment or .env file
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-6432}"
PG_DB="${PGDATABASE:-surelm_0}"
PG_USER="${PGUSER:-${POSTGRES_USER:-surelm_dev_user}}"

mkdir -p "${OUTPUT_DIR}"

echo "[backup] Starting PostgreSQL dump..."
echo "[backup] Target: ${PG_USER}@${PG_HOST}:${PG_PORT}/${PG_DB}"
echo "[backup] Output: ${BACKUP_FILE}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${PG_HOST}" \
  -p "${PG_PORT}" \
  -U "${PG_USER}" \
  -d "${PG_DB}" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  -f "${BACKUP_FILE}"

FILESIZE=$(wc -c < "${BACKUP_FILE}")
echo "[backup] Complete: ${BACKUP_FILE} (${FILESIZE} bytes)"

# Keep only the last 7 backups
BACKUP_COUNT=$(ls -1 "${OUTPUT_DIR}"/surelm_0-*.sql 2>/dev/null | wc -l)
if [ "${BACKUP_COUNT}" -gt 7 ]; then
  REMOVED=$(ls -1t "${OUTPUT_DIR}"/surelm_0-*.sql | tail -n +8 | xargs rm -v)
  echo "[backup] Pruned old backups: ${REMOVED}"
fi

echo "[backup] Done."

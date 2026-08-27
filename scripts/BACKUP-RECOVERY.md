# Database Backup & Recovery — SureLM

## Backup Procedure

### Automated (recommended)

```bash
./scripts/backup-db.sh ./backups
```

Creates timestamped SQL dumps at `./backups/surelm_0-YYYYMMDD-HHMMSS.sql`.
Retains the last 7 backups automatically.

### Manual (one-off)

```bash
docker compose exec postgres pg_dump -U surelm_dev_user -d surelm_0 --clean --if-exists > backup.sql
```

### What is backed up

| Component | Method | Tool |
|-----------|--------|------|
| PostgreSQL (surelm_0) | SQL dump via `pg_dump` | `scripts/backup-db.sh` |
| Qdrant vectors | Not yet automated | Manual: `curl -X POST http://localhost:6334/collections/{name}/snapshots` |
| Uploaded PDFs | Filesystem copy | `cp -r <SCANNING_FOLDER_PATH> ./backups/pdfs/` |
| Environment config | Git-ignored `.env` files | Document in deployment runbook |

### Qdrant snapshot (manual)

```bash
# List collections
curl http://localhost:6334/collections

# Create snapshot for each collection
curl -X POST http://localhost:6334/collections/policy_chunks/snapshots
curl -X POST http://localhost:6334/collections/document_chunks/snapshots
```

## Recovery Procedure

### PostgreSQL restore

```bash
# From a backup file
PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h localhost -p 6432 -U surelm_dev_user -d surelm_0 \
  -f ./backups/surelm_0-YYYYMMDD-HHMMSS.sql

# Or via Docker
docker compose exec -T postgres psql -U surelm_dev_user -d surelm_0 < ./backups/surelm_0-YYYYMMDD-HHMMSS.sql
```

### Full recovery checklist

1. Stop the application (`docker compose stop` or deploy halt)
2. Restore PostgreSQL: `psql -f <backup>.sql`
3. Restore Qdrant snapshots (if available)
4. Re-copy PDF files to `SCANNING_FOLDER_PATH`
5. Re-run brochure processing: `POST /api/brochures/batch`
6. Verify: `GET /api/health` returns `{"status":"healthy"}`
7. Restart application

### RPO / RTO targets

| Metric | Target | Notes |
|--------|--------|-------|
| RPO (Recovery Point) | 24 hours | Daily automated backups |
| RTO (Recovery Time) | 1 hour | PostgreSQL restore + Qdrant rebuild |

## Docker Compose backup (full stack)

```bash
# Stop containers (preserves volumes)
docker compose stop

# Backup PostgreSQL data volume
docker run --rm -v surelm_0_postgres_data_0:/data -v $(pwd)/backups:/backup alpine \
  tar czf /backup/postgres-volume-$(date +%Y%m%d).tar.gz -C /data .

# Restart
docker compose start
```

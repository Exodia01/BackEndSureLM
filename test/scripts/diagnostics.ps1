$ErrorActionPreference = "Continue"

Write-Host "=== FTS DIAGNOSTIC QUERIES ===" -ForegroundColor Cyan
Write-Host ""

# Query 1: Chunk Count
Write-Host "--- Query 1: Chunk Count ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT COUNT(*) as chunk_count FROM \"Chunk\";"
Write-Host ""

# Query 2: Sample Content
Write-Host "--- Query 2: Sample Chunk Content ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT id, LEFT(content, 200) as snippet, LENGTH(content) as content_length FROM \"Chunk\" LIMIT 10;"
Write-Host ""

# Query 3a: FTS with 'term life'
Write-Host "--- Query 3a: FTS with term life ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT c.id as chunk_id, c.content, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'term life')) as score FROM \"Chunk\" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'term life') ORDER BY score DESC;"
Write-Host ""

# Query 3b: FTS with 'waiting period'
Write-Host "--- Query 3b: FTS with waiting period ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT c.id, c.content, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'waiting period')) as score FROM \"Chunk\" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'waiting period') ORDER BY score DESC;"
Write-Host ""

# Query 4: Text Vector Inspection
Write-Host "--- Query 4: Text.Vector Inspection ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT id, LEFT(content, 100) as content, to_tsvector('english', content) as tsv_vector, plainto_tsquery('english', 'waiting period') as query_obj, to_tsvector('english', content) @@ plainto_tsquery('english', 'waiting period') as matches FROM \"Chunk\" LIMIT 5;"
Write-Host ""

# Query 5: EXPLAIN ANALYZE
Write-Host "--- Query 5: EXPLAIN ANALYZE ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "EXPLAIN ANALYZE SELECT c.id, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'waiting period')) as score FROM \"Chunk\" c WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'waiting period') ORDER BY score DESC;"
Write-Host ""

# Query 6: Schema Verification
Write-Host "--- Query 6: Schema Verification ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_name ILIKE '%chunk%';"
docker exec surelm-postgres psql -U admin -d surelm -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Chunk';"
Write-Host ""

# Query 7: Disable Index Scan Test
Write-Host "--- Query 7: Disable Index.Scan Test ---" -ForegroundColor Yellow
docker exec surelm-postgres psql -U admin -d surelm -c "SET enable_indexscan = OFF; SET enable_bitmapscan = OFF; EXPLAIN ANALYZE SELECT c.id FROM \"Chunk\" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'waiting period');"
Write-Host ""

Write-Host "=== DIAGNOSTICS COMPLETE ===" -ForegroundColor Cyan

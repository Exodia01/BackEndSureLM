-- Query 1: Chunk Count
SELECT COUNT(*) as chunk_count FROM "Chunk";

-- Query 2: Sample Content
SELECT id, LEFT(content, 200) as snippet, LENGTH(content) as content_length FROM "Chunk" LIMIT 10;

-- Query 3a: FTS with 'term life'
SELECT c.id as chunk_id, c.content, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'term life')) as score FROM "Chunk" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'term life') ORDER BY score DESC;

-- Query 3b: FTS with 'waiting period'
SELECT c.id, c.content, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'waiting period')) as score FROM "Chunk" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'waiting period') ORDER BY score DESC;

-- Query 4: Text Vector Inspection
SELECT id, LEFT(content, 100) as content, to_tsvector('english', content) as tsv_vector, plainto_tsquery('english', 'waiting period') as query_obj, to_tsvector('english', content) @@ plainto_tsquery('english', 'waiting period') as matches FROM "Chunk" LIMIT 5;

-- Query 5: EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT c.id, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'waiting period')) as score FROM "Chunk" c WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'waiting period') ORDER BY score DESC;

-- Query 6: Schema Verification
SELECT table_name, table_type FROM information_schema.tables WHERE table_name ILIKE '%chunk%';
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'Chunk';

-- Query 7: Disable Index Scan Test
SET enable_indexscan = OFF;
SET enable_bitmapscan = OFF;
EXPLAIN ANALYZE SELECT c.id FROM "Chunk" c WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'waiting period');

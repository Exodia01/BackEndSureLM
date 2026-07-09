-- Insert test document with proper cuid format
INSERT INTO "Document" ("id", filename, source) 
VALUES ('01gpxxxxxxxx000000000000', 'test.pdf', 'local') RETURNING id;

-- Insert a test chunk with FTS-indexed content
INSERT INTO "Chunk" ("id", "documentId", content, "chunkOrder") 
VALUES ('01hpxxxxxxxx000000000000', '01gpxxxxxxxx000000000000', 
        'Term life insurance provides coverage for a specified period. Premiums are fixed during the term.', 1);

-- Verify data was inserted
SELECT id, filename FROM "Document";
SELECT id, "documentId", content FROM "Chunk" LIMIT 5;

-- Test FTS query (should use GIN index on to_tsvector)
EXPLAIN ANALYZE 
SELECT c.id, ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'term life')) as score
FROM "Chunk" c
WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'term life')
ORDER BY score DESC;

SELECT 
  c.id as chunk_id,
  ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', 'term life')) as score
FROM "Chunk" c
WHERE to_tsvector('english', c.content) @@ plainto_tsquery('english', 'term life')
ORDER BY score DESC;

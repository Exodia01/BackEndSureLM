DELETE FROM "Chunk" WHERE "documentId" IN (SELECT id FROM "Document" WHERE filename LIKE 'test-%');
DELETE FROM "Document" WHERE filename LIKE 'test-%';
INSERT INTO "Document" ("id", filename, source) VALUES ('test-doc-001', 'test-term.pdf', 'insurer-test') RETURNING id;

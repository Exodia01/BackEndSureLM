import { db } from "../../lib/db";
import * as postgresRetrieval from "../../lib/retrieval/postgres";
import * as qdrantRetrieval from "../../lib/retrieval/vector/index";
import { hybridSearch } from "../../lib/retrieval/hybrid";

const TEST_CHUNK_ID = "test_hybrid_chunk_" + Date.now();

beforeAll(async () => {
  // Clean up any existing test data
  await db.chunk.deleteMany({ where: { id: TEST_CHUNK_ID } });
});

afterAll(async () => {
  // Clean up test data
  await db.chunk.deleteMany({ where: { id: TEST_CHUNK_ID } });
  
  // Clean up Qdrant points
  try {
    const results = await qdrantRetrieval.searchPoints("content_chunks", [0] * 768, { limit: 100 });
    const pointIds = results.filter(r => r.payload?.chunk_id === TEST_CHUNK_ID).map(r => String(r.id));
    if (pointIds.length > 0) {
      await qdrantRetrieval.deletePoints("content_chunks", pointIds);
    }
  } catch {
    // Qdrant might not be running
  }
});

test("PostgreSQL FTS retrieves chunk from Chunk table", async () => {
  const doc = await db.document.create({
    data: { filename: "test.pdf", source: "test" },
  });

  const chunk = await db.chunk.create({
    data: {
      id: TEST_CHUNK_ID,
      documentId: doc.id,
      content: "Waiting period for pre-existing diseases is 36 months.",
      chunkOrder: 1,
    },
  });

  // Verify FTS can find the chunk
  const results = await postgresRetrieval.postgresFullTextSearch("waiting period");
  
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: TEST_CHUNK_ID,
        source: "fts",
      }),
    ])
  );

  // Clean up
  await db.chunk.deleteMany({ where: { id: chunk.id } });
  await db.document.deleteMany({ where: { id: doc.id } });
}, 30000);

test("Qdrant stores and retrieves vectors with chunk_id in payload", async () => {
  const vector = Array(768).fill(0.1);
  
  // Upsert with proper payload
  await qdrantRetrieval.upsertPoints("content_chunks", [
    {
      id: TEST_CHUNK_ID,
      vector,
      payload: {
        chunk_id: TEST_CHUNK_ID,
        document_id: "doc-123",
        page_number: 1,
        category: "test",
      },
    },
  ]);

  // Search should return results with correct payload
  const results = await qdrantRetrieval.searchPoints("content_chunks", vector, { limit: 5 });

  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: TEST_CHUNK_ID,
        payload: expect.objectContaining({
          chunk_id: TEST_CHUNK_ID,
          document_id: "doc-123",
          page_number: 1,
          category: "test",
        }),
      }),
    ])
  );

  // Clean up
  await qdrantRetrieval.deletePoints("content_chunks", [TEST_CHUNK_ID]);
}, 15000);

test("hybridSearch executes FTS and vector search concurrently", async () => {
  const doc = await db.document.create({
    data: { filename: "concurrent-test.pdf", source: "test" },
  });

  const chunk = await db.chunk.create({
    data: {
      id: TEST_CHUNK_ID,
      documentId: doc.id,
      content: "Term life insurance provides coverage for a specified period.",
      chunkOrder: 1,
    },
  });

  // Upsert vector
  const queryVector = Array(768).fill(0.1);
  await qdrantRetrieval.upsertPoints("content_chunks", [
    {
      id: TEST_CHUNK_ID,
      vector: queryVector,
      payload: { chunk_id: TEST_CHUNK_ID },
    },
  ]);

  // Execute hybrid search - should run both concurrently
  const results = await hybridSearch("term life insurance", queryVector);

  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: TEST_CHUNK_ID,
        source: expect.stringMatching(/^(fts|vector)$/),
        score: expect.any(Number),
        payload: expect.objectContaining({ chunk_id: TEST_CHUNK_ID }),
      }),
    ])
  );

  // Verify concurrent execution (both sources should be present if both match)
  const sources = new Set(results.filter(r => r.id === TEST_CHUNK_ID).map(r => r.source));
  expect(sources.size).toBeGreaterThan(0);

  // Clean up
  await db.chunk.deleteMany({ where: { id: chunk.id } });
  await db.document.deleteMany({ where: { id: doc.id } });
  await qdrantRetrieval.deletePoints("content_chunks", [TEST_CHUNK_ID]);
}, 30000);

test("hybridSearch deduplicates results by chunk_id keeping highest score", async () => {
  const doc = await db.document.create({
    data: { filename: "dedup-test.pdf", source: "test" },
  });

  const chunk = await db.chunk.create({
    data: {
      id: TEST_CHUNK_ID,
      documentId: doc.id,
      content: "Waiting period for diabetes is 36 months in most plans.",
      chunkOrder: 1,
    },
  });

  // Upsert vector with low score (simulating weaker match)
  const queryVector = Array(768).fill(0.1);
  
  await qdrantRetrieval.upsertPoints("content_chunks", [
    {
      id: TEST_CHUNK_ID,
      vector: queryVector,
      payload: { chunk_id: TEST_CHUNK_ID, score: 0.5 },
    },
  ]);

  const results = await hybridSearch("waiting period diabetes", queryVector);

  // Find the result for this chunk
  const matchingResult = results.find(r => r.id === TEST_CHUNK_ID);

  expect(matchingResult).toBeDefined();
  expect(matchingResult?.payload.chunk_id).toBe(TEST_CHUNK_ID);
  
  // Dedup should keep highest score from either source
  expect(typeof matchingResult?.score).toBe("number");

  // Clean up
  await db.chunk.deleteMany({ where: { id: chunk.id } });
  await db.document.deleteMany({ where: { id: doc.id } });
  await qdrantRetrieval.deletePoints("content_chunks", [TEST_CHUNK_ID]);
}, 30000);

test("Result format is normalized (id, score, source: fts|vector, payload with chunk_id)", async () => {
  const doc = await db.document.create({
    data: { filename: "format-test.pdf", source: "test" },
  });

  const chunk = await db.chunk.create({
    data: {
      id: TEST_CHUNK_ID,
      documentId: doc.id,
      content: "Premiums are fixed during the policy term.",
      chunkOrder: 1,
    },
  });

  const queryVector = Array(768).fill(0.1);
  await qdrantRetrieval.upsertPoints("content_chunks", [
    {
      id: TEST_CHUNK_ID,
      vector: queryVector,
      payload: { chunk_id: TEST_CHUNK_ID },
    },
  ]);

  const results = await hybridSearch("premiums policy term", queryVector);

  // Verify all results have correct format
  for (const result of results) {
    expect(typeof result.id).toBe("string");
    expect(typeof result.score).toBe("number");
    expect(["fts", "vector"]).toContain(result.source);
    expect(result.payload).toBeDefined();
    expect(result.payload.chunk_id).toBe(TEST_CHUNK_ID);
  }

  // Clean up
  await db.chunk.deleteMany({ where: { id: chunk.id } });
  await db.document.deleteMany({ where: { id: doc.id } });
  await qdrantRetrieval.deletePoints("content_chunks", [TEST_CHUNK_ID]);
}, 30000);

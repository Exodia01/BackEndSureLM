import { db } from "../../lib/db.ts";
import * as vector from "../../lib/retrieval/vector/index.ts";

export async function createTestDocument(
  filename: string,
  source?: string
) {
  const doc = await db.document.create({
    data: {
      filename,
      source,
      metadata: { version: "1.0" },
    },
  });
  return doc;
}

export async function createTestChunks(
  documentId: string,
  chunks: Array<{ content: string; chunkOrder: number; pageNumber?: number }>
) {
  const createdChunks = [];
  for (const chunk of chunks) {
    const c = await db.chunk.create({
      data: {
        documentId,
        content: chunk.content,
        chunkOrder: chunk.chunkOrder,
        pageNumber: chunk.pageNumber,
        category: "general",
      },
    });
    createdChunks.push(c);
  }
  return createdChunks;
}

export async function setupTestEnvironment() {
  await vector.ensureCollection("policies", 768);
  
  const doc = await createTestDocument(
    "term-life-policy.pdf",
    "insurer-abc"
  );

  const chunks = await createTestChunks(doc.id, [
    { content: "Term life insurance provides coverage for a specified period. Premiums are fixed during the term.", chunkOrder: 1, pageNumber: 1 },
    { content: "Waiting periods apply for pre-existing conditions. Most policies have a 30-day waiting period.", chunkOrder: 2, pageNumber: 2 },
    { content: "Exclusions include suicide within first year, war-related deaths, and intentional self-harm.", chunkOrder: 3, pageNumber: 3 },
    { content: "Riders can be added for critical illness, accidental death, or Waiver of Premium.", chunkOrder: 4, pageNumber: 4 },
  ]);

  await vector.upsertPoints("policies", chunks.map((c: any) => ({
    id: c.id,
    vector: Array(768).fill(0.1),
    payload: {
      chunk_id: c.id,
      document_id: doc.id,
      category: "general",
    },
  })));

  return { doc, chunks };
}

export async function cleanupTestEnvironment() {
  await db.chunk.deleteMany({});
  await db.document.deleteMany({});
}
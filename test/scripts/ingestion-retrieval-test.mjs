import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const TEST_PDF_PATH = "test/Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf";
const CHUNK_SIZE = 500;
const VECTOR_DIMENSION = 768;

console.log("=== PDF Ingestion & Hybrid Retrieval Pipeline ===\n");

try {
  console.log("[Step 1] Extracting text from PDF...");
  const { extractPDF } = await import(`./${TEST_PDF_PATH}`.startsWith('test/') ? '../lib/pdf/extract.js' : '../lib/pdf/extract.mjs');
  
  const textPages = await extractPDF(TEST_PDF_PATH);
  console.log(`[OK] Extracted ${textPages.length} pages from PDF\n`);

  console.log("[Step 2] Chunking text...");
  const { chunkText } = await import('../lib/pdf/chunk.ts');
  const chunks = chunkText(textPages, CHUNK_SIZE, 50);
  console.log(`[OK] Created ${chunks.length} chunks\n`);

  console.log("[Step 3] Generating embeddings...");
  const { generateEmbeddings } = await import('../lib/ai/embeddings.ts');
  const vectors = await generateEmbeddings(chunks.map(c => c.content));
  console.log(`[OK] Generated ${vectors.length} embeddings (dimension: ${vectors[0].length})\n`);

  console.log("[Step 4] Storing in PostgreSQL...");
  const { db } = await import('../lib/db.ts');
  
  const doc = await db.document.create({
    data: {
      filename: "Kotak_Premier_Life_Plan", 
      source: "brochure",
      metadata: { version: "2020-06-18" }
    }
  });
  console.log(`[OK] Created document in Postgres (id: ${doc.id})`);

  const chunkRecords = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = await db.chunk.create({
      data: {
        id: `chunk_${i}_${Date.now()}`,
        documentId: doc.id,
        content: chunks[i].content,
        chunkOrder: i,
        pageNumber: chunks[i].metadata[0]?.page || 1,
        category: "insurance"
      }
    });
    chunkRecords.push({ id: c.id, order: i });
  }
  console.log(`[OK] Stored ${chunkRecords.length} chunk records in Postgres\n`);

  console.log("[Step 5] Storing vectors in Qdrant...");
  const { ensureCollection, upsertPoints } = await import('../lib/retrieval/vector/index.ts');
  
  await ensureCollection("content_chunks", VECTOR_DIMENSION);
  
  const points = chunkRecords.map((c) => ({
    id: c.id,
    vector: vectors[c.order],
    payload: {
      chunk_id: c.id,
      document_id: doc.id,
      page_number: chunks[c.order].metadata[0]?.page || 1,
      category: "insurance"
    }
  }));
  
  await upsertPoints("content_chunks", points);
  console.log(`[OK] Stored ${points.length} vector points in Qdrant (collection: content_chunks)\n`);

  console.log("[Step 6] Testing hybrid retrieval...\n");

  const { hybridSearch } = await import('../lib/retrieval/hybrid.ts');

  const queries = [
    "minimum entry age",
    "premium payment term", 
    "benefits available under the plan"
  ];

  const queryVectors = queries.map(() => Array(VECTOR_DIMENSION).fill(0.1));

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    const vector = queryVectors[i];

    console.log(`--- Query: "${query}" ---`);
    
    const results = await hybridSearch(query, vector);
    
    console.log(`Total results: ${results.length}`);
    
    if (results.length > 0) {
      console.log("\nTop 3 results:");
      for (let j = 0; j < Math.min(3, results.length); j++) {
        const r = results[j];
        console.log(`  [${j + 1}] Score: ${(r.score * 100).toFixed(2)}% | Source: ${r.source}`);
        if (r.payload?.content) {
          const preview = r.payload.content.substring(0, 150) + "...";
          console.log(`      Content: ${preview}`);
        }
        console.log();
      }
    } else {
      console.log("No results found");
    }
    console.log();
  }

  console.log("=== Pipeline Execution Complete ===\n");
  
  console.log("SUMMARY:");
  console.log(`- Chunks created: ${chunks.length}`);
  console.log(`- Embeddings created: ${vectors.length} (dimension: ${VECTOR_DIMENSION})`);
  console.log(`- Vectors stored in Qdrant: ${points.length}`);
  console.log(`- Postgres rows stored: ${chunkRecords.length}`);

} catch (error) {
  console.error("\n[ERROR] Pipeline failed:", error);
  process.exit(1);
}

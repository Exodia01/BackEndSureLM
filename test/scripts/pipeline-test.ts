#!/usr/bin/env node

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm";
process.env.QDRANT_URL = process.env.QDRANT_URL || "http://127.0.0.1:6333";

import { execSync } from 'child_process';
import { db } from "../lib/db.js";
import * as postgresRetrieval from "../lib/retrieval/postgres.js";
import * as qdrantRetrieval from "../lib/retrieval/vector/index.js";
import { hybridSearch } from "../lib/retrieval/hybrid.js";
import { chunkText } from "../lib/pdf/chunk.js";

const TEST_PDF_PATH = "test/Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf";
const CHUNK_SIZE = 500;
const VECTOR_DIMENSION = 768;

async function generateMockEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    const vector: number[] = [];
    for (let j = 0; j < VECTOR_DIMENSION; j++) {
      const randomValue = Math.sin(i * 137 + j * 31) * 0.5 + 0.5;
      vector.push(randomValue);
    }
    embeddings.push(vector);
    
    if ((i + 1) % 10 === 0) {
      process.stdout.write(`.`);
    }
  }
  
  return embeddings;
}

let docId: string | null = null;

async function cleanup() {
  if (docId) {
    try {
      await db.chunk.deleteMany({ where: { documentId: docId } });
      await db.document.delete({ where: { id: docId } });
      
      const points = await qdrantRetrieval.searchPoints("content_chunks", [0] * VECTOR_DIMENSION, { limit: 100 });
      const pointIds = points
        .filter(p => String(p.payload?.document_id) === docId)
        .map(p => p.id);
      
      if (pointIds.length > 0) {
        await qdrantRetrieval.deletePoints("content_chunks", pointIds);
      }
    } catch (e: any) {
      console.warn("[WARN] Cleanup warning:", e.message);
    }
  }
}

async function runPipeline() {
  console.log("=== PDF Ingestion & Hybrid Retrieval Pipeline ===\n");

  try {
    process.stdout.write("[Step 1] Extracting text from PDF... ");
    let pdfText: string;
    try {
      pdfText = execSync(`pdftotext "${TEST_PDF_PATH}" -`, { encoding: 'utf8' });
      console.log("[OK] Extracted text using pdftotext\n");
    } catch (err) {
      console.warn("[WARN] pdftotext not available, using fallback text...");
      pdfText = `Kotak Premier Life Plan. Premium options include single pay, annual pay. Exclusions apply for pre-existing conditions. Maturity benefit available after policy term. Eligibility criteria: age 18-60 years. Waiting period for pre-existing diseases is 36 months.`;
    }
    
    const pages = pdfText.split(/\n\s*\[?Page\s+\d+\]?\s*\n/);
    const textPages = pages.filter(p => p.trim().length > 0).map((p, i) => `[Page ${i + 1}]\n${p}`);
    
    process.stdout.write("[Step 2] Chunking text... ");
    const chunks = chunkText(textPages, CHUNK_SIZE, 50);
    console.log(`[OK] Created ${chunks.length} chunks\n`);

    process.stdout.write("[Step 3] Generating embeddings... ");
    const vectors = await generateMockEmbeddings(chunks.map(c => c.content));
    console.log(`[OK] Generated ${vectors.length} embeddings (dimension: ${VECTOR_DIMENSION})\n`);

    process.stdout.write("[Step 4] Storing in PostgreSQL... ");
    
    docId = (
      await db.document.create({
        data: {
          filename: "Kotak_Premier_Life_Plan",
          source: "brochure",
          metadata: { version: "2020-06-18" }
        }
      })
    ).id;
    
    const chunkRecords = [];
    for (let i = 0; i < chunks.length; i++) {
      const c = await db.chunk.create({
        data: {
          id: `chunk_${i}_${Date.now()}`,
          documentId: docId,
          content: chunks[i].content,
          chunkOrder: i,
          pageNumber: chunks[i].metadata[0]?.page || 1,
          category: "insurance"
        }
      });
      chunkRecords.push({ id: c.id, order: i, content: chunks[i].content });
    }
    console.log(`[OK] Stored ${chunkRecords.length} chunk records\n`);

    process.stdout.write("[Step 5] Storing vectors in Qdrant... ");
    
    try {
      await qdrantRetrieval.ensureCollection("content_chunks", VECTOR_DIMENSION);
      
      const points = chunkRecords.map((c) => ({
        id: c.id,
        vector: vectors[c.order],
        payload: {
          chunk_id: c.id,
          document_id: docId,
          page_number: chunks[c.order].metadata[0]?.page || 1,
          category: "insurance"
        }
      } as any));
      
      await qdrantRetrieval.upsertPoints("content_chunks", points);
      console.log(`[OK] Stored ${points.length} vector points\n`);
    } catch (err: any) {
      console.warn("[WARN] Qdrant not available, skipping vector storage:", err.message);
    }

    console.log("\n[Step 6] Testing hybrid retrieval...\n");

    const queries = [
      "minimum entry age",
      "premium payment term",
      "benefits available under the plan"
    ];

    for (const query of queries) {
      const vector = Array(VECTOR_DIMENSION).fill(0.1);
      
      console.log(`--- Query: "${query}" ---`);
      
      try {
        const results = await hybridSearch(query, vector);
        
        console.log(`Results found: ${results.length}`);
        
        if (results.length > 0) {
          console.log("\nTop results:");
          for (let j = 0; j < Math.min(5, results.length); j++) {
            const r = results[j];
            console.log(`  [${j + 1}] Score: ${(r.score * 100).toFixed(2)}% | Source: ${r.source}`);
            if (r.payload?.content) {
              const preview = r.payload.content.substring(0, 150).replace(/\s+/g, ' ');
              console.log(`      Content: ${preview}...`);
            }
          }
        } else {
          console.log("No results found");
        }
        console.log();
      } catch (err: any) {
        console.error(`[ERROR] Query failed:`, err.message);
      }
    }

    await cleanup();
    
    console.log("=== Pipeline Execution Complete ===\n");
    
    console.log("SUMMARY:");
    console.log(`- Chunks created: ${chunks.length}`);
    console.log(`- Embeddings created: ${vectors.length} (dimension: ${VECTOR_DIMENSION})`);
    console.log(`- Vectors stored in Qdrant: ${points?.length || 0}`);
    console.log(`- Postgres rows stored: ${chunkRecords.length}`);

  } catch (error: any) {
    await cleanup();
    console.error("\n[ERROR] Pipeline failed:", error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

runPipeline();

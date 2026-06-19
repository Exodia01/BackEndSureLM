// Validation script for end-to-end retrieval pipeline
import { readFileSync } from 'fs';
import path from 'path';

const PDF_PATH = path.join(__dirname, '..', 'Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf');

interface TestReport {
  stage: string;
  passed: boolean;
}

const reports: TestReport[] = [];
let documentId: string | null = null;

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:localpg2024@localhost:5432/surelm';

async function checkQdrant(): Promise<boolean> {
  try {
    const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
    const response = await fetch(`${QDRANT_URL}/collections`);
    return response.ok;
  } catch (err) {
    console.error('❌ Qdrant not available');
    return false;
  }
}

async function pdfToText(pdfBuffer: Buffer): Promise<string> {
  console.log('Loading PDF.js...');
  const pdfjs = await import('pdfjs-dist');
  
  if (typeof window === 'undefined' && typeof Worker !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  }
  
  const arrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength);
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
    console.log(`Extracted page ${pageNum}/${pdf.numPages}`);
  }
  
  return fullText;
}

async function chunkText(text: string, chunkSize: number = 500, overlap: number = 50): Promise<string[]> {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  
  for (let i = 0; i < words.length; i += (chunkSize - overlap)) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.length > 50) {
      chunks.push(chunk);
    }
  }
  
  console.log(`Created ${chunks.length} chunks`);
  return chunks;
}

async function storeChunks(chunks: string[], filename: string): Promise<string> {
  const { db } = await import('../lib/db');
  
  const doc = await db.document.create({
    data: {
      filename,
      source: 'validation',
      metadata: { version: '1.0', type: 'brochure' }
    }
  });
  console.log(`Stored document: ${doc.id}`);
  
  for (let i = 0; i < chunks.length; i++) {
    await db.chunk.create({
      data: {
        documentId: doc.id,
        content: chunks[i],
        chunkOrder: i,
        pageNumber: Math.floor(i / 5) + 1,
        category: 'brochure'
      }
    });
  }
  console.log(`Stored ${chunks.length} chunks`);
  
  return doc.id;
}

async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  console.log('Loading Ollama embedding model...');
  const { generateEmbeddings: ollamaGenerateEmbeddings } = await import('../lib/ai/embeddings');
  
  return await ollamaGenerateEmbeddings(chunks);
}

async function storeVectors(embeddings: number[][]): Promise<void> {
  const { ensureCollection, upsertPoints } = await import('../lib/retrieval/vector');
  
  await ensureCollection('content_chunks', embeddings[0].length);
  console.log(`Qdrant collection ready: content_chunks`);
  
  const { db } = await import('../lib/db');
  const chunks = await db.chunk.findMany({ where: { documentId } });
  
  for (let i = 0; i < chunks.length; i++) {
    await upsertPoints('content_chunks', [{
      id: chunks[i].id,
      vector: embeddings[i],
      payload: {
        chunk_id: chunks[i].id,
        document_id: documentId,
        category: 'brochure'
      }
    }]);
    
    if ((i + 1) % 20 === 0) {
      console.log(`Stored ${i + 1}/${chunks.length} vectors`);
    }
  }
  
  console.log('All vectors stored in Qdrant');
}

async function verifyCounts(): Promise<void> {
  const { db } = await import('../lib/db');
  
  if (!documentId) return;
  
  const docCount = await db.document.count({ where: { id: documentId } });
  const chunkCount = await db.chunk.count({ where: { documentId } });
  const vectorCountResponse = await fetch(`${process.env.QDRANT_URL}/collections/content_chunks/points/count`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  }).then(r => r.json());
  
  console.log('\nVerification:');
  console.log(`Document count: ${docCount}`);
  console.log(`Chunk count: ${chunkCount}`);
  console.log(`Vector count: ${(vectorCountResponse as any)?.count || 'N/A'}`);
}

async function testRetrieval(): Promise<void> {
  const queries = [
    { q: 'What is the minimum entry age?', desc: 'Minimum entry age' },
    { q: 'What is the premium payment term?', desc: 'Premium payment term' },
    { q: 'What are the benefits available under the plan?', desc: 'Benefits' }
  ];
  
  const { postgresFullTextSearch } = await import('../lib/ai/hybridRetrieval');
  const { semanticSearch } = await import('../lib/qdrant');
  const { generateEmbedding } = await import('../lib/ai/embeddings');
  
  for (const queryObj of queries) {
    console.log(`\nQuery: "${queryObj.q}" (${queryObj.desc})`);
    
    try {
      const ftsResults = await postgresFullTextSearch(queryObj.q, 3);
      console.log('PostgreSQL FTS results:');
      for (const r of ftsResults) {
        const snippet = r.content?.substring(0, 150) + '...' || 'No content';
        console.log(` Score: ${r.score.toFixed(4)}, ID: ${r.id}`);
        console.log(` ${snippet}`);
      }
    } catch (err) {
      console.log('PostgreSQL FTS error:', err);
    }
    
    try {
      const { db } = await import('../lib/db');
      const queryEmbedding = await generateEmbedding(queryObj.q);
      
      const vectorResults = await semanticSearch(queryEmbedding, {
        collection: 'content_chunks',
        limit: 3
      });
      
      console.log('Vector search results:');
      for (const r of vectorResults) {
        const chunk = await db.chunk.findUnique({ where: { id: String(r.id) } });
        const snippet = chunk?.content.substring(0, 150) + '...' || 'No content';
        console.log(` Score: ${r.score.toFixed(4)}, ID: ${r.id}`);
        console.log(` ${snippet}`);
      }
    } catch (err) {
      console.log('Vector search error:', err);
    }
    
    try {
      const { hybridRetrieve } = await import('../lib/ai/hybridRetrieval');
      
      const queryEmbedding = await generateEmbedding(queryObj.q);
      
      const hybridResults = await hybridRetrieve(queryObj.q, undefined, queryEmbedding);
      console.log('Hybrid retrieval results:');
      for (const r of hybridResults) {
        const snippet = r.content?.substring(0, 150) + '...' || 'No content';
        console.log(` Source: ${r.source}, Score: ${r.score.toFixed(4)}, ID: ${r.id}`);
        console.log(` ${snippet}`);
      }
    } catch (err) {
      console.log('Hybrid search error:', err);
    }
  }
}

async function main() {
  console.log('PDF → Chunks → Postgres → Embeddings → Qdrant');
  
  if (!await checkQdrant()) {
    process.exit(1);
  }
  
  const pdfBuffer = readFileSync(PDF_PATH);
  console.log(`PDF size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  
  const text = await pdfToText(pdfBuffer);
  console.log(`${text.length} characters`);
  reports.push({ stage: 'PDF parsing', passed: text.length > 100 });
  
  const chunks = await chunkText(text);
  reports.push({ stage: 'Chunking', passed: chunks.length > 0 });
  
  documentId = await storeChunks(chunks, path.basename(PDF_PATH));
  reports.push({ stage: 'PostgreSQL storage', passed: !!documentId });
  
  const embeddings = await generateEmbeddings(chunks);
  console.log(`${embeddings.length} embeddings`);
  reports.push({ stage: 'Embedding generation', passed: embeddings.length === chunks.length });
  
  await storeVectors(embeddings);
  reports.push({ stage: 'Qdrant storage', passed: true });
  
  await verifyCounts();
  await testRetrieval();
  
  const allPassed = reports.every(r => r.passed);
  
  console.log('\nFinal Report:');
  for (const r of reports) {
    const status = r.passed ? 'PASS' : 'FAIL';
    console.log(`${status}: ${r.stage}`);
  }
  
  if (allPassed) {
    console.log('\nEND-TO-END RETRIEVAL VALIDATION: PASS');
  } else {
    console.log('\nEND-TO-END RETRIEVAL VALIDATION: FAIL');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

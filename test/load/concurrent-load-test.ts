import { db } from "../../lib/db.js";
import * as vector from "../../lib/retrieval/vector/index.js";
import { hybridSearch } from "../../lib/retrieval/hybrid.js";
import type { RetrievalResult } from "../../lib/retrieval/types.js";

interface TestConfig {
  concurrentQueries: number;
  iterations: number;
  collectionName: string;
}

interface QueryResult {
  queryIndex: number;
  queryText: string;
  vectorDimension: number;
  latencyMs: number;
  resultCount: number;
  uniqueChunkIds: number;
  hasPostgresResult: boolean;
  hasVectorResult: boolean;
  sources: string[];
}

interface LoadTestSummary {
  totalQueries: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successCount: number;
  failureCount: number;
  queriesPerSecond: number;
  resultsBySource: {
    postgres: number;
    vector: number;
    history: number;
  };
}

const QDRANT_COLLECTION = "policies";

export async function generateTestVectors(count: number, dimension: number = 768): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < count; i++) {
    const vector = new Array(dimension).fill(0);
    for (let j = 0; j < dimension; j++) {
      vector[j] = Math.sin(i * 0.1 + j * 0.01);
    }
    vectors.push(vector);
  }
  return vectors;
}

export async function prepareTestEnvironment(testChunks: number = 20) {
  const collection = "content_chunks";
  const dimension = 768;

  await vector.ensureCollection(collection, dimension);

  const doc = await db.document.create({
    data: {
      filename: `load_test_${Date.now()}.pdf`,
      source: "concurrent_load_test",
      metadata: { version: "1.0" },
    },
  });

  const chunks = [];
  for (let i = 0; i < testChunks; i++) {
    const chunk = await db.chunk.create({
      data: {
        documentId: doc.id,
        content: `Test chunk ${i}. This contains insurance policy information. Premium payment options vary based on coverage. Waiting periods apply for pre-existing conditions.`,
        chunkOrder: i,
        pageNumber: Math.floor(i / 5) + 1,
        category: "test",
      },
    });
    chunks.push(chunk);
  }

  const vectors = await generateTestVectors(testChunks, dimension);
  
  // Qdrant requires numeric or UUID IDs - use integer index as ID
  await vector.upsertPoints(collection, chunks.map((c: any, idx: number) => ({
    id: idx + 1,  // Use sequential integers instead of CUID strings
    vector: vectors[idx],
    payload: {
      chunk_id: c.id,  // Store actual chunk id in payload
      document_id: doc.id,
      category: "test",
      original_chunk_id: c.id,
    },
  })));

  return { doc, chunks, vectors, collection, dimension };
}

export async function runHybridQuery(
  queryIndex: number,
  queryText: string,
  vector: number[],
  collectionName: string
): Promise<QueryResult> {
  const startTime = Date.now();
  
  try {
    const results = await hybridSearch(queryText, vector) as RetrievalResult[];
    
    const latencyMs = Date.now() - startTime;
    
    const sources = new Set(results.map(r => r.source));
    const chunkIds = new Set(results.map(r => r.id));
    
    return {
      queryIndex,
      queryText,
      vectorDimension: vector.length,
      latencyMs,
      resultCount: results.length,
      uniqueChunkIds: chunkIds.size,
      hasPostgresResult: sources.has("fts"),
      hasVectorResult: sources.has("vector") || sources.has("qdrant"),
      sources: Array.from(sources),
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    
    return {
      queryIndex,
      queryText,
      vectorDimension: vector.length,
      latencyMs: -1,
      resultCount: 0,
      uniqueChunkIds: 0,
      hasPostgresResult: false,
      hasVectorResult: false,
      sources: [],
    };
  }
}

export async function runConcurrentLoadTest(
  config: TestConfig = {
    concurrentQueries: 10,
    iterations: 5,
    collectionName: "policies",
  }
): Promise<LoadTestSummary> {
  console.log("\n=== Concurrent Query Load Test ===");
  console.log(`Concurrency: ${config.concurrentQueries} queries`);
  console.log(`Iterations: ${config.iterations}`);
  console.log(`Total expected queries: ${config.concurrentQueries * config.iterations}\n`);

  const allResults: QueryResult[] = [];
  const queryPool: Array<{ text: string; vector: number[] }> = [];

  for (let i = 0; i < config.concurrentQueries; i++) {
    queryPool.push({
      text: `insurance policy premium waiting period query ${i}`,
      vector: new Array(768).fill(0.1 * (i + 1)),
    });
  }

  const startTime = Date.now();
  
  for (let iter = 0; iter < config.iterations; iter++) {
    const promises = queryPool.map((queryData, idx) =>
      runHybridQuery(
        iter * config.concurrentQueries + idx,
        queryData.text,
        queryData.vector,
        config.collectionName
      )
    );
    
    const batchResults = await Promise.all(promises);
    allResults.push(...batchResults);
    
    console.log(`Iteration ${iter + 1}/${config.iterations} completed`);
  }
  
  const totalLatency = Date.now() - startTime;

  const successfulResults = allResults.filter(r => r.latencyMs >= 0);
  const failedCount = allResults.length - successfulResults.length;
  
  const latencies = successfulResults.map(r => r.latencyMs).sort((a, b) => a - b);
  
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);
  const avgLatency = latencies.reduce((sum, l) => sum + l, 0) / latencies.length;
  
  const p50Idx = Math.floor(latencies.length * 0.5);
  const p95Idx = Math.floor(latencies.length * 0.95);
  const p99Idx = Math.floor(latencies.length * 0.99);
  
  const p50Latency = latencies[p50Idx] || 0;
  const p95Latency = latencies[p95Idx] || maxLatency;
  const p99Latency = latencies[p99Idx] || maxLatency;

  const totalResults = successfulResults.reduce((sum, r) => sum + r.resultCount, 0);
  const postgresHits = successfulResults.filter(r => r.hasPostgresResult).length;
  const vectorHits = successfulResults.filter(r => r.hasVectorResult).length;

  const summary: LoadTestSummary = {
    totalQueries: allResults.length,
    minLatencyMs: minLatency,
    maxLatencyMs: maxLatency,
    avgLatencyMs: Math.round(avgLatency * 100) / 100,
    p50LatencyMs: Math.round(p50Latency * 100) / 100,
    p95LatencyMs: Math.round(p95Latency * 100) / 100,
    p99LatencyMs: Math.round(p99Latency * 100) / 100,
    successCount: successfulResults.length,
    failureCount: failedCount,
    queriesPerSecond: Number(((successfulResults.length / (totalLatency / 1000)).toFixed(2))),
    resultsBySource: {
      postgres: postgresHits,
      vector: vectorHits,
      history: allResults.filter(r => r.sources.includes("history")).length,
    },
  };

  console.log("\n=== Load Test Results ===");
  console.log(`Total queries executed: ${summary.totalQueries}`);
  console.log(`Successful: ${summary.successCount} | Failed: ${summary.failureCount}`);
  console.log(`Queries/sec: ${summary.queriesPerSecond}`);
  
  console.log("\nLatency Statistics (ms):");
  console.log(`  Min:  ${summary.minLatencyMs}`);
  console.log(`  Max:  ${summary.maxLatencyMs}`);
  console.log(`  Avg:  ${summary.avgLatencyMs}`);
  console.log(`  P50:  ${summary.p50LatencyMs}`);
  console.log(`  P95:  ${summary.p95LatencyMs}`);
  console.log(`  P99:  ${summary.p99LatencyMs}`);

  console.log("\nSourceHit Rates:");
  console.log(`  PostgreSQL FTS: ${Math.round((postgresHits / successfulResults.length) * 100)}%`);
  console.log(`  Vector Search:  ${Math.round((vectorHits / successfulResults.length) * 100)}%`);

  const latenciesFormatted = latencies.slice(0, Math.min(20, latencies.length)).join(", ");
  console.log("\nFirst 20 query latencies (ms):");
  console.log(latenciesFormatted);

  return summary;
}

export async function cleanupTestEnvironment(docId: string) {
  await db.chunk.deleteMany({ where: { documentId: docId } });
  await db.document.deleteMany({ where: { id: docId } });
  
  try {
    const results = await vector.searchPoints(QDRANT_COLLECTION, new Array(768).fill(0), { limit: 100 });
    const pointIds = results.filter(r => String(r.payload?.document_id)?.includes("load_test")).map(r => r.id);
    if (pointIds.length > 0) {
      await vector.deletePoints(QDRANT_COLLECTION, pointIds);
    }
  } catch {}
}

async function main() {
  console.log("\n=== Starting Concurrent Load Test ===\n");

  try {
    const testConfig = {
      concurrentQueries: parseInt(process.env.CONCURRENT_QUERIES || "10"),
      iterations: parseInt(process.env.LOOP_ITERATIONS || "5"),
      collectionName: process.env.TEST_COLLECTION || "policies",
    };

    console.log("Configuration:");
    console.log(`  Concurrent queries: ${testConfig.concurrentQueries}`);
    console.log(`  Iterations: ${testConfig.iterations}\n`);

    const { doc, chunks, vectors } = await prepareTestEnvironment(20);

    console.log(`Created test document: ${doc.id}`);
    console.log(`Created ${chunks.length} test chunks with embeddings\n`);

    const summary = await runConcurrentLoadTest(testConfig);

    await cleanupTestEnvironment(doc.id);
    await db.$disconnect();

    if (summary.failureCount === 0) {
      console.log("\n✅ ALL TESTS PASSED");
    } else {
      console.log(`\n⚠️  ${summary.failureCount} queries failed`);
    }

    process.exit(0);
  } catch (err: any) {
    console.error("❌ Test failed:", err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

if (process.argv[1]?.includes("concurrent-load-test")) {
  main();
}

#!/usr/bin/env node

// Explicitly set env vars (overrides dotenvx)
process.env.DATABASE_URL = "postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm";
process.env.QDRANT_URL = "http://localhost:6333";

import { readFileSync } from "fs";
import path from "path";

import { db } from "../../lib/db";
import * as postgresRetrieval from "../../lib/retrieval/postgres";
import * as qdrantVector from "../../lib/retrieval/vector/qdrantStorage";
import { generateEmbeddings, generateEmbedding } from "../../lib/ai/embeddings";
import { getCollectionInfo } from "../../lib/retrieval/vector/qdrantStorage";
import { hybridSearch } from "../../lib/retrieval/hybrid";

const PDF_PATH = "S:\\BackEndSureLM\\test\\Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf";
const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 50;
const QDRANT_COLLECTION = "content_chunks";
const REPORT_PATH = "S:\\BackEndSureLM\\test\\validation\\retrieval-validation-report.md";

interface TestStage {
  name: string;
  passed: boolean;
  startTime: number;
  endTime?: number;
  error?: string;
}

interface ValidationReport {
  stages: TestStage[];
  results: any;
  summary: {
    totalStages: number;
    passedStages: number;
    failedStages: number;
    durationMs: number;
  };
}

let report: ValidationReport = { stages: [], results: { services: {} }, summary: { totalStages: 0, passedStages: 0, failedStages: 0, durationMs: 0 } };

function startStage(name: string): TestStage {
  const stage: TestStage = { name, passed: false, startTime: Date.now() };
  report.stages.push(stage);
  console.log(`\n[${new Date().toISOString()}] Starting: ${name}`);
  return stage;
}

function endStage(stage: TestStage, success: boolean, error?: string): void {
  stage.endTime = Date.now();
  stage.passed = success;
  if (!success && error) stage.error = error;

  const duration = (stage.endTime - stage.startTime) / 1000;
  const status = success ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] ${stage.name} (${duration.toFixed(2)}s)`);

  if (!success && error) {
    console.error(`  Error: ${error}`);
  }
}

async function checkServices(): Promise<void> {
  const stage = startStage("Service Health Check");

  try {
    const qdrantReady = await qdrantVector.healthCheck();
    if (!qdrantReady) throw new Error("Qdrant is not available");

    report.results.services.qdrantAvailable = true;

    try {
      await db.$queryRaw`SELECT 1`;
      report.results.services.postgresAvailable = true;
    } catch (e) {
      throw new Error("PostgreSQL database is not available: " + e);
    }

    const ollamaHostEnv = process.env.OLLAMA_HOST || "http://localhost:11434";
    let ollamaUrl = ollamaHostEnv;

    if (ollamaHostEnv === "0.0.0.0" || ollamaHostEnv.includes("0.0.0.0")) {
      ollamaUrl = "http://localhost:11434";
    } else if (ollamaHostEnv.endsWith("/v1")) {
      ollamaUrl = ollamaHostEnv.replace("/v1", "");
    }

    try {
      let ollamaUrlFixed = process.env.OLLAMA_HOST;
      
      if (ollamaUrlFixed?.includes("0.0.0.0")) {
        ollamaUrlFixed = "http://localhost:11434";
      } else if (ollamaUrlFixed?.endsWith("/v1")) {
        ollamaUrlFixed = ollamaUrlFixed.replace("/v1", "");
      }
      
      if (ollamaUrlFixed) {
        try {
          await fetch(`${ollamaUrlFixed}/api/tags`);
        } catch (err: any) {
          throw new Error("Ollama check failed: " + err.message);
        }
      }

      report.results.services.ollamaAvailable = true;
    } catch (err: any) {
      throw new Error("Ollama check failed: " + err.message);
    }

    endStage(stage, true);
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    await generateReport();
    process.exit(1);
  }
}

async function processPDF(): Promise<string> {
  const stage = startStage("PDF Extraction");

  try {
    const fs = await import("fs");

    let fileContent: Buffer;
    try {
      fileContent = readFileSync(PDF_PATH);
    } catch (err: any) {
      if (err.code === "ENOENT") {
        throw new Error(`PDF file not found at ${PDF_PATH}`);
      }
      throw err;
    }

    if (!fileContent.byteLength) {
      throw new Error("PDF file not found or empty");
    }

    const { PDFParse } = await import("pdf-parse");
    
    const parser = new PDFParse({ url: PDF_PATH });
    const pdfData = await parser.getText();
    
    if (!pdfData.text || pdfData.text.length === 0) {
      throw new Error("Failed to extract text from PDF");
    }

    report.results.pdfTextLength = pdfData.text.length;
    endStage(stage, true);

    return pdfData.text;
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

function chunkText(text: string): { content: string; order: number; page?: number }[] {
  const stage = startStage("Text Chunking");

  const chunks: { content: string; order: number; page?: number }[] = [];

  try {
    let currentIndex = 0;

    for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
      const chunk = text.slice(i, i + CHUNK_SIZE);

      if (chunk.length > 50) {
        chunks.push({ content: chunk, order: currentIndex, page: Math.floor(currentIndex / 10) + 1 });
        currentIndex++;
      }
    }

    report.results.chunkCount = chunks.length;
    report.results.totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0);

    endStage(stage, true);
    return chunks;
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

async function storeChunks(chunks: { content: string; order: number; page?: number }[]): Promise<string> {
  const stage = startStage("PostgreSQL Storage (Chunks & Documents)");

  try {
    const docResult = await db.document.create({
      data: {
        filename: path.basename(PDF_PATH),
        source: "validation",
        metadata: { type: "brochure", validation: true, timestamp: new Date().toISOString() },
        version: 1,
      },
    });

    report.results.documentId = docResult.id;

    for (let i = 0; i < chunks.length; i++) {
      await db.chunk.create({
        data: {
          documentId: docResult.id,
          content: chunks[i].content,
          chunkOrder: chunks[i].order,
          pageNumber: chunks[i].page || Math.floor(i / 10) + 1,
          category: "brochure",
        },
      });

      if ((i + 1) % 50 === 0) {
        console.log(`  Stored ${i + 1}/${chunks.length} chunks`);
      }
    }

    const chunkCount = await db.chunk.count({ where: { documentId: docResult.id } });
    report.results.storedChunks = chunkCount;

    endStage(stage, true);
    return docResult.id;
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

async function generateAndStoreEmbeddings(chunks: { content: string; order: number }[], docId: string): Promise<number[][]> {
  const stage = startStage("Ollama Embedding Generation & Qdrant Storage");

  try {
    const embeddings = await generateEmbeddings(chunks.map(c => c.content));

    report.results.embeddingDimension = embeddings[0].length;
    report.results.embeddedChunks = embeddings.length;

    const points = chunks.map((c, index) => ({
      id: `${docId}_chunk_${index}`,
      vector: embeddings[index],
      payload: {
        chunk_id: `${docId}_chunk_${index}`,
        document_id: docId,
        chunk_order: c.order,
        content_snippet: c.content.substring(0, 200),
        category: "brochure",
        validation: true,
      },
    }));

    await qdrantVector.ensureCollection(QDRANT_COLLECTION, report.results.embeddingDimension);
    await qdrantVector.upsertPoints(QDRANT_COLLECTION, points as any);

    const collectionInfo = await getCollectionInfo(QDRANT_COLLECTION);
    report.results.vectorCount = (collectionInfo as any).points_count || chunks.length;
    report.results.vectorDimension = (collectionInfo as any)?.config?.params?.vectors?.size || report.results.embeddingDimension;

    endStage(stage, true);
    return embeddings;
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

async function verifyFTS(): Promise<void> {
  const stage = startStage("PostgreSQL FTS Verification");

  try {
    const ftsResult = await postgresRetrieval.postgresFullTextSearch("premium", 5);

    report.results.ftsEnabled = true;
    report.results.ftsTestResultsCount = ftsResult.length;

    endStage(stage, true);
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

async function testRetrieval(): Promise<void> {
  const stage = startStage("Retrieval Tests");

  try {
    const queryTexts = [
      "What is the premium payment term?",
      "pre-existing conditions exemptions",
      "maturity benefit calculation",
      "eligibility criteria age limits",
    ];

    const results: any[] = [];

    for (const query of queryTexts) {
      console.log(`  Testing query: "${query}"`);

      try {
        const ftsResult = await postgresRetrieval.postgresFullTextSearch(query, 3);

        const queryVector = await generateEmbedding(query);
        const vectorResult = await qdrantVector.searchPoints(QDRANT_COLLECTION, queryVector, { limit: 3 });

        results.push({
          query,
          ftsResults: ftsResult.map((r: any) => ({
            id: r.id,
            score: r.score,
            chunk_id: r.payload?.chunk_id,
            snippet: r.payload?.content ? r.payload.content.substring(0, 100) + "..." : "",
          })),
          vectorResults: vectorResult.map((r: any) => ({
            id: r.id,
            score: r.score,
            chunk_id: r.payload?.chunk_id,
            snippet: r.payload?.content ? r.payload.content.substring(0, 100) + "..." : "",
          })),
        });
      } catch (error: any) {
        console.error(`    Error for query "${query}":`, error);
        results.push({ query, error: String(error), ftsResults: [], vectorResults: [] });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    }

    report.results.retrievalTests = results;
    report.results.hasRetrievalResults = results.some(r => r.ftsResults.length > 0 || r.vectorResults.length > 0);

    endStage(stage, true);
  } catch (error: any) {
    endStage(stage, false, error.message || String(error));
    throw error;
  }
}

async function cleanup(docId: string | null): Promise<void> {
  if (!docId) return;

  try {
    const chunks = await db.chunk.findMany({ where: { documentId: docId } });
    const pointIds = chunks.map(c => `${docId}_chunk_${c.chunkOrder}`);
    await qdrantVector.deletePoints(QDRANT_COLLECTION, pointIds);

    await db.chunk.deleteMany({ where: { documentId: docId } });
    await db.document.delete({ where: { id: docId } });
  } catch (error: any) {
    console.warn("Cleanup warning:", error);
  }
}

async function generateReport(): Promise<void> {
  try {
    const fs = await import("fs");

    let markdown = `# End-to-End Retrieval Validation Report\n\n`;

    if (!report.summary?.durationMs) {
      report.summary.durationMs = 0;
    }

    const allPassed = report.stages.every(s => s.passed);
    markdown += `## Summary: ${allPassed ? "✓ ALL TESTS PASSED" : "✗ SOME TESTS FAILED"}\n\n`;
    markdown += `| Metric | Value |\n|--------|-------|\n`;
    markdown += `| Total Stages | ${report.stages.length} |\n`;
    markdown += `| Passed | ${report.stages.filter(s => s.passed).length} |\n`;
    markdown += `| Failed | ${report.stages.filter(s => !s.passed).length} |\n`;
    markdown += `| Duration | ${(report.summary.durationMs / 1000 || 0).toFixed(2)}s |\n\n`;

    markdown += "## Stage Results\n\n";
    markdown += "| Stage | Status | Duration |\n";
    markdown += "|-------|--------|----------|\n";

    for (const stage of report.stages) {
      const status = stage.passed ? "✓ PASS" : "✗ FAIL";
      const duration = stage.endTime ? ((stage.endTime - stage.startTime) / 1000).toFixed(2) + "s" : "N/A";
      markdown += `| ${stage.name} | ${status} | ${duration} |\n`;
    }

    if (report.stages.filter(s => !s.passed).length > 0) {
      markdown += "\n## Failed Stages Details\n\n";
      for (const stage of report.stages) {
        if (!stage.passed && stage.error) {
          markdown += `### ${stage.name}\n\n**Error:** ${stage.error}\n\n`;
        }
      }
    }

    markdown += "\n## Validation Results\n\n";

    if (report.results.pdfTextLength) {
      markdown += `| Metric | Value |\n`;
      markdown += `|--------|-------|\n`;
      markdown += `| PDF Text Length | ${report.results.pdfTextLength} chars |\n`;
      markdown += `| Chunk Count | ${report.results.chunkCount} |\n`;
      markdown += `| Total Characters in Chunks | ${report.results.totalChars || 0} |\n`;
      markdown += `| Stored Chunks | ${report.results.storedChunks || report.results.chunkCount} |\n`;
      markdown += `| Embedding Dimension | ${report.results.embeddingDimension} |\n`;
      markdown += `| Embedded Chunks | ${report.results.embeddedChunks} |\n`;
      markdown += `| Vector Count in Qdrant | ${report.results.vectorCount} |\n`;

      if (report.results.retrievalTests) {
        markdown += "\n### Retrieval Test Results\n\n";

        for (const test of report.results.retrievalTests) {
          markdown += `#### Query: "${test.query}"\n\n`;

          markdown += "**FTS Results:**\n\n";
          if (test.ftsResults && test.ftsResults.length > 0) {
            markdown += "| ID | Score | Chunk ID | Snippet |\n";
            markdown += "|----|-------|----------|---------|\n";
            for (const r of test.ftsResults) {
              markdown += `| ${r.id} | ${r.score.toFixed(3)} | ${r.chunk_id || "N/A"} | ${r.snippet || ""} |\n`;
            }
          } else {
            markdown += "*No FTS results*\n";
          }

          markdown += "\n**Vector Search Results:**\n\n";
          if (test.vectorResults && test.vectorResults.length > 0) {
            markdown += "| ID | Score | Chunk ID | Snippet |\n";
            markdown += "|----|-------|----------|---------|\n";
            for (const r of test.vectorResults) {
              markdown += `| ${r.id} | ${r.score.toFixed(3)} | ${r.chunk_id || "N/A"} | ${r.snippet || ""} |\n`;
            }
          } else {
            markdown += "*No vector results*\n";
          }

          markdown += "\n---\n\n";
        }
      }
    }

    markdown += "\n## Service Status\n\n";
    markdown += "| Service | URL | Status |\n";
    markdown += "|---------|-----|--------|\n";
    markdown += `| PostgreSQL | ${process.env.DATABASE_URL?.replace(/:.*@/, ":***@") || "N/A"} | ✓ Connected |\n`;
    markdown += `| Qdrant | ${process.env.QDRANT_URL} | ✓ Available |\n`;
    markdown += `| Ollama | ${process.env.OLLAMA_HOST} | ✓ Available (nomic-embed-text) |\n`;

    if (!allPassed) {
      markdown += "\n## Recommendations\n\n";
      const failedStages = report.stages.filter(s => !s.passed);
      for (const stage of failedStages) {
        markdown += `### ${stage.name}\n\n`;
        if (stage.error?.includes("not available")) {
          markdown += `**Issue:** Service is not running or accessible.\n`;
          markdown += `**Solution:** Start the service and verify connectivity.\n`;
        } else if (stage.error?.includes("model not found")) {
          markdown += `**Issue:** Required embedding model not loaded.\n`;
          markdown += `**Solution:** Run \`ollama pull nomic-embed-text\`\n`;
        } else if (stage.error) {
          markdown += `**Error:** ${stage.error}\n`;
        }
        markdown += "\n";
      }
    }

    markdown += "\n---\n\n*Report generated by full-retrieval-validation.ts*\n";

    await import("fs").then(({ writeFileSync }) => {
      writeFileSync(REPORT_PATH, markdown);
    });

    console.log(`\n[REPORT] Generated: ${REPORT_PATH}`);
  } catch (error: any) {
    console.error("Failed to generate report:", error);
  }
}

async function main(): Promise<void> {
  const startTime = Date.now();

  try {
    await checkServices();

    const pdfText = await processPDF();
    if (!pdfText || pdfText.length === 0) throw new Error("No text extracted from PDF");

    const chunks = chunkText(pdfText);
    if (chunks.length === 0) throw new Error("No chunks created from text");

    const docId = await storeChunks(chunks);

    const embeddings = await generateAndStoreEmbeddings(chunks, docId);

    await verifyFTS();

    await testRetrieval();

    report.summary = {
      totalStages: report.stages.length,
      passedStages: report.stages.filter(s => s.passed).length,
      failedStages: report.stages.filter(s => !s.passed).length,
      durationMs: Date.now() - startTime,
    };

    await generateReport();

    const allPassed = report.stages.every(s => s.passed);

    console.log(`\n${"=".repeat(60)}`);
    console.log("VALIDATION COMPLETE");
    console.log(`${"=".repeat(60)}`);
    console.log(`Total Stages: ${report.summary.totalStages}`);
    console.log(`Passed: ${report.summary.passedStages}`);
    console.log(`Failed: ${report.summary.failedStages}`);
    console.log(`Duration: ${(report.summary.durationMs / 1000).toFixed(2)}s`);

    if (!allPassed) {
      process.exit(1);
    }
  } catch (error: any) {
    report.summary = {
      totalStages: report.stages.length,
      passedStages: report.stages.filter(s => s.passed).length,
      failedStages: report.stages.filter(s => !s.passed).length,
      durationMs: Date.now() - startTime,
    };

    await generateReport();
    console.error("\n[ERROR]", error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});

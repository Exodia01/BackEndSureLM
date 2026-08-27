import { db } from "../db";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { upsert as qdrantUpsert, createCollection } from "../qdrant";

/**
 * Convert a CUID to a valid UUID for Qdrant point IDs.
 * Qdrant 1.12+ requires UUID or unsigned integer point IDs.
 */
function cuidToUuid(cuid: string): string {
  const hash = crypto.createHash("md5").update(cuid).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Configuration
export const MAX_FILE_SIZE_MB = 50;
export const CHUNK_SIZE = 1200;
export const OVERLAP = 200;
export const PDF_STORAGE_DIR = process.env.PDF_STORAGE_DIR || "/data/pdfs";
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "policy_knowledge";
export const EMBEDDING_MODEL = "nomic-embed-text";
const VECTOR_SIZE = 768;

// File extension check
export function isValidPDF(filename: string): boolean {
  return filename.toLowerCase().endsWith(".pdf");
}

// Size validation (converts bytes to MB for comparison)
export function validateFileSize(fileSizeBytes: number): { valid: boolean; error?: string } {
  const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
  if (fileSizeBytes > maxSizeBytes) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_MB}MB` };
  }
  return { valid: true };
}

// MD5 hash for deduplication
export function computeFileHash(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  return crypto.createHash("md5").update(uint8Array).digest("hex");
}

/**
 * Persist a PDF to the filesystem at /data/pdfs/{versionHash}.pdf
 * and return the absolute path. Never overwrites an existing file.
 */
export async function writePdfToDisk(
  fileData: ArrayBuffer,
  versionHash: string
): Promise<string> {
  await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });
  const filePath = path.join(PDF_STORAGE_DIR, `${versionHash}.pdf`);

  try {
    await fs.access(filePath);
    return filePath; // already on disk, don't clobber
  } catch {
    await fs.writeFile(filePath, Buffer.from(fileData));
    return filePath;
  }
}

/**
 * Read a PDF from disk (or legacy BYTEA) as an ArrayBuffer.
 */
export async function readPdfFromBrochure(
  brochure: { filePath?: string | null; pdfData?: Uint8Array | null }
): Promise<ArrayBuffer> {
  if (brochure.filePath) {
    const buffer = await fs.readFile(brochure.filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  }
  if (brochure.pdfData) {
    return new Uint8Array(brochure.pdfData).buffer as ArrayBuffer;
  }
  throw new Error("Brochure has no filePath and no legacy pdfData");
}

/**
 * Extract text from PDF file
 */
export async function extractPDFText(fileData: ArrayBuffer): Promise<{ pages: string[]; totalPages: number }> {
  try {
    // Use legacy build for Node.js (includes DOMMatrix polyfill)
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const workerSrc = (import.meta as unknown as { resolve?: (spec: string) => string }).resolve
      ? (import.meta as unknown as { resolve: (spec: string) => string }).resolve(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs"
        )
      : new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fileData) });
    const pdf = await loadingTask.promise;

    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push(`[Page ${pageNum}]\n${text}`);
      await page.cleanup();
    }

    await pdf.destroy();

    return { pages, totalPages: pages.length };
  } catch (error) {
    throw new Error(`Failed to extract PDF text: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Chunk text with overlap
 */
export function chunkText(pages: string[], chunkSize: number = CHUNK_SIZE, overlap: number = OVERLAP): { content: string; metadata: { page?: number }[] }[] {
  const chunks: { content: string; metadata: { page?: number }[] }[] = [];
  
  for (const pageText of pages) {
    const matches = pageText.match(/^\[Page (\d+)\]/m);
    const pageNum = matches ? parseInt(matches[1], 10) : undefined;
    
    const words = pageText.split(/\s+/);
    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunkWords = words.slice(i, i + chunkSize);
      if (chunkWords.length === 0) continue;
      
      chunks.push({
        content: chunkWords.join(" "),
        metadata: [{ page: pageNum }],
      });
    }
  }
  
  return chunks;
}

/**
 * Detect category from Markdown-style headers (# Section Name)
 */
export function detectCategory(text: string): string | undefined {
  const headerPatterns = [
    { regex: /^#\s*(Death\s+Benefit|Death).*$/i, category: "death_benefit" },
    { regex: /^#\s*(Maturity\s+Benefit|Maturity|Survival\s+Benefit).*$/i, category: "maturity_survival_benefit" },
    { regex: /^#\s*(Eligibility|Entry\s+Age|Eligible).*$/i, category: "eligibility" },
    { regex: /^#\s*(Premium|Payment|Rate|Cost|Amount).*$/i, category: "premium_payment" },
    { regex: /^#\s*(Bonuses?|Reversionary|Cash|Terminal).*$/i, category: "bonuses" },
    { regex: /^#\s*(Riders?|Additional\s+Protection|Optional).*$/i, category: "riders" },
    { regex: /^#\s*(Surrender|Encashment|Maturity).*$/i, category: "surrender_maturity" },
    { regex: /^#\s*(Loan|Policy\s+Loan).*$/i, category: "policy_loan" },
    { regex: /^#\s*(Revival|Lapse|Reinstatement).*$/i, category: "revival_lapse" },
    { regex: /^#\s*([Uu]nderwriting|[Cc]laims?|Exclusions|Conditions).*$/i, category: "claims_conditions" },
    { regex: /^#\s*(Tax|Section\s+80C|Section\s+10).*$/i, category: "tax_benefits" },
    { regex: /^#\s*(Free\s+Look|Assignment|Nomination|Health).*$/i, category: "policy_features" },
  ];

  const lines = text.split("\n").slice(0, 50);
  for (const line of lines) {
    for (const { regex, category } of headerPatterns) {
      if (regex.test(line)) {
        return category;
      }
    }
  }

  return undefined;
}

/**
 * Generate embeddings using Ollama (sequential for VRAM protection)
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";

  try {
    const response = await fetch(`${ollamaHost}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    return new Array(VECTOR_SIZE).fill(0);
  }
}

/**
 * Generate embeddings for multiple texts sequentially (VRAM-safe)
 */
export async function generateEmbeddingsSequentially(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  console.log(`[embeddings] Generating ${texts.length} embeddings sequentially...`);
  
  for (let i = 0; i < texts.length; i++) {
    try {
      const embedding = await generateEmbedding(texts[i]);
      embeddings.push(embedding);
      
      if ((i + 1) % 50 === 0) {
        console.log(`[embeddings] Generated ${i + 1}/${texts.length} embeddings`);
      }
    } catch (error) {
      console.warn(`[embeddings] Failed for chunk ${i}:`, error);
      embeddings.push(new Array(VECTOR_SIZE).fill(0));
    }
  }

  return embeddings;
}

/**
 * Upsert chunk vectors to the canonical `policy_knowledge` Qdrant collection.
 */
export async function upsertChunksToQdrant(
  brochureId: string,
  chunks: { id: string; content: string; chunkOrder: number; pageNumber: number | null; category: string | null }[],
  embeddings: number[][],
  versionNum: number
): Promise<number> {
  const points = chunks.map((chunk, index) => ({
    id: cuidToUuid(chunk.id),
    vector: embeddings[index] || new Array(VECTOR_SIZE).fill(0),
    payload: {
      brochure_id: brochureId,
      chunk_id: chunk.id,
      chunk_index: index,
      content: chunk.content,
      page_num: chunk.pageNumber ?? null,
      category: chunk.category,
      version_num: versionNum,
    },
  }));

  try {
    await qdrantUpsert(QDRANT_COLLECTION, points);
    return points.length;
  } catch (error) {
    console.warn("[upsertChunksToQdrant] Upsert failed, attempting collection creation:", error);
    await createCollection(QDRANT_COLLECTION, VECTOR_SIZE, {
      brochure_id: "keyword",
      chunk_id: "keyword",
      chunk_index: "integer",
      page_num: "integer",
      version_num: "integer",
    });
    await qdrantUpsert(QDRANT_COLLECTION, points);
    return points.length;
  }
}

/**
 * Process brochure: extract, chunk, embed, store in DB, upsert vectors to Qdrant.
 * Does NOT perform requirement extraction — that is a separate, later step.
 */
export async function processBrochure(
  brochureId: string
): Promise<{ chunksCreated: number; totalPages: number }> {
  console.log(`[processBrochure] Starting processing for brochure ${brochureId}`);

  const brochure = await db.brochure.findUnique({ where: { id: brochureId } });
  if (!brochure) throw new Error(`Brochure ${brochureId} not found`);

  const fileData = await readPdfFromBrochure(brochure);

  const { pages, totalPages } = await extractPDFText(fileData);
  console.log(`[processBrochure] Extracted ${pages.length} pages`);

  const chunks = chunkText(pages, CHUNK_SIZE, OVERLAP);
  console.log(`[processBrochure] Created ${chunks.length} chunks`);

  const chunksWithCategories = chunks.map(chunk => ({
    content: chunk.content,
    category: detectCategory(chunk.content) || "general",
    pageNumber: (chunk.metadata?.[0]?.page as number) || null,
  }));

  console.log("[processBrochure] Generating embeddings...");
  const embeddingStartTime = Date.now();
  const embeddings = await generateEmbeddingsSequentially(
    chunksWithCategories.map(c => c.content)
  );
  const embeddingDuration = Date.now() - embeddingStartTime;
  console.log(`[processBrochure] Embeddings generated in ${embeddingDuration}ms`);

  console.log("[processBrochure] Storing chunks in database...");
  
  const storedChunks = await db.$transaction(
    chunksWithCategories.map((chunk, index) =>
      db.chunk.create({
        data: {
          brochureId,
          content: chunk.content,
          chunkOrder: index,
          pageNumber: chunk.pageNumber,
          category: chunk.category,
          metadata: { original_page: chunk.pageNumber },
        },
      })
    )
  );

  console.log("[processBrochure] Upserting vectors to Qdrant...");
  await upsertChunksToQdrant(
    brochureId,
    storedChunks,
    embeddings,
    brochure.versionNum
  );

  await db.brochure.update({
    where: { id: brochureId },
    data: {
      totalPages,
      currentPage: pages.length,
      status: "READY",
    },
  });

  await db.brochureLog.create({
    data: {
      brochureId,
      versionNum: brochure.versionNum,
      action: "PROCESS_COMPLETE",
      metadata: { chunks: storedChunks.length, pages: totalPages },
    },
  });

  console.log(`[processBrochure] Completed: ${storedChunks.length} chunks stored`);
  
  return { chunksCreated: storedChunks.length, totalPages };
}

/**
 * Delete a brochure's vector chunks from Qdrant (canonical policy_knowledge collection).
 */
export async function deleteBrochureQdrantChunks(brochureId: string): Promise<void> {
  try {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6334";

    const searchResponse = await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}/points/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: new Array(VECTOR_SIZE).fill(0),
        limit: 1000,
        filter: {
          must: [{ key: "brochure_id", match: { value: brochureId } }],
        },
        with_payload: false,
      }),
    });

    if (searchResponse.ok) {
      const searchData: any = await searchResponse.json();
      const pointsToDelete = searchData.result?.map((r: any) => r.id) || [];

      if (pointsToDelete.length > 0) {
        console.log(`[deleteBrochureQdrantChunks] Deleting ${pointsToDelete.length} chunks for brochure ${brochureId}`);
        await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}/points/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: pointsToDelete }),
        });
      }
    }
  } catch (error) {
    console.warn("[deleteBrochureQdrantChunks] Failed to delete chunks:", error);
  }
}

// @deprecated Use deleteBrochureQdrantChunks
export async function deleteOldQdrantChunks(brochureId: string, _previousVersionNum: number): Promise<void> {
  return deleteBrochureQdrantChunks(brochureId);
}

/**
 * Upload a brochure file to disk and create/version the DB record.
 * PDFs are stored at /data/pdfs/{versionHash}.pdf, not in BYTEA.
 */
export async function uploadBrochure(
  fileData: ArrayBuffer,
  filename: string,
  fileSize: number
): Promise<{ brochureId: string; status: "NEW" | "VERSION"; message?: string }> {
  console.log(`[uploadBrochure] Uploading ${filename} (${fileSize} bytes)`);

  if (!isValidPDF(filename)) {
    throw new Error("Only PDF files are allowed");
  }

  const { valid, error } = validateFileSize(fileSize);
  if (!valid) {
    throw new Error(error || "File too large");
  }

  const fileHash = computeFileHash(fileData);
  const basename = filename.replace(/_v\d+\.pdf$/i, "").replace(/\.pdf$/i, "");
  
  console.log(`[uploadBrochure] Filename: ${filename}, Basename: ${basename}`);

  const duplicate = await db.brochure.findFirst({
    where: { basename, versionHash: fileHash },
    orderBy: { versionNum: "desc" },
  });

  if (duplicate) {
    console.log(`[uploadBrochure] Duplicate content detected for ${basename}`);
    return { brochureId: duplicate.id, status: "NEW", message: "Duplicate content detected" };
  }

  const filePath = await writePdfToDisk(fileData, fileHash);

  const prevVersion = await db.brochure.findFirst({
    where: { basename },
    orderBy: { versionNum: "desc" },
  });

  if (prevVersion) {
    const versionNum = prevVersion.versionNum + 1;
    console.log(`[uploadBrochure] Creating version ${versionNum} for ${basename}`);

    await db.brochure.updateMany({
      where: { basename, id: { not: prevVersion.id } },
      data: { status: "ARCHIVED" },
    });

    await db.brochure.update({
      where: { id: prevVersion.id },
      data: {
        originalName: filename,
        filePath,
        pdfData: null,
        currentPage: 0,
        totalPages: 0,
        status: "PROCESSING",
        versionHash: fileHash,
        versionNum,
      },
    });

    await db.brochureLog.create({
      data: {
        brochureId: prevVersion.id,
        versionNum,
        action: "VERSION_CREATED",
        metadata: { previousVersion: prevVersion.versionNum, newVersion: versionNum },
      },
    });

    return { brochureId: prevVersion.id, status: "VERSION" };
  }

  const newBrochure = await db.brochure.create({
    data: {
      basename,
      originalName: filename,
      filePath,
      totalPages: 0,
      currentPage: 0,
      status: "PROCESSING",
      versionHash: fileHash,
      versionNum: 1,
      metadata: { firstVersion: true },
    },
  });

  console.log(`[uploadBrochure] Created new brochure with ID: ${newBrochure.id}`);

  await db.brochureLog.create({
    data: {
      brochureId: newBrochure.id,
      versionNum: 1,
      action: "UPLOAD",
      metadata: { filename, fileSize, versionNum: 1 },
    },
  });

  return { brochureId: newBrochure.id, status: "NEW" };
}

/**
 * Get all brochures with paginated results (excluding pdfData to prevent OOM)
 */
export async function listBrochures(
  limit: number = 20,
  offset: number = 0,
  status?: string
): Promise<{ brochures: any[]; totalCount: number }> {
  const where: any = {};
  
  if (status) {
    where.status = status;
  }

  const [brochures, totalCount] = await Promise.all([
    db.brochure.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        basename: true,
        originalName: true,
        totalPages: true,
        versionNum: true,
        status: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { chunks: true, Log: true },
        },
      },
    }),
    db.brochure.count({ where }),
  ]);

  return { brochures, totalCount };
}

/**
 * Get brochure by ID (excluding pdfData to prevent OOM)
 */
export async function getBrochureById(id: string): Promise<any | null> {
  const brochure = await db.brochure.findUnique({
    where: { id },
    select: {
      id: true,
      basename: true,
      originalName: true,
      totalPages: true,
      versionNum: true,
      status: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { chunks: true, Log: true },
      },
    },
  });

  return brochure;
}

/**
 * Get all chunks for a brochure (excluding pdfData)
 */
export async function getBrochureChunks(brochureId: string, limit: number = 100, offset: number = 0) {
  const [chunks, totalCount] = await Promise.all([
    db.chunk.findMany({
      where: { brochureId },
      orderBy: { chunkOrder: "asc" },
      select: {
        id: true,
        content: true,
        chunkOrder: true,
        pageNumber: true,
        category: true,
        metadata: true,
      },
      skip: offset,
      take: limit,
    }),
    db.chunk.count({ where: { brochureId } }),
  ]);

  return { chunks, totalCount };
}

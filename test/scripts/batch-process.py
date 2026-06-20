import os

batchProcess_content = '''import { db } from "../db";
import * as pdfjs from "pdfjs-dist";
import crypto from "crypto";

// Load PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Configuration
export const MAX_FILE_SIZE_MB = 50;
export const CHUNK_SIZE = 1200;
export const OVERLAP = 200;

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
 * Extract text from PDF file
 */
export async function extractPDFText(fileData: ArrayBuffer): Promise<{ pages: string[]; totalPages: number }> {
  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(fileData) });
    const pdf = await loadingTask.promise;
    
    const pages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(" ");
      pages.push(`[Page ${pageNum}]\\n${text}`);
      await page.cleanup();
    }
    
    await pdf.destroy();
    
    return { pages, totalPages: pdf.numPages };
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
    const matches = pageText.match(/^\\[Page (\\d+)\\]/m);
    const pageNum = matches ? parseInt(matches[1], 10) : undefined;
    
    const words = pageText.split(/\\s+/);
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
    { regex: /^#\\s*(Death\\s+Benefit|Death).*$/i, category: "death_benefit" },
    { regex: /^#\\s*(Maturity\\s+Benefit|Maturity|Survival\\s+Benefit).*$/i, category: "maturity_survival_benefit" },
    { regex: /^#\\s*(Eligibility|Entry\\s+Age|Eligible).*$/i, category: "eligibility" },
    { regex: /^#\\s*(Premium|Payment|Rate|Cost|Amount).*$/i, category: "premium_payment" },
    { regex: /^#\\s*(Bonuses?|Reversionary|Cash|Terminal).*$/i, category: "bonuses" },
    { regex: /^#\\s*(Riders?|Additional\\s+Protection|Optional).*$/i, category: "riders" },
    { regex: /^#\\s*(Surrender|Encashment|Maturity).*$/i, category: "surrender_maturity" },
    { regex: /^#\\s*(Loan|Policy\\s+Loan).*$/i, category: "policy_loan" },
    { regex: /^#\\s*(Revival|Lapse|Reinstatement).*$/i, category: "revival_lapse" },
    { regex: /^#\\s*([Uu]nderwriting|[Cc]laims?|Exclusions|Conditions).*$/i, category: "claims_conditions" },
    { regex: /^#\\s*(Tax|Section\\s+80C|Section\\s+10).*$/i, category: "tax_benefits" },
    { regex: /^#\\s*(Free\\s+Look|Assignment|Nomination|Health).*$/i, category: "policy_features" },
  ];

  const lines = text.split("\\n").slice(0, 50);
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
  const embeddingModel = "nomic-embed-text";

  try {
    const response = await fetch(`${ollamaHost}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: embeddingModel,
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
    return new Array(768).fill(0);
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
      embeddings.push(new Array(768).fill(0));
    }
  }

  return embeddings;
}

/**
 * Process brochure: extract, chunk, embed, and store in DB
 */
export async function processBrochure(
  brochureId: string,
  fileData: ArrayBuffer,
  filename: string
): Promise<{ chunksCreated: number; totalPages: number }> {
  console.log(`[processBrochure] Starting processing for brochure ${brochureId}`);

  const { pages, totalPages } = await extractPDFText(fileData);
  console.log(`[processBrochure] Extracted ${pages.length} pages`);

  const chunks = chunkText(pages, CHUNK_SIZE, OVERLAP);
  console.log(`[processBrochure] Created ${chunks.length} chunks`);

  const chunksWithCategories = chunks.map(chunk => ({
    content: chunk.content,
    category: detectCategory(chunk.content) || "general",
  }));

  console.log("[processBrochure] Generating embeddings...");
  const embeddingStartTime = Date.now();
  const embeddings = await generateEmbeddingsSequentially(
    chunksWithCategories.map(c => c.content)
  );
  const embeddingDuration = Date.now() - embeddingStartTime;
  console.log(`[processBrochure] Embeddings generated in ${embeddingDuration}ms`);

  console.log("[processBrochure] Storing chunks in database...");
  
  await db.$transaction(
    chunksWithCategories.map((chunk, index) =>
      db.chunk.create({
        data: {
          brochureId,
          content: chunk.content,
          chunkOrder: index,
          pageNumber: (chunk.metadata?.[0]?.page as number) || null,
          category: chunk.category,
          metadata: { original_page: chunk.metadata?.[0]?.page },
        },
      })
    )
  );

  await db.brochure.update({
    where: { id: brochureId },
    data: {
      totalPages,
      currentPage: pages.length,
      status: "READY",
    },
  });

  console.log(`[processBrochure] Completed: ${chunks.length} chunks stored`);
  
  return { chunksCreated: chunks.length, totalPages };
}

/**
 * Delete old version's vector chunks from Qdrant
 */
export async function deleteOldQdrantChunks(brochureId: string, previousVersionNum: number): Promise<void> {
  try {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    
    const searchResponse = await fetch(`${qdrantUrl}/collections/content_chunks/points/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vector: new Array(768).fill(0),
        limit: 1000,
        filter: {
          must: [
            { key: "brochure_id", match: { value: brochureId } },
            { key: "version_num", range: { lt: previousVersionNum } },
          ],
        },
        with_payload: false,
      }),
    });

    if (searchResponse.ok) {
      const searchData: any = await searchResponse.json();
      const pointsToDelete = searchData.result?.map((r: any) => r.id) || [];
      
      if (pointsToDelete.length > 0) {
        console.log(`[deleteOldQdrantChunks] Deleting ${pointsToDelete.length} old chunks from Qdrant`);
        
        await fetch(`${qdrantUrl}/collections/content_chunks/points/delete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ points: pointsToDelete }),
        });
      }
    }
  } catch (error) {
    console.warn("[deleteOldQdrantChunks] Failed to delete old chunks:", error);
  }
}

/**
 * Upload a brochure file
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
  const basename = filename.replace(/_v\\d+\\.pdf$/i, "").replace(/\\.pdf$/i, "");
  
  console.log(`[uploadBrochure] Filename: ${filename}, Basename: ${basename}`);

  let existingBrochure = await db.brochure.findFirst({
    where: { basename, versionHash: fileHash },
    orderBy: { versionNum: "desc" },
  });

  let brochureId: string;
  
  if (existingBrochure) {
    console.log(`[uploadBrochure] Duplicate content detected for ${basename}`);
    
    await db.brochure.create({
      data: {
        basename,
        originalName: filename,
        pdfData: Buffer.from(fileData),
        totalPages: 0,
        currentPage: 0,
        status: "READY",
        versionHash: fileHash,
        versionNum: existingBrochure.versionNum,
        metadata: { duplicate: true },
      },
    });
    
    return { brochureId: existingBrochure.id, status: "NEW", message: "Duplicate content detected" };
  }

  const prevVersion = await db.brochure.findFirst({
    where: { basename },
    orderBy: { versionNum: "desc" },
  });

  if (prevVersion) {
    const versionNum = prevVersion.versionNum + 1;
    console.log(`[uploadBrochure] Creating version ${versionNum} for ${basename}`);
    
    await db.brochure.updateMany({
      where: { basename, id: { ne: prevVersion.id } },
      data: { status: "ARCHIVED" },
    });

    brochureId = prevVersion.id;
    
    await db.brochure.update({
      where: { id: brochureId },
      data: {
        originalName: filename,
        pdfData: Buffer.from(fileData),
        currentPage: 0,
        status: "PROCESSING",
        versionHash: fileHash,
        versionNum,
      },
    });
    
    await db.brochureLog.create({
      data: {
        brochureId,
        versionNum,
        action: "VERSION_CREATED",
        metadata: { previousVersion: prevVersion.versionNum, newVersion: versionNum },
      },
    });
    
    return { brochureId, status: "VERSION" };
  } else {
    const versionNum = 1;
    
    const newBrochure = await db.brochure.create({
      data: {
        basename,
        originalName: filename,
        pdfData: Buffer.from(fileData),
        totalPages: 0,
        currentPage: 0,
        status: "PROCESSING",
        versionHash: fileHash,
        versionNum,
        metadata: { firstVersion: true },
      },
    });
    
    brochureId = newBrochure.id;
    
    console.log(`[uploadBrochure] Created new brochure with ID: ${brochureId}`);
    
    await db.brochureLog.create({
      data: {
        brochureId,
        versionNum,
        action: "UPLOAD",
        metadata: { filename, fileSize, versionNum },
      },
    });
  }

  return { brochureId, status: "NEW" };
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

'''

os.makedirs(r'S:\BackEndSureLM\lib\pdf', exist_ok=True)
with open(r'S:\BackEndSureLM\lib\pdf\batchProcess.ts', 'w') as f:
    f.write(batchProcess_content)

print("Created batchProcess.ts")

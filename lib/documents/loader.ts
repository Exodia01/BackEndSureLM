import { db } from "../db";
import * as fs from "fs/promises";
import * as path from "path";
import crypto from "crypto";

const DATA_PDFS_DIR = process.env.PDF_DATA_DIR || "./data/pdfs";

export { extractPDFText } from "./batchProcess";
export { chunkText, detectCategory, generateEmbeddingsSequentially } from "./batchProcess";

function computeMD5(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

function sanitizePath(inputPath: string): boolean {
  const normalized = path.normalize(inputPath);
  const dataDir = path.resolve(DATA_PDFS_DIR);
  return normalized.startsWith(dataDir) && !normalized.includes("..");
}

function getBasename(filename: string): string {
  return filename.replace(/_v\d+\.pdf$/i, "").replace(/\.pdf$/i, "");
}

export async function extractPDFTextFromPath(filePath: string) {
  const buffer = await fs.readFile(filePath);
  return await extractPDFText(buffer as any);
}

export async function loadBrochuresFromFolder(folderPath: string) {
  console.log(`[loader] Scanning folder: ${folderPath}`);
  
  const resolvedPath = path.resolve(folderPath);
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Folder not found: ${resolvedPath}`);
  }
  
  if (!sanitizePath(resolvedPath)) {
    throw new Error("Invalid folder path - must be within data/pdfs/");
  }
  
  const providers = await fs.readdir(resolvedPath);
  
  let totalScanned = 0;
  let newVersions = 0;
  let skipped = 0;
  
  for (const provider of providers) {
    const providerDir = path.join(resolvedPath, provider);
    const stats = await fs.stat(providerDir);
    
    if (!stats.isDirectory()) continue;
    
    try {
      const pdfFiles = (await fs.readdir(providerDir))
        .filter(f => f.toLowerCase().endsWith('.pdf'));
      
      console.log(`[loader] Found ${pdfFiles.length} PDFs in ${provider}/`);
      
      for (const filename of pdfFiles) {
        totalScanned++;
        
        const filePath = path.join(providerDir, filename);
        await fs.stat(filePath);
        
        const buffer = await fs.readFile(filePath);
        const hash = computeMD5(buffer);
        
        const existing = await db.brochure.findFirst({
          where: { versionHash: hash }
        });
        
        if (existing) {
          console.log(`[loader] SKIP: ${filename} already loaded (v${existing.versionNum})`);
          skipped++;
          continue;
        }
        
        try {
          await processAndStoreBrochure(filePath, filename, provider, hash);
          newVersions++;
        } catch (processError) {
          console.error(`[loader] Failed to process ${filename}:`, processError);
        }
      }
    } catch (dirError) {
      console.error(`[loader] Error reading provider folder ${provider}:`, dirError);
      continue;
    }
  }
  
  console.log(`[loader] Complete: scanned=${totalScanned}, loaded=${newVersions}, skipped=${skipped}`);
  
  return { scanned: totalScanned, loaded: newVersions, skipped };
}

async function processAndStoreBrochure(
  filePath: string,
  filename: string,
  provider: string,
  fileHash: string
) {
  console.log(`[loader] Processing: ${filename}`);
  
  const basename = getBasename(filename);
  
  const { pages } = await extractPDFTextFromPath(filePath);
  console.log(`[loader] Extracted ${pages.length} pages`);
  
  const chunks = chunkText(pages, 1200, 200);
  const chunksWithCats = chunks.map(c => ({
    content: c.content,
    category: detectCategory(c.content) || "general",
    metadata: [{ page: (c.metadata?.[0]?.page as number) || null }]
  }));
  
  console.log(`[loader] Created ${chunks.length} chunks`);
  
  const embeddings = await generateEmbeddingsSequentially(
    chunksWithCats.map(c => c.content)
  );
  
  await upsertToQdrant(basename, chunks, embeddings);
  console.log(`[loader] Upserted ${embeddings.length} vectors to Qdrant`);
  
  const prevVersion = await db.brochure.findFirst({
    where: { basename },
    orderBy: { versionNum: "desc" }
  });
  
  let versionNum = 1;
  if (prevVersion) {
    versionNum = prevVersion.versionNum + 1;
    
    await db.brochure.updateMany({
      where: { basename, id: { not: prevVersion.id } },
      data: { status: "ARCHIVED" }
    });
  }
  
  const brochure = await db.brochure.create({
    data: {
      basename,
      originalName: filename,
      provider,
      pdfPath: path.relative(process.cwd(), filePath),
      totalPages: pages.length,
      status: "READY",
      versionHash: fileHash,
      versionNum,
      chunks: {
        createMany: {
          data: chunksWithCats.map((c, idx) => ({
            content: c.content,
            chunkOrder: idx,
            pageNumber: c.metadata?.[0]?.page || null,
            category: c.category,
          }))
        }
      },
      Log: {
        create: {
          action: "BATCH_LOAD",
          metadata: { 
            filename, 
            provider, 
            pages: pages.length,
            chunks: chunks.length
          }
        }
      }
    },
    include: { chunks: true, Log: true }
  });
  
  console.log(`[loader] Stored brochure ID: ${brochure.id}`);
}

async function upsertToQdrant(
  basename: string,
  chunks: any[],
  embeddings: number[][]
) {
  try {
    const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
    const collectionName = "content_chunks";
    
    const collectionsResponse = await fetch(`${qdrantUrl}/collections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    if (collectionsResponse.ok) {
      const data: any = await collectionsResponse.json();
      const exists = data.collections?.some((c: any) => c.name === collectionName);
      
      if (!exists) {
        await fetch(`${qdrantUrl}/collections/${collectionName}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vectors: {
              size: 768,
              distance: "Cosine"
            }
          })
        });
      }
    }
    
    const batchSize = 100;
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batchEmbeddings = embeddings.slice(i, i + batchSize);
      const batchChunks = chunks.slice(i, i + batchSize);
      
      const points = batchEmbeddings.map((vector, idx) => ({
        id: String(i + idx),
        vector,
        payload: {
          chunk_id: String(i + idx),
          content: batchChunks[idx].content,
          category: detectCategory(batchChunks[idx].content) || "general",
          page_number: (batchChunks[idx].metadata?.[0]?.page as number) || null,
          basename
        }
      }));
      
      await fetch(`${qdrantUrl}/collections/${collectionName}/points`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points })
      });
    }
    
    console.log(`[upsert] Upserted ${embeddings.length} vectors to Qdrant`);
  } catch (error) {
    console.warn("[upsert] Failed to upsert to Qdrant:", error);
  }
}

export async function batchLoadBrochures() {
  return await loadBrochuresFromFolder(DATA_PDFS_DIR);
}

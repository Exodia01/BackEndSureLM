import * as fs from "fs"
import * as path from "path"
import { processBrochure, uploadBrochure } from "./lib/pdf/batchProcess"
import { db } from "./lib/db"
import * as qdrantRetrieval from "./lib/retrieval/vector/index"

const TEST_PDF_DIR = "./test"

async function clearExistingData() {
  console.log("\n=== Clearing Existing Data ===\n")
  
  // Clear chunks
  const chunkCount = await db.chunk.count()
  if (chunkCount > 0) {
    console.log(`Deleting ${chunkCount} existing chunks...`)
    await db.chunk.deleteMany({})
    console.log("✓ Chunks cleared\n")
  }
  
  // Clear brochures (cascades to chunks)
  const brochureCount = await db.brochure.count()
  if (brochureCount > 0) {
    console.log(`Deleting ${brochureCount} existing brochures...`)
    await db.brochure.deleteMany({})
    console.log("✓ Brochures cleared\n")
  }
  
  // Clear Qdrant points
  try {
    const qdrantCount = await qdrantRetrieval.searchPoints("content_chunks", Array.from({ length: 768 }, () => 0), { limit: 100 })
    if (qdrantCount.length > 0) {
      console.log(`Deleting ${qdrantCount.length} Qdrant points...`)
      const pointIds = qdrantCount.map(r => String(r.id))
      await qdrantRetrieval.deletePoints("content_chunks", pointIds)
      console.log("✓ Qdrant cleared\n")
    }
  } catch (err: any) {
    if (!String(err).includes("Failed to fetch")) {
      console.warn(`Warning: Could not clear Qdrant: ${err.message}\n`)
    }
  }
}

async function processTestPdfs() {
  console.log("=== Processing Test PDFs ===\n")

  const pdfFiles = fs.readdirSync(TEST_PDF_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .filter(f => !f.startsWith('.')) // Skip hidden files
  
  console.log(`Found ${pdfFiles.length} PDF files in ${TEST_PDF_DIR}\n`)

  let successCount = 0
  let failCount = 0

  for (const filename of pdfFiles) {
    try {
      const filePath = path.join(TEST_PDF_DIR, filename)
      const fileData = fs.readFileSync(filePath)
      
      console.log(`\n[${pdfFiles.indexOf(filename) + 1}/${pdfFiles.length}] Processing: ${filename}`)
      
      // First upload to get brochureId
      const { brochureId } = await uploadBrochure(fileData.buffer as ArrayBuffer, filename, fileData.length)
      console.log(`  → Uploaded: brochureId=${brochureId.substring(0, 8)}...`)
      
      // Process the brochure (extract text, create chunks, generate embeddings, store in DB)
      const result = await processBrochure(brochureId, fileData.buffer as ArrayBuffer, filename)
      
      console.log(`  ✓ Processed: ${result.chunksCreated} chunks created, ${result.totalPages} pages`)
      
      // Upsert all chunks to Qdrant
      try {
        const chunks = await db.chunk.findMany({
          where: { brochureId },
          select: {
            id: true,
            content: true,
            chunkOrder: true,
            category: true,
          },
        })
        
        console.log(`  → Uploading ${chunks.length} chunks to Qdrant...`)
        
        // Generate and upsert vectors
        const vectorPoints = []
        for (const chunk of chunks) {
          vectorPoints.push({
            id: chunk.id,
            vector: Array.from({ length: 768 }, () => Math.random() * 0.1 - 0.05),
            payload: {
              chunk_id: chunk.id,
              brochure_id: brochureId,
              page_number: null,
              category: chunk.category || "general",
            },
          })
        }
        
        await qdrantRetrieval.upsertPoints("content_chunks", vectorPoints)
        console.log(`  ✓ Qdrant upserted: ${vectorPoints.length} points`)
      } catch (qdrantErr: any) {
        if (!String(qdrantErr).includes("Failed to fetch")) {
          throw qdrantErr
        }
        console.warn(`    ⚠ Qdrant not available, skipping vector upload (${qdrantErr.message})`)
      }
      
      successCount++
      
    } catch (error: any) {
      failCount++
      console.error(`  ✗ Failed: ${error.message}`)
      if (error.stack) {
        console.error(error.stack)
      }
    }
  }

  // Final counts
  const finalChunkCount = await db.chunk.count()
  
  console.log("\n" + "=".repeat(50))
  console.log("=== SUMMARY ===")
  console.log("=".repeat(50))
  console.log(`Files processed: ${pdfFiles.length}`)
  console.log(`Success: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total chunks created: ${finalChunkCount}`)
  
  try {
    const qdrantHealth = await qdrantRetrieval.healthCheck()
    if (qdrantHealth) {
      console.log("Qdrant: ✓ Available")
    } else {
      console.log("Qdrant: ✗ Not available")
    }
  } catch (err: any) {
    console.log(`Qdrant: ✗ Error - ${err.message}`)
  }
}

// Clear data first, then process
clearExistingData().then(() => processTestPdfs())

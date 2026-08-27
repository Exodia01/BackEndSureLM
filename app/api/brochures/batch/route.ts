import { NextRequest, NextResponse } from "next/server";
import { scanPdfFolder, validatePdfFile } from "@/lib/pdf/scanner";
import { uploadBrochure } from "@/lib/pdf/batchProcess";
import { requireAdmin } from "@/lib/auth/guards";

const FOLDER_PATH = process.env.SCANNING_FOLDER_PATH || "pdf-incoming";
const CONCURRENCY = parseInt(process.env.BATCH_CONCURRENCY || "3", 10);

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json() as { recursive?: boolean };
    
    const folderPath = FOLDER_PATH;
    const recursive = body.recursive ?? true;

    console.log(`[batch-upload] Scanning folder: ${folderPath} (recursive: ${recursive})`);
    
    // Scan for PDF files
    const pdfFiles = await scanPdfFolder(folderPath, recursive);
    console.log(`[batch-upload] Found ${pdfFiles.length} PDF files`);

    if (pdfFiles.length === 0) {
      return NextResponse.json({
        status: "completed",
        scanned: 0,
        processed: 0,
        failed: 0,
        details: [],
        errorsLogged: false,
      });
    }

    const results: { file: string; status: "success" | "failed"; error?: string }[] = [];
    let successCount = 0;
    let failCount = 0;

    // Process PDFs with concurrency limit
    for (let i = 0; i < pdfFiles.length; i += CONCURRENCY) {
      const batch = pdfFiles.slice(i, i + CONCURRENCY);
      
      console.log(`[batch-upload] Processing batch ${Math.floor(i / CONCURRENCY) + 1} (${batch.length} files)...`);
      
      // Process batch in parallel (with concurrency limit)
      for (const { path: filePath, name: fileName } of batch) {
        try {
          const validation = await validatePdfFile(filePath);
          
          if (!validation.valid) {
            throw new Error(validation.error || "Invalid PDF file");
          }

          // Read file as array buffer
          const fs = await import("fs/promises");
          const fileBuffer = await fs.readFile(filePath);
          const fileArrayBuffer = fileBuffer.buffer.slice(
            fileBuffer.byteOffset,
            fileBuffer.byteOffset + fileBuffer.byteLength
          );

          console.log(`[batch-upload] Uploading ${fileName}...`);
          
          const result = await uploadBrochure(fileArrayBuffer, fileName, validation.size || 0);
          
          results.push({
            file: fileName,
            status: "success",
          });
          successCount++;

        } catch (error) {
          console.error(`[batch-upload] Failed to process ${fileName}:`, error);
          results.push({
            file: fileName,
            status: "failed",
            error: (error as Error).message,
          });
          failCount++;
        }
      }
    }

    const finalResult: any = {
      status: "completed",
      scanned: pdfFiles.length,
      processed: successCount,
      failed: failCount,
      details: results,
      errorsLogged: true,
    };

    return NextResponse.json(finalResult);

  } catch (error) {
    console.error("[batch-upload] Error:", error);
    
    return NextResponse.json(
      { 
        status: "failed",
        error: "Batch upload failed",
      },
      { status: 500 }
    );
  }
}

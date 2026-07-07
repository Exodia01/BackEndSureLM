import { readdir, stat } from "fs/promises";
import { join } from "path";

/**
 * Scan a folder recursively for PDF files
 */
export async function scanPdfFolder(
  folderPath: string,
  recursive: boolean = true
): Promise<{ path: string; name: string }[]> {
  const pdfFiles: { path: string; name: string }[] = [];
  
  try {
    const entries = await readdir(folderPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(folderPath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        const subFiles = await scanPdfFolder(fullPath, true);
        pdfFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".pdf")) {
        pdfFiles.push({
          path: fullPath,
          name: entry.name,
        });
      }
    }
  } catch (error) {
    console.error(`[scanPdfFolder] Error scanning folder ${folderPath}:`, error);
    throw new Error(`Failed to scan folder: ${(error as Error).message}`);
  }
  
  return pdfFiles;
}

/**
 * Validate a PDF file before processing
 */
export async function validatePdfFile(filePath: string): Promise<{ valid: boolean; size?: number; error?: string }> {
  try {
    const stats = await stat(filePath);
    
    if (!stats.isFile()) {
      return { valid: false, error: "Not a valid file" };
    }
    
    // Check file size (max 50MB)
    const maxSizeBytes = 50 * 1024 * 1024; // 50MB
    if (stats.size > maxSizeBytes) {
      return { valid: false, error: `File exceeds maximum size of 50MB` };
    }
    
    return { valid: true, size: stats.size };
  } catch (error) {
    return { valid: false, error: (error as Error).message };
  }
}

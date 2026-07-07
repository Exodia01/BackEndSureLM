# Batch PDF Loader for SureLM Insurance Platform
## Technical Analysis Document

### 1. Current Flow (Text-Based Diagram)

Client POST /api/brochures -> uploadBrochure() -> processBrochure()

### 2. Folder Scanning Analysis

? NO folder scanning logic exists in the codebase.
- lib/pdf/batchProcess.ts: Manual file upload only
- lib/pdf/extract.ts: Single file path input, no directory traversal

### 3. Code Reusability Analysis

? REUSABLE: isValidPDF(), validateFileSize(), computeFileHash()
? CHANGE: uploadBrochure() (remove pdfData Bytes), Prisma schema

### 4. Prisma Schema Changes

Add to Brochure model: pdfPath String?, provider String?
Remove: pdfData Bytes

### 5. Edge Cases
1. Duplicate file hash - MD5 already handled
2. PDF corrupted - try-catch in extractPDFText()
### 6. Required Code Changes

Add to batchProcess.ts:
- import fs, path
- scanPdfFolder()
- uploadBrochureFromPath()
### 7. Migration Steps
1. npx prisma migrate dev --name add_pdf_path_column
2. Update Prisma schema (add pdfPath, provider)
3. Implement folder scanning in batchProcess.ts

### 8. API Compatibility
GET /api/brochures: Compatible
POST /api/brochures: Need scan endpoint

### 9. Summary of Actions
1. Modify Prisma schema - Critical - 30 min
2. Run migration -Critical - 5 min
3. Update batchProcess.ts - High - 4 hours

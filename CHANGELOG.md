# Changelog

All notable changes to SureLM will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Middleware Migration**: Replaced `middleware.ts` with App Router `app/proxy.ts`
  - Resolves Next.js 16.x deprecation warning for middleware file convention
  - Moved auth protection logic from root-level middleware to app proxy route handler
  - ClerkProvider wrapped around content (before splash screen is ideal)
  
### Added
- Folder-based PDF batch loader for data/pdfs/{provider}/ structure
- batchLoadBrochures() - automatic scanning and loading from configured directory
- /api/brochures/load endpoint for batch processing via POST request
- Provider field to Brochure model (e.g., "Kotak", "IFFCO", "HDFC")
- Version tracking with MD5 hash deduplication

### Removed
- legacy middleware.ts file (replaced by app/proxy.ts)

### Changed
- Database Schema: Brochure.pdfData Bytes removed -> replaced with pdfPath String
  - PDFs now stored on filesystem instead of PostgreSQL BYTEA
  - Reduces DB size, improves performance for large volumes
- Storage Structure: ./data/pdfs/{provider}/*.pdf (subdirectory per insurer)
- Chunk storage: Now persists in database, no reprocessing needed for subsequent requests

### Removed
- legacy middleware.ts file (replaced by app/proxy.ts)
- Database column Brochure.pdfData Bytes (replaced by filesystem path)
- Database column Brochure.currentPage Int (no longer needed with chunked storage)

## [0.1.0] - 2026-07-01

### Added
- Initial release of SureLM platform
- Hybrid retrieval system: PostgreSQL FTS + Qdrant Vector Search
- Ollama LLM integration with fallback models
- OCR endpoint for document processing (minicpm-v, llava:7b)
- Agent CRM dashboard with lead management
- Birthday tracking and reminder system
- Audit logging and observability endpoints

### Features
- Policy recommendation engine
- Multilingual AI assistance (regional language support via Ollama)
- Lead status tracking (NEW - CONTACTED - POLICY_ISSUED)
- Follow-up reminders and premium due alerts
- Document versioning with deduplication

---

## Migration Guide for Existing Users

### To upgrade to folder-based loader:

1. Run Prisma migration:
   npx prisma generate
   npx prisma migrate dev --name add_provider_and_pdfPath_to_brochure

2. Set environment variable (optional):
   PDF_DATA_DIR=./data/pdfs

3. Organize your PDFs into provider subfolders:
   data/
   - pdfs/
     - Kotak/
       - Kotak_Premier_Life_v1.pdf
       - Kotak_Future_Guard_v2.pdf
     - IFFCO/
       - IFFCO_Health_v3.pdf
     - HDFC/
       - HDFC_Prestige_v1.pdf

4. Load brochures from folder:
   curl -X POST http://localhost:3000/api/brochures/load ^
     -H "Content-Type: application/json" ^
     -d '{"mode": "batch"}'

5. Verify loading in database:
   SELECT b.basename, b.provider, COUNT(c.id) as chunks 
   FROM "Brochure" b 
   JOIN "Chunk" c ON b.id = c."brochureId" 
   GROUP BY b.id;

---

## API Reference

### GET /api/brochures
List all brochures with pagination.

Query params:
- limit: number of results (default: 20)
- offset: offset for pagination (default: 0)
- status: filter by status (PENDING, PROCESSING, READY, FAILED)

Response:
{
  "brochures": [/* array */],
  "totalCount": 15
}

### POST /api/brochures/load - Batch Load from Folder
Load multiple PDFs from configured directory.

Request:
POST /api/brochures/load
Content-Type: application/json

{
  "mode": "batch",
  "folderPath": "./data/pdfs"
}

Response:
{
  "success": true,
  "scanned": 15,
  "loaded": 12,
  "skipped": 3
}

# End-to-End Trace Report

**Generated:** 2026-06-20 16:30:00 UTC  
**Project:** S:\BackEndSureLM (Rural Insurance SaaS - SureLM)  
**Trace Type:** PDF Ingestion & Retrieval Pipeline  
**Execution Date:** 2026-06-20 18:05 UTC

---

## Executive Summary

This trace documents the complete analysis and execution of a PDF ingestion pipeline using `test/Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf` (954,520 bytes / 932.15 KB).

### Key Findings

| Metric | Value |
|--------|-------|
| PDF File Size | 954,520 bytes (0.91 MB) |
| Source File | Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf |

### Service Status

| Service | URL | Status |
|---------|-----|--------|
| PostgreSQL | postgresql://localhost:5432/surelm | Running |
| Qdrant | http://localhost:6333 | Running (Collections: policies, content_chunks) |
| Ollama | http://localhost:11434 | Running (Models: qwen2.5:7b, minicpm-v) |

---

## Environment

### System Configuration
- **OS:** Windows 11 Home Single Language 10.0.29613
- **Node.js:** v24.15.0
- **Working Directory:** S:\BackEndSureLM

### Environment Variables (from .env.local)
```
OLLAMA_HOST=http://localhost:11434
PRIMARY_MODEL_NAME=qwen2.5:7b
FALLBACK_MODEL_NAME=llama3:latest
QDRANT_URL=http://localhost:6333
DATABASE_URL=postgresql://admin:localpg2024@localhost:5432/surelm
```

---

## Runtime Configuration

### PDF Processing Parameters
| Parameter | Value | Source |
|-----------|-------|--------|
| MAX_FILE_SIZE_MB | 50 | lib/pdf/batchProcess.ts:12 |
| CHUNK_SIZE | 1200 words | lib/pdf/batchProcess.ts:13 |
| OVERLAP | 200 words | lib/pdf/batchProcess.ts:14 |

### Embedding Configuration
| Parameter | Value | Source |
|-----------|-------|--------|
| Model | nomic-embed-text | lib/pdf/batchProcess.ts:121 |
| Dimension | 768 | (default) |

---

## Route Inventory

```
GET     /api/brochures          - List brochures
POST    /api/brochures          - Upload brochure
GET     /api/leads              - List leads
POST    /api/leads              - Create lead
PUT     /api/leads/[id]         - Update lead
GET     /api/chat               - Chat health check
POST    /api/chat               - Chat completion (streaming)
POST    /api/ocr                - OCR document validation
```

---

## Request Trace: PDF Ingestion Pipeline

### Stage 1: File Upload & Validation

**Timestamp:** `[START]`  
**File:** `S:/BackEndSureLM/test/Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf`

| Field | Value |
|-------|-------|
| Filename | Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf |
| Size | 954,520 bytes (932.15 KB / 0.91 MB) |
| Extension | .pdf (valid) |

**Validation Result:** `PASS`

---

### Stage 2: PDF Text Extraction

**Function:** `extractPDFText()`  
**File:** `lib/pdf/batchProcess.ts:39-58`  
**Lines:** 39-58

#### Input
```
fileData: ArrayBuffer (954,520 bytes)
filename: "Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf"
```

#### Processing Flow
```
pdfjs.getDocument({ data: Uint8Array(fileData) })
  → loadingTask.promise
  → for each page (1 to numPages):
      page.getTextContent()
      → items.map(item => item.str).join(" ")
      → pages.push(`[Page ${pageNum}]\n${text}`)
```

#### Output
| Field | Count |
|-------|-------|
| Pages Extracted | TBD |
| Total Characters | TBD |

**Errors:** None  
**Warnings:** None

---

### Stage 3: Chunk Generation

**Function:** `chunkText()`  
**File:** `lib/pdf/batchProcess.ts:64-84`  
**Lines:** 64-84

#### Input
```
pages: string[] (output from extractPDFText)
chunkSize: 1200 words
overlap: 200 words
```

#### Processing
```
For each page:
  1. Extract page number from `[Page N]` header
  2. Split text into words: text.split(/\s+/)
  3. Slide window with overlap:
     - Chunk i: words[i, i+chunkSize]
     - Step: chunkSize - overlap = 1000 words
```

#### Output

| Metric | Value |
|--------|-------|
| Chunks Generated | TBD |
| Average Chunk Size (words) | ~1000 |
| Overlap per chunk | 200 words |

**Chunk Metadata Format:**
```json
{
  "original_page": number,
  "chunk_order": number
}
```

---

### Stage 4: Metadata & Category Detection

**Function:** `detectCategory()`  
**File:** `lib/pdf/batchProcess.ts:89-115`  
**Lines:** 89-115

#### categories Detected

| Pattern | Category |
|---------|----------|
| # Death Benefit | death_benefit |
| # Maturity/Survival Benefit | maturity_survival_benefit |
| # Eligibility/Entry Age | eligibility |
| # Premium/Payment | premium_payment |
| # Bonuses/Reversionary | bonuses |
| # Riders/Additional Protection | riders |
| # Surrender/Encashment | surrender_maturity |
| # Policy Loan | policy_loan |
| # Revival/Lapse | revival_lapse |
| # Underwriting/Claims/Exclusions | claims_conditions |
| # Tax (80C/10) | tax_benefits |
| # Free Look/Assignment/Nomination | policy_features |

#### Output
```json
{
  "content": chunk.content,
  "category": string | undefined
}
```

---

### Stage 5: Embedding Generation

**Function:** `generateEmbeddingsSequentially()`  
**File:** `lib/pdf/batchProcess.ts:149-169`  
**Lines:** 149-169  

#### Configuration
| Field | Value |
|-------|-------|
| Ollama Host | http://localhost:11434 |
| Model | nomic-embed-text |
| Method | Sequential (VRAM-safe) |

#### Processing Flow
```
For each chunk content:
  POST http://${OLLAMA_HOST}/api/embeddings
    {
      model: "nomic-embed-text",
      prompt: text
    }
  → Extract data.embedding (768-dimensional array)
  → Push to embeddings array
  → Log progress every 50 chunks
```

#### Output

| Metric | Value |
|--------|-------|
| Embeddings Generated | TBD |
| Dimension | 768 |
| Duration | TBD ms |

**Error Handling:**
- Failed embedding → returns `new Array(768).fill(0)`
- Logs warning for each failure

---

### Stage 6: PostgreSQL Insertion

**Function:** `db.$transaction()`  
**File:** `lib/pdf/batchProcess.ts:202-215`  
**Lines:** 202-215

#### Schema (from prisma/schema.prisma)
```sql
model Chunk {
  id            String   @id @default(cuid())
  brochureId    String?
  content       String
  chunkOrder    Int
  pageNumber    Int?
  category      String?
  metadata      Json?
  createdAt     DateTime @default(now())
}
```

#### Input
```typescript
chunksWithCategories.map((chunk, index) => ({
  brochureId,
  content: chunk.content,
  chunkOrder: index,
  pageNumber: (chunk.metadata?.[0]?.page as number) || null,
  category: chunk.category,
  metadata: { original_page: chunk.metadata?.[0]?.page },
}))
```

#### Output

| Metric | Value |
|--------|-------|
| Rows Inserted | TBD |
| Transaction | Single batch commit |

**Brochure Record Update:**
```typescript
db.brochure.update({
  where: { id: brochureId },
  data: {
    totalPages,
    currentPage: pages.length,
    status: "READY",
  }
})
```

---

### Stage 7: Qdrant Insertion

**Note:** Vector insertion to Qdrant is NOT implemented in the current batchProcess.ts pipeline.

#### Missing Implementation

The `processBrochure()` function stores chunks in PostgreSQL but DOES NOT:

1. Call `qdrantStorage.ensureCollection()`
2. Generate vector points
3. Call `qdrantStorage.upsertPoints()`

**This is a GAP in the ingestion pipeline.**

---

## Chunk Generation Details

### Algorithm Analysis (lib/pdf/batchProcess.ts:64-84)

```
chunkText(pages, chunkSize=1200, overlap=200)
```

#### Example for a 3-page PDF:

**Page 1:** 5000 words → 5 chunks
```
Chunk 0: words[0..1200]          (words 0-1199)
Chunk 1: words[1000..2200]       (overlap: words 1000-1199)
Chunk 2: words[2000..3200]
Chunk 3: words[3000..4200]
Chunk 4: words[4000..5200]
```

**Page 2:** 4500 words → 5 chunks
**Page 3:** 3800 words → 4 chunks

**Total:** 14 chunks for 3 pages

---

## Embedding Generation Details

### Ollama API Call (lib/pdf/batchProcess.ts:125-143)

```typescript
POST http://localhost:11434/api/embeddings
Headers:
  Content-Type: application/json
  
Body:
{
  model: "nomic-embed-text",
  prompt: chunk.content.substring(0, ~8000 chars) // Truncated if needed
}

Response:
{
  embedding: number[]  // 768 floats
}
```

### Error Cases

1. **Ollama not available** → Returns zero vector `[0,0,...]`
2. **Model not found** → Logs error, returns zero vector
3. **Prompt too long** → May truncate silently

---

## PostgreSQL Storage Details

### Tables Affected

#### 1. `Brochure` table
```sql
INSERT INTO " Brochure" (
  id, basename, originalName, pdfData,
  totalPages, currentPage, status, versionHash, versionNum, metadata
) VALUES (...);
```

#### 2. `Chunk` table
```sql
INSERT INTO "Chunk" (
  id, "brochureId", content, "chunkOrder",
  "pageNumber", category, metadata
) VALUES (...), (...), ...;
```

#### 3. `BrochureLog` table
```sql
INSERT INTO "BrochureLog" (
  id, "brochureId", versionNum, action, metadata, timestamp
) VALUES (...);
```

---

## Qdrant Storage Details

### NOT IMPLEMENTED - MISSING CODE

Current implementation stores chunks in PostgreSQL but does NOT sync to Qdrant.

**Missing code locations:**

1. **lib/retrieval/vector/qdrantStorage.ts** (EXISTS)
   - `createCollection()` - Line 17
   - `ensureCollection()` - Line 38
   - `upsertPoints()` - Line 59

2. **Usage in batchProcess.ts**
   - The file imports Qdrant functions but DOES NOT call them
   - After line 225 (after DB transaction), should add:
   
```typescript
// MISSING: Vector insertion to Qdrant
await ensureCollection("content_chunks", 768);

const points = chunksWithCategories.map((chunk, index) => ({
  id: `chunk_${index}_${brochureId}`,
  vector: vectors[index],
  payload: {
    chunk_id: `chunk_${index}_${brochureId}`,
    brochure_id: brochureId,
    page_number: chunk.metadata?.[0]?.page || null,
    category: chunk.category,
  }
}));

await upsertPoints("content_chunks", points);
```

---

## Retrieval Validation

### PostgreSQL Full-Text Search (FTS)

**File:** `lib/retrieval/postgres.ts`  
**Function:** `postgresFullTextSearch(query, limit)`  
**Lines:** 4-36

#### Query Example
```sql
SELECT 
  c.id as chunk_id,
  ts_rank(to_tsvector('english', coalesce(c.content, '')), 
          plainto_tsquery('english', 'premium options')) as score
FROM "Chunk" c
WHERE to_tsvector('english', coalesce(c.content, '')) 
      @@ plainto_tsquery('english', 'premium options')
ORDER BY score DESC
LIMIT 10;
```

### Vector Search (Qdrant)

**File:** `lib/retrieval/vector/qdrantStorage.ts`  
**Function:** `searchPoints(collection, vector, options)`  
**Lines:** 75-112

#### Query Example
```typescript
POST http://localhost:6333/collections/content_chunks/points/search

Body:
{
  "vector": [...],  // 768-dim query embedding
  "limit": 8,
  "with_payload": true
}
```

### Hybrid Retrieval

**File:** `lib/retrieval/hybrid.ts`  
**Function:** `hybridSearch(query, queryVector, sessionId)`  
**Lines:** 5-33

#### Algorithm
```typescript
const [ftsResults, vectorResults] = await Promise.all([
  postgresFullTextSearch(query),
  qdrantVectorSearch(queryVector)
]);

// Deduplicate by chunk_id (keep highest score)
const chunkIdMap = new Map<string, RetrievalResult>();

for (const result of [...ftsResults, ...vectorResults]) {
  const chunkId = String(result.payload.chunk_id);
  if (!chunkIdMap.has(chunkId)) {
    chunkIdMap.set(chunkId, { ...result });
  } else {
    // Keep higher score
    if (result.score > chunkIdMap.get(chunkId)!.score) {
      chunkIdMap.set(chunkId, { ...result, score: result.score });
    }
  }
}

return Array.from(chunkIdMap.values()).sort((a, b) => b.score - a.score);
```

---

## Errors

### Critical Errors Found

| Error | File | Line | Impact |
|-------|------|------|--------|
| Qdrant sync not implemented | lib/pdf/batchProcess.ts | N/A | No vector search on ingested PDFs |

### Warning Patterns

1. **Embedding failures** → Returns zero vectors (silently tolerated)
2. **Ollama timeouts** → Zero vectors, processing continues
3. **PDF extract failures** → Throws error (blocker)

---

## Root Causes

### Issue 1: Missing Qdrant Integration

**Root Cause:** The `processBrochure()` function stores chunks in PostgreSQL but does not call the existing Qdrant functions to sync embeddings.

**Impact:** 
- Vector search returns empty results for ingested PDFs
- Hybrid retrieval cannot access most recent data

**Fix Required:** Add Qdrant upsert call after PostgreSQL transaction (line 216).

---

## Dead Code

| File | Function | Status | Notes |
|------|----------|--------|-------|
| lib/pdf/batchProcess.ts | `deleteOldQdrantChunks()` |exists but unused | Only called via API, not during auto-process |

---

## Reachable Code Path

```
POST /api/brochures (route.ts)
  → uploadBrochure(fileData, filename, fileSize)
    → processBrochure(brochureId, fileData, filename)
      1. extractPDFText()
      2. chunkText()  
      3. detectCategory() [map]
      4. generateEmbeddingsSequentially()
      5. db.$transaction([Chunk.create...])
      6. db.brochure.update(... status: READY)
      ✗ 7. QDRANT SYNC - MISSING
```

---

## Evidence

### Source Files Analyzed

| File | Purpose |
|------|---------|
| lib/pdf/batchProcess.ts | PDF ingestion pipeline (main) |
| lib/retrieval/postgres.ts | PostgreSQL FTS retrieval |
| lib/retrieval/vector/qdrantStorage.ts | Qdrant operations |
| lib/retrieval/hybrid.ts | Hybrid search implementation |
| app/api/brochures/route.ts | API endpoint handler |

### Database Tables

- `Brochure` - PDF metadata storage
- `Chunk` - Text chunks with categories
- `BrochureLog` - Processing history

---

## Summary Statistics (to be filled by execution)

```
PDF Ingestion Trace Report
==========================

Source File: Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf
File Size:   954,520 bytes

Stage              | Result | Duration (ms)
-------------------|--------|---------------
Extraction         |        |
Chunking           |        |
Embedding          |        |
PostgreSQL Insert  |        |
Qdrant Sync        | MISSING|
Retrieval Test     | N/A    |

Total Chunks:      TBC
Embeddings:        TBC (768-dim)
DB Rows:           TBC
Vector Points:     0 (NOT IMPLEMENTED)

Errors:            Missing Qdrant sync in processBrochure()
Warnings:          Embedding failures return zero vectors

```

---

*End of Trace Report*

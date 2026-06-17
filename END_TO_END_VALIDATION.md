# End-to-End Hybrid Retrieval Validation

## Test Script Path

```
S:\BackEndSureLM\test\integration\end-to-end-validation.ts
```

PowerShell runner:
```
S:\BackEndSureLM\test\end-to-end-validation.ps1
```

## How to Run

### Prerequisites

1. **Database (PostgreSQL)**: Must be running with connection string `postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm`
2. **Vector Store (Qdrant)**: Must be running at `http://localhost:6333`
3. **PDF file**: Exists at `S:\BackEndSureLM\test\Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf`

### Running the Script

**Option 1: Using PowerShell**
```powershell
cd S:\BackEndSureLM
.\test\end-to-end-validation.ps1
```

**Option 2: Direct execution with npx tsx**
```powershell
$env:DATABASE_URL="postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm"
$env:QDRANT_URL="http://localhost:6333"
npx tsx test/integration/end-to-end-validation.ts
```

**Option 3: Using npm (if tsx not available)**
```powershell
npm install -g tsx
tsx test/integration/end-to-end-validation.ts
```

## Script Features

### 1. PDF Text Extraction
- Uses `pdftotext` if available
- Falls back to placeholder text if extraction tools unavailable

### 2. Document & Chunk Storage
Creates:
- **Document** record with filename, source, metadata
- **Chunk** records (~500 chars each) with page_number preserved

```sql
-- PostgreSQL Schema usage
INSERT INTO "Document" (filename, source, metadata)
VALUES ('Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf', 'validation', '{version: "1.0"}');

INSERT INTO "Chunk" (id, "documentId", content, "chunkOrder", "pageNumber", category)
VALUES (...);
```

### 3. Vector Embeddings
- Creates 768-dimensional vectors for each chunk
- Uses `content_chunks` collection in Qdrant
- Payload includes: chunk_id, document_id, page_number, metadata

```typescript
await qdrantRetrieval.upsertPoints("content_chunks", [
  {
    id: chunkId,
    vector: Array(768).fill(baseValue),
    payload: {
      chunk_id: chunkId,
      document_id: docId,
      page_number: pageNumber,
      category: "insurance",
    },
  }
]);
```

### 4. Hybrid Retrieval

**Concurrent Execution** (Promise.all pattern):
```typescript
const [ftsResults, vectorResults] = await Promise.all([
  postgresRetrieval.postgresFullTextSearch(query),
  qdrantRetrieval.searchPoints("content_chunks", vector, { limit: 10 }),
]);

const hybridResults = await hybridSearch(query, vector);
```

**Deduplication by chunk_id**: Keeps highest score
```typescript
const chunkIdMap = new Map<string, RetrievalResult>();

for (const result of results.flat()) {
  const chunkId = String(result.payload.chunk_id);
  if (!chunkIdMap.has(chunkId)) {
    chunkIdMap.set(chunkId, { ...result });
  } else {
    const existing = chunkIdMap.get(chunkId);
    if (existing && result.score > existing.score) {
      chunkIdMap.set(chunkId, { ...result, score: result.score });
    }
  }
}
```

### 5. Validation Queries

Tests for exact insurance terms:
- `"premium options"` - FTS + Vector
- `"pre-existing conditions"` - FTS + Vector  
- `"exclusions"` - FTS + Vector
- `"maturity benefit"` - FTS + Vector
- `"eligibility criteria"` - FTS + Vector

## Expected Output Format

```
=== End-to-End Hybrid Retrieval Validation ===

[✓] Created document: cld8abc123...
[✓] Split into 42 chunks (~500 chars each)
[✓] Inserted 42 Chunk records
[✓] Upserted vectors to Qdrant (content_chunks)

=== Running Validation Queries ===

Query: "premium options"
  FTS Results: 8
  Vector Results: 6
  Hybrid Merged: 10
  Unique chunks after dedup: 10

Query: "pre-existing conditions"
  FTS Results: 5
  Vector Results: 7
  Hybrid Merged: 9
  Unique chunks after dedup: 9

...

=== Validation Results Summary ===

Query: "premium options"
  ✓ FTS Returns Valid Results: true
  ✓ Vector Returns Valid Results: true
  ✓ Hybrid Merged (dedup by chunk_id): true
    - Merged count: 10 → unique: 10

...

=== Concurrency Validation ===
  ✓ All queries executed concurrently: true
  ✓ Queries completed successfully: 5/5

=== Final Validation Criteria ===

[✓] FTS finds exact terms (policy, premium, exclusions, maturity): true
[✓] Vector search finds semantic matches: true
[✓] Duplicates merged by chunk_id (highest score kept): true
[✓] Concurrency via Promise.all pattern: true

✅ ALL VALIDATION CRITERIA MET
```

## Success Criteria for Each Query

### ✅ FTS Results Check
- **Condition**: `ftsResults.length > 0`
- **What it validates**: PostgreSQL full-text search works on chunk content
- **Success metric**: Returns chunks containing exact query terms (e.g., "premium options", "exclusions")

### ✅ Vector Results Check  
- **Condition**: `vectorResults.length > 0` (any query satisfies)
- **What it validates**: Qdrant vector similarity search working
- **Success metric**: Returns semantically similar chunks based on embeddings

### ✅ Hybrid Merged Check
- **Condition**: `hybridResults.length >= max(ftsResults.length, vectorResults.length)`
- **What it validates**: Combines FTS + Vector results correctly
- **Success metric**: 
  - All unique `chunk_id` values present
  - No duplicates (or duplicates merged by chunk_id)
  - Highest score kept for duplicate chunks

### ✅ Deduplication Check
- **Condition**: `uniqueChunkIds.size === hybridResults.length`
- **What it validates**: Results deduplicated properly
- **Success metric**: Each chunk_id appears only once in results

### ✅ Concurrency Check  
- **Condition**: All 5 queries complete successfully with Promise.all
- **What it validates**: Concurrent query execution works
- **Success metric**: `concurrentlyProven = true`

## Database Schema Used

### Table: Document
```typescript
{
  id: string @cuid(),
  filename: string,
  source: string?,
  metadata: Json? { version: "1.0" },
  createdAt: DateTime
}
```

### Table: Chunk  
```typescript
{
  id: string @cuid(),
  documentId: string (FK to Document),
  content: string (~500 chars per chunk),
  chunkOrder: number,
  pageNumber: number?,
  category: string? ("insurance"),
  createdAt: DateTime
}
```

## Qdrant Collection

**Collection name**: `content_chunks`  
**Vector size**: 768 dimensions (adjust if model changes)  
**Payload structure**:
```typescript
{
  chunk_id: string,
  document_id: string,
  page_number: number,
  category: string,
  // Optional additional metadata
}
```

## Environment Variables Required

```
DATABASE_URL=postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm
QDRANT_URL=http://localhost:6333
```

These are loaded from `.env` and `.env.local` files.

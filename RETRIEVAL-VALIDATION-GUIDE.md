# End-to-End Retrieval Validation Guide

## Current Status: ❌ Services Not Available

Docker Desktop is not running. The following services are required but unavailable:

| Service | Port | Required For |
|---------|------|--------------|
| PostgreSQL | 5432 | Chunk storage, FTS index |
| Qdrant | 6333 | Vector embeddings storage & search |
| Ollama | 11434 | Embedding generation (nomic-embed-text) |

---

## Before Running Validation

### Step 1: Start Docker Desktop
1. Open "Docker Desktop" application from Start Menu
2. Wait for "Docker is running" status
3. This may take 30-60 seconds

### Step 2: Start Infrastructure Services
```bash
cd S:\BackEndSureLM
docker compose up -d
```

Expected output:
```
[+] Running 2/2
✔ Container surelm-postgres Started
✔ Container surelm-qdrant Started
```

### Step 3: Verify Service Availability
```bash
# Test PostgreSQL (should return version info)
curl http://localhost:5432

# Test Qdrant (should return API info)  
curl http://localhost:6333/collections

# Test Ollama (should list models including nomic-embed-text)
curl http://localhost:11434/api/tags
```

### Step 4: Run Prisma Migrations
```bash
npx prisma generate
npx prisma migrate deploy
```

---

## Running Validation

```bash
# Start dev server (optional, for testing retrieval via API)
npm run dev &
```

```bash
# Run full validation script
npx tsx test/validation/full-retrieval-validation.ts
```

Expected output:
```
================================================================================
END-TO-END RETRIEVAL VALIDATION
PDF → Chunks → Embeddings → PostgreSQL → Qdrant → Retrieval
================================================================================

✅ All services available

PDF Size: 2,345.67 KB

Step 1: Extracting text from PDF...
--------------------------------------------------------------------------------
  Page 1/15
  Page 2/15
  ...
  Page 15/15

Extracted 45,678 characters from PDF


Step 2: Chunking text...
--------------------------------------------------------------------------------
  Created 92 chunks


Step 3: Storing chunks in PostgreSQL...
--------------------------------------------------------------------------------
  Document ID: clxxxxx00001
  Stored 92/92 chunks

✓ Chunks stored successfully


Step 4: Generating and storing embeddings...
--------------------------------------------------------------------------------

Generating embeddings for 92 chunks...

✓ Generated 92 embeddings

Qdrant collection: content_chunks (dimension: 768)

✓ Stored 92 vectors in Qdrant


Step 5: Verifying PostgreSQL FTS...
--------------------------------------------------------------------------------
✓ PostgreSQL FTS working (test query returned 3 results)


Step 6: Getting Qdrant collection stats...
--------------------------------------------------------------------------------

✓ Collection Stats:
  Document count: 1
  Chunk count: 92
  Embedding count: 92
  Vector count: 92
  Qdrant collection name: content_chunks
  Qdrant vector dimension: 768


================================================================================
RETRIEVAL VALIDATION TESTS
================================================================================

--------------------------------------------------------------------------------
Query: "What is the minimum entry age?"
--------------------------------------------------------------------------------

Query embedding dimension: 768

PostgreSQL FTS Results:
----------------------
  Score: 0.4523, Chunk ID: clxxxxx001
  Snippet: TheminimumentryageforLifePremierPlanis21years...
  
  Score: 0.3215, Chunk ID: clxxxxx002
  Snippet: ...entry age minimum requirement of 21 years...

Vector Search Results:
---------------------
  Score: 0.8945, Chunk ID: clxxxxx001
  
Hybrid Retrieval Results:
------------------------
  Source: qdrant, Score: 0.8945, ID: clxxxxx001

--------------------------------------------------------------------------------
Query: "What is the premium payment term?"
--------------------------------------------------------------------------------
... (similar output)

--------------------------------------------------------------------------------
Query: "What are the benefits available under the plan?"
--------------------------------------------------------------------------------
... (similar output)


================================================================================
FINAL RESULTS
================================================================================
✓ PASS: PDF extraction
✓ PASS: Chunking
✓ PASS: PostgreSQL storage  
✓ PASS: Embedding generation
✓ PASS: Qdrant storage
✓ PASS: PostgreSQL FTS

✓ ALL STAGES PASSED
✓ PDF → Chunks → Embeddings → PostgreSQL → Qdrant → Retrieval

END-TO-END RETRIEVAL VALIDATION: PASS
```

---

## Report Output

**Location:** `S:\BackEndSureLM\test\validation\retrieval-validation-report.md`

**Contents:**
1. Service availability check results
2. PDF source file details
3. Stage-by-stage PASSED/FAILED status
4. Query tests with embeddings, FTS results, vector search, hybrid results
5. Validation statistics (document count, chunk count, embedding count, etc.)

---

## Key Files

| File | Purpose |
|------|---------|
| `test/validation/full-retrieval-validation.ts` | Main validation script |
| `lib/ai/embeddings.ts` | Ollama nomic-embed-text integration |
| `lib/retrieval/postgres.ts` | PostgreSQL FTS retrieval |
| `lib/qdrant.ts` | Qdrant vector search |
| `lib/retrieval/vector/index.ts` | Vector operations wrapper |
| `test/Kotak_Premier_Life_Plan_-_Brochure_-_18th_June_2020.pdf` | Test PDF |

---

## Troubleshooting

### "Ollama not available"
- Start Docker Desktop
- Run `docker pull nomicai/nomic-embed-text:latest`
- Ollama auto-downloads models on first use

### "PostgreSQL not available"  
- Run `docker compose up -d postgres`
- Verify port 5432 is open: `netstat -an | find :5432`

### "Qdrant not available"
- Run `docker compose up -d qdrant`
- Verify port 6333 is open: `netstat -an | find :6333`

### "Cannot reach database server"
- Wait 10 seconds after docker compose start
- Check connection string in `.env.local`: `DATABASE_URL=postgresql://admin:localpg2024@localhost:5432/surelm`

---

**Note:** Run validation only AFTER all services are confirmed running.

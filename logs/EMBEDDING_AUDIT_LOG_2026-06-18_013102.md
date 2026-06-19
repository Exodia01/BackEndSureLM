# EMBEDDING AUDIT LOG

**Generated**: 2026-06-18 01:31:02  
**Auditor**: Hostile Reviewer  
**Scope**: Embedding Implementation Audit (Ollama vs Xenova)

---

## EXECUTIVE SUMMARY

**STATUS**: 🔴 **CRITICAL BLOCKERS IDENTIFIED**

The codebase contains:
- ✅ Working Ollama embedding API (`lib/ai/embeddings.ts`)
- ❌ Dead Xenova/transformers code in test scripts
- ❌ Query→embedding generation MISSING in retrieval flow
- ⚠️ Collection name inconsistency (policies vs content_chunks)
- ❌ No dimension validation at storage time

---

## EMBEDDING IMPLEMENTATION ANALYSIS

### 1. Production embedding API: `/lib/ai/embeddings.ts` ✅

```typescript
// S:\BackEndSureLM\lib\ai\embeddings.ts (52 lines)

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const EMBEDDING_MODEL = "nomic-embed-text";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });
  
  if (!response.ok) throw new Error(`Ollama embedding failed`);
  return await response.json();
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const batchResults = await Promise.all(batch.map(generateEmbedding));
    embeddings.push(...batchResults);
  }
  return embeddings;
}
```

**Status**: Fully functional, uses Ollama `/api/embeddings` endpoint  
**Model**: `nomic-embed-text` (768 dimensions by default in Ollama)

---

### 2. Test Script: Xenova Code Still Present ❌

```typescript
// S:\BackEndSureLM\test\validation\pipeline.ts:91-119

async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
  const { pipeline, env } = await import('@xenova/transformers');
  // ❌ Still imports Xenova transformer
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  
  const embeddingsFlat = result.data.toString().split(',').map(Number);
  const embedDim = embeddingsFlat.length / batchSize;
  // BUG: Line 112 uses undefined variable `embed_dim` (should be `embedDim`)
}
```

**Issues Found**:
- ❌ Imports `@xenova/transformers` (not needed, Ollama is source of truth)
- ❌ Uses wrong model (`all-MiniLM-L6-v2` → 384 dims vs `nomic-embed-text` → 768 dims)
- ✅ Has batch processing logic
- ❌ Bug: uses `embed_dim` but variable named `embedDim` (line 112)

**File**: `test/validation/pipeline.ts`  
**Lines**: 91-119 (generateEmbeddings function)  
**Status**: DEAD CODE (not used in production)

---

### 3. Fake Vectors in Integration Tests ❌

```typescript
// S:\BackEndSureLM\test\integration\end-to-end-validation.ts:15

const BASE_VECTOR = Array(768).fill(0.1);  // Synthetic vector!
```

**Issue**: No real embedding generation, just placeholder values  
**Impact**: Tests don't validate actual embedding pipeline

---

## EMBEDDING CALL PATHS

### A. Ingestion Embedding Call Path (MISSING IN PRODUCTION)

**Currently:**
- Test script: `test/validation/pipeline.ts:256` calls Xenova
- Production: **NO ingestion endpoint exists**

**Required Flow (PRODUCTION):**
```
User Upload PDF → /api/ingest (NOT FOUND) 
  → Extract text 
  → Split into chunks 
  → Generate embeddings via lib/ai/embeddings.ts 
  → Store in PostgreSQL + Qdrant
```

**Gap**: No `/api/ingest` endpoint - ingestion only exists as test script

---

### B. Query Embedding Call Path (MISSING)

```typescript
// S:\BackEndSureLM\lib\retrieval\hybrid.ts:5-13

export async function hybridSearch(
  query: string,           // ← String input
  queryVector: number[],   // ← ASSUMES vector provided externally
  sessionId?: string
): Promise<RetrievalResult[]> {
  const results = await Promise.all([
    postgresFullTextSearch(query),              // ✅ Generates FTS results
    qdrantVectorSearch(queryVector)            // ❌ Uses vector but doesn't generate it
  ]);
}
```

**Problem**: 
- `queryVector` parameter is required
- Function does NOT call `generateEmbedding(query)` to convert text→vector
- Callers must pre-generate embeddings elsewhere

**Impact**: If caller forgets to generate embedding, retrieval fails with wrong vector

---

### C. Where Query Embeddings SHOULD Be Generated

**Option A (RECOMMENDED - ADD TO RETRIEVAL):**
```typescript
// lib/retrieval/hybrid.ts (PROPOSED FIX)

import { generateEmbedding } from "../ai/embeddings";

export async function hybridSearch(
  query: string,
  queryVector?: number[],  // ← Make optional
  sessionId?: string
): Promise<RetrievalResult[]> {
  const vector = queryVector ?? await generateEmbedding(query);  // Generate if not provided
  
  const results = await Promise.all([
    postgresFullTextSearch(query),
    qdrantVectorSearch(vector)
  ]);
  
  // ... rest of logic
}
```

**Benefits**:
- Callers can pass pre-computed vectors (optional)
- Automatically generates embedding from query text
- Single source of truth for query→embedding conversion

---

## QDRANT COLLECTION ANALYSIS

### Collection Names Used Across Codebase

| File | Collection Name | Line |
|------|-----------------|------|
| `.env.local` | `policies` | 12 (QDRANT_COLLECTION) |
| `lib/retrieval/vector/index.ts` | `content_chunks` | 8 (default) |
| `test/validation/pipeline.ts` | `content_chunks` | 124 |
| `test/integration/end-to-end-validation.ts` | `content_chunks` | 74 |

**Problem**: **Inconsistent collection naming**
- `.env.local` specifies `policies`
- Default in retrieval code is `content_chunks`

---

### Vector Dimension Validation: MISSING

```typescript
// lib/retrieval/vector/qdrantStorage.ts:20-36

export async function ensureCollection(
  name: string,
  vectorSize: number  // ← Received as parameter but never validated against actual vectors
): Promise<void> {
  const response = await fetch(`${QDRANT_URL}/collections`, { method: 'GET' });
  const collectionsData = await response.json();
  
  if (!collectionsData.collections?.some(c => c.name === name)) {
    await createCollection(name, vectorSize);  // No validation that vectors match
  }
}
```

**Issue**: 
- Collection created with `vectorSize` parameter
- No check that actual insertion vectors have same dimension
- If caller passes wrong-size vector, Qdrant API returns error (catch happens elsewhere)

---

## ACTIVE Xenova/transformers Usage Audit

### Search Result: **ZER0 PRODUCTION FILES USE XENOVA**

```bash
# production code only:
grep -r "xenova|transformer" --include="*.ts" lib/ app/

Result: 0 matches (case-insensitive)
```

**BUT** test scripts still reference Xenova:
- `test/validation/pipeline.ts` (lines 91-119, 219)
- `lib/retrieval/vector/index.ts` has comments mentioning transformers

---

## DIMENSION MISMATCH MATRIX

| Model | Expected Dim | Source File | Issue |
|-------|--------------|-------------|-------|
| `nomic-embed-text` (Ollama) | 768 | `lib/ai/embeddings.ts:6` ✅ Production standard |
| `all-MiniLM-L6-v2` (Xenova) | 384 | `test/validation/pipeline.ts:98` ❌ Test script only |

**Risk**: If Xenova code accidentally used in production, vectors will be wrong dimension (384 vs 768)

---

## RECOMMENDED FIXES (PRIORITY ORDER)

### Blocker 1: Remove Xenova References
- Delete `test/validation/pipeline.ts` lines 91-119 OR
- Replace Xenova calls with Ollama embeddings

### Blocker 2: Add Query→Embedding Generation to Retrieval
- Modify `hybridSearch()` to accept optional vector parameter
- Auto-generate from text if not provided
- Call `/lib/ai/embeddings.ts` for conversion

### Blocker 3: Standardize Collection Name
- Choose ONE: `content_chunks` (used in retrieval APIs) OR `policies` (from `.env`)
- Update ALL references consistently

### Blocker 4: Add Dimension Validation
- In `upsertPoints()`, assert vector.length matches collection definition
- Throw clear error if mismatch detected

---

## EVIDENCE FILE LOCATIONS

| File | Key Functions |
|------|---------------|
| `lib/ai/embeddings.ts` | Single production embedding source ✅ |
| `test/validation/pipeline.ts:91-119` | Dead Xenova code ❌ |
| `test/integration/end-to-end-validation.ts:15` | Fake vectors ❌ |
| `lib/retrieval/hybrid.ts:5-13` | Missing query→embedding ❌ |
| `.env.local:12` | Collection name config ⚠️ |

---

**END OF EMBEDDING AUDIT**

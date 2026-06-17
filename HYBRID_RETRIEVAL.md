# Hybrid Retrieval System

This document describes the hybrid retrieval architecture implemented in SureLM.

## Architecture Overview

```
User Query
    ↓
Promise.all([
  postgresFullTextSearch(),   # Lexical search (PostgreSQL FTS)
  semanticSearch(vector),      # Vector search (Qdrant)
  userHistoryLookup(agentId)   # User history lookup (PostgreSQL)
])
    ↓
Hybrid Reranker
    ↓
Compliance Filter
    ↓
LLM
```

## Components

### 1. PostgreSQL Full-Text Search (FTS)

**Use Case:** Lexical/exact matching for:
- Exact product names
- Riders
- Waiting periods
- Exclusions

**Implementation:**
- FTS index on `BrochureChunk.content`
- Additional FTS index on JSONB metadata fields

### 2. Qdrant Vector Search

**Use Case:** Semantic matching for:
- Natural language queries
- Cross-terminology semantic matching
- Brochure RAG retrieval

**Features:**
- Cosine similarity search
- Payload filtering support
- Concurrent execution with FTS

### 3. User History Lookup

**Use Case:** Context-aware recommendations based on agent's past policy issuances.

## API Reference

### `postgresFullTextSearch(query, limit)`

Performs full-text search on brochure chunks.

```typescript
const results = await postgresFullTextSearch("term life insurance", 10);
```

Returns: `RetrievalResult[]`

### `semanticSearch(vector, filter?)`

Queries Qdrant for semantic similarity.

```typescript
import { semanticSearch } from "../qdrant";

const vector = [0.12, -0.34, ...]; // Embedding array
const results = await semanticSearch(vector, {
  must: [{ key: "policy_id", match: { value: "some-id" } }]
});
```

Returns: `{ id: string; score: number; payload: Record<string, unknown> }[]`

### `userHistoryLookup(agentId, limit)`

Retrieves agent's past policy issuances.

```typescript
const history = await userHistoryLookup("agent-123", 5);
```

Returns: `RetrievalResult[]`

### `hybridRetrieve(query, agentId?, vector?, filter?)`

Executes all retrieval methods concurrently and combines results.

```typescript
import { hybridRetrieve } from "../ai/hybridRetrieval";

const results = await hybridRetrieve(
  "best life insurance for farmers",
  "agent-123",
  [0.1, -0.2, 0.3], // Optional: vector embedding
  { must: [...] }    // Optional: Qdrant filter
);
```

Returns: `RetrievalResult[]`

### `searchPolicies(query, vector, filter?)`

Concurrent FTS + semantic search for policy retrieval.

```typescript
const results = await searchPolicies(
  "crop insurance",
  [0.15, 0.25],
  { must: [{ key: "type", match: { value: "agriculture" } }] }
);
```

Returns: `RetrievalResult[]`

### `scoreToRelevance(score)`

Converts numeric score to relevance category.

```typescript
const relevance = scoreToRelevance(0.85); // "high"
```

## Types

### RetrievalResult

```typescript
interface RetrievalResult {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}
```

### RerankResult

Extends `RetrievalResult` with reranking fields:

```typescript
interface RerankResult extends RetrievalResult {
  rerankedScore?: number;
  relevance?: "high" | "medium" | "low";
}
```

## Database Schema

### BrochureChunk

```prisma
model BrochureChunk {
  id           String   @id @default(cuid())
  policyId     String
  policy       PolicyIssuance  @relation(fields: [policyId], references: [id], onDelete: Cascade)
  content      Text
  chunkIndex   Int
  metadata     Json?
  createdAt    DateTime @default(now())

  @@index([policyId, chunkIndex])
  @@index([content], type: FullText)
}
```

## Setup

### 1. Run Migrations

```bash
npx prisma migrate dev --name add_brochure_chunks_fts
npx prisma generate
```

### 2. Create Qdrant Collection (optional, auto-created on first use)

```typescript
import { createPolicyCollection } from "../qdrant";

await createPolicyCollection(EMBEDDING_DIMENSION);
```

### 3. Index Policy Brochures

Upsert brochure chunks to both PostgreSQL and Qdrant:

```typescript
import { upsert } from "../qdrant";
import { db } from "../db";

// Upsert to Qdrant
await upsert("policies", [
  {
    id: `chunk-${chunkIndex}`,
    vector: embedding, // Embedding from AI layer
    payload: {
      content: chunk.content,
      policy_id: policyId,
      chunk_index: chunkIndex,
      source: "brochure"
    }
  }
]);
```

## Concurrent Execution

All retrieval methods execute concurrently using `Promise.all()`:

```typescript
const [ftsResults, vectorResults, history] = await Promise.all([
  postgresFullTextSearch(query),
  semanticSearch(vector, filter),
  agentId ? userHistoryLookup(agentId) : Promise.resolve([])
]);
```

## Reranking Interface

The unified `RetrievalResult` interface allows rerankers to process all results regardless of source.

```typescript
interface HybridReranker {
  rerank(results: RetrievalResult[]): RerankResult[];
}
```

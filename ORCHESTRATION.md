# SureLM Orchestration System

## Overview

The orchestration system coordinates multiple AI agents to process queries, manage workflows, and execute complex multi-step operations.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  AgentOrchestrator                          │
│              (Main coordination layer)                      │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
   │Retriever│  │Reranker│  │  LLM   │
   │  Agent  │  │  Agent │  │  Agent │
    └────┬───┘  └────┬───┘  └────┬───┘
         │           │          │
      FTS       RRFS/Emb    Ollama
      Vector              Streaming
```

## Agent System

### Types (`lib/ai/agents/types.ts`)

```typescript
interface ContextResult {
  id: string;
  content: string;
  score: number;
  source: "postgres_fts" | "qdrant" | "user_history";
  metadata?: Record<string, unknown>;
}

interface OrchestratorResponse {
  content: string;
  context: Array<{ id: string; content: string; score: number }>;
  toolsUsed: string[];
}
```

### Agent Implementations

#### Retriever Agent (`lib/ai/agents/retriever.ts`)
Coordinates multiple retrieval sources:

- **PostgreSQL FTS**: Full-text search on chunks
- **Qdrant Vector Search**: Semantic similarity search
- **User History**: Previous policy recommendations

```typescript
const results = await hybridRetrieve(query, vector, sessionId);
```

#### Reranker Agent (`lib/ai/agents/reranker.ts`)
Re-ranks retrieved results using:

1. **Semantic Re-ranking** (primary): Ollama embeddings for deep semantic matching
2. **RRFS Fusion** (fallback): Reciprocal Rank Fusion when Ollama unavailable

```typescript
const { results, method } = await rerank(query, candidates);
```

#### LLM Agent (`lib/ai/agents/llm.ts`)
Generates responses with:

- **Primary Model**: qwen2.5-coder:1.5b (from env)
- **Fallback Model**: llama3:latest
- **Streaming Support**: ReadableStream for real-time responses

```typescript
const response = await generateLLMResponse([
  { role: "system", content },
  ...messages,
]);
```

## API Endpoints

### Query Orchestration (`/api/orchestrate/query`)

**Non-streaming:**
```bash
POST /api/orchestrate/query
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "What insurance for rural families?"},
    {"role": "assistant", "content": "..."}
  ],
  "sessionId": "session_123"
}
```

**Streaming:**
```bash
POST /api/orchestrate/query-stream
Content-Type: application/json

{
  "messages": [...],
  "stream": true
}
```

### Chat Integration (`/api/chat`)

Orchestrator integrated into existing chat endpoint:

```bash
# Non-streaming
POST /api/chat
{ "messages": [...] }

# Streaming  
POST /api/chat?stream=true
```

## Context Management

Workflow state is tracked in the database using Prisma models.

### Database Schema

```prisma
model OrchestrationLog {
  id               String   @id @default(cuid())
  workflowId       String   @unique
  type             "query" | "issuance" | "document"
  status           "pending" | "running" | "completed" | "failed"
  input            Json
  intermediateResults Json?
  finalOutput      Json?
  agentsExecuted   Json[]
  errors           Json[]?
}

model OrchestrationAgentLog {
  id          String   @id @default(cuid())
  workflowId  String
  agent       "retriever" | "reranker" | "llm"
  status      "pending" | "running" | "success" | "failed"
  input       Json?
  output      Json?
  latencyMs   Int?
}
```

## Usage Examples

### Basic Query

```typescript
import { orchestrateQuery } from "@/lib/orchestration";

const response = await orchestrateQuery({
  messages: [{ role: "user", content: "What is term insurance?" }],
});

console.log(response.content);
// Returns generated answer with context
```

### Streaming Response

```typescript
import { orchestrateQueryStreaming } from "@/lib/orchestration";

for await (const chunk of orchestrateQueryStreaming({
  messages: [{ role: "user", content: "Explain health insurance..." }],
})) {
  process.stdout.write(chunk);
}
```

### Custom Context

```typescript
// The orchestrator automatically:
// 1. Generates embeddings for the query
// 2. Retrieves from FTS + Vector DB
// 3. Reranks top results using RRFS
// 4. feeds context to LLM with system prompt
// 5. Returns structured response

const { content, context } = await orchestrateQuery({
  messages: [...],
});
```

## Workflow Types

### Query Processing (`query`)
Standard chat interface workflow:
1. Parse user message
2. Generate embedding
3. Hybrid retrieval (FTS + Vector + History)
4. Semantic reranking
5. LLM generation with context
6. Return response

### Policy Issuance (`issuance`) - TODO
Lead-to-policy automation:
1. Extract requirements from lead
2. Match with suitable policies
3. Generate recommendations
4. Create policy record

### Document Processing (`document`) - TODO
Brochure/PDF processing:
1. PDF extraction (pdfjs-dist)
2. Text chunking with overlap
3. Generate embeddings (Ollama)
4. Store in PostgreSQL + Qdrant

## Error Handling

All agents implement fallback strategies:

- **Retriever**: Returns empty results if search fails
- **Reranker**: Falls back to RRFS if Ollama unavailable
- **LLM**: Uses fallback model on primary failure

Example:
```typescript
try {
  const result = await orchestrator.runQueryWorkflow(input);
} catch (error) {
  // Orchestrator already attempted fallback
  console.error("All strategies failed:", error.message);
}
```

## Observability

Integration with tracing system (`lib/tracing/phoenix.ts`):

- Agent execution timing tracked
- Workflow state transitions logged
- Performance metrics measured

```typescript
// Automatically logs:
// - Retrieval latency: ~50ms
// - Reranking latency: ~120ms  
// - LLM generation latency: ~800ms
```

## Future Enhancements

- [ ] Policy Issuance workflow endpoint
- [ ] Document processing API endpoints
- [ ] Workflow state persistence and recovery
- [ ] Agent pool service for scaling
- [ ] Metrics dashboard (prometheus)
- [ ] Distributed tracing (OpenTelemetry)

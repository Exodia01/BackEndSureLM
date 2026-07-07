import { db } from "../../db";
import { semanticSearch, type SearchFilter } from "../../qdrant";

export interface ContextResult {
  id: string;
  content?: string;
  score: number;
  source: "postgres_fts" | "qdrant" | "user_history";
  metadata?: Record<string, unknown>;
  policyId?: string;
  policyName?: string;
  provider?: string;
  rank?: number;
}

export async function postgresFullTextSearch(
  query: string,
  limit: number = 10
): Promise<ContextResult[]> {
  const results = await db.$queryRaw`
    SELECT 
      c.id as chunk_id,
      c."documentId",
      c."chunkOrder",
      c.content,
      ts_rank(to_tsvector('english', coalesce(c.content, '')), plainto_tsquery('english', ${query})) as score
    FROM "Chunk" c
    WHERE to_tsvector('english', coalesce(c.content, '')) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((row: any) => ({
    id: String(row.chunk_id),
    score: Number(row.score) || 0,
    source: "postgres_fts" as const,
    content: row.content,
    metadata: {
      chunk_id: String(row.chunk_id),
      document_id: typeof row.documentid === 'string' ? row.documentid : undefined,
      chunk_order: (row.chunkorder as number) ?? undefined,
    },
  }));
}

export async function qdrantVectorSearch(
  vector: number[],
  filter?: SearchFilter,
  limit: number = 10
): Promise<ContextResult[]> {
  const results = await semanticSearch(vector, filter, "policies", limit);

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    source: "qdrant" as const,
    content: typeof r.payload.content === 'string' ? r.payload.content : undefined,
    policyName: typeof r.payload.policy_name === 'string' ? r.payload.policy_name : undefined,
    provider: typeof r.payload.provider === 'string' ? r.payload.provider : undefined,
    metadata: r.payload,
  }));
}

export async function userHistoryLookup(
  agentId: string,
  limit: number = 5
): Promise<ContextResult[]> {
  const results: any[] = await db.$queryRaw`
    SELECT 
      pi.id,
      pi."policyName",
      pi."policyProvider" as provider,
      1.0 as score
    FROM "PolicyIssuance" pi
    JOIN "PolicyLead" pl ON pi."leadId" = pl.id
    WHERE pl."agentId" = ${agentId}
    ORDER BY pi."createdAt" DESC
    LIMIT ${limit}
  `;

  return results.map((row: any) => ({
    id: String(row.id),
    source: "user_history" as const,
    score: Number(row.score) || 0,
    policyName: typeof row.policyname === 'string' ? row.policyname : undefined,
    provider: typeof row.provider === 'string' ? row.provider : undefined,
    metadata: row,
  }));
}

export async function hybridRetrieve(
  query: string,
  agentId?: string,
  vector: number[] = [],
  brochureIds?: string[]
): Promise<ContextResult[]> {
  const filter: SearchFilter | undefined =
    brochureIds && brochureIds.length > 0
      ? {
          should: brochureIds.map((brochureId) => ({
            key: "brochure_id",
            match: { value: brochureId },
          })),
        }
      : undefined;

  const results = await Promise.all([
    postgresFullTextSearch(query),
    vector.length > 0 ? qdrantVectorSearch(vector, filter) : Promise.resolve([]),
    agentId ? userHistoryLookup(agentId) : Promise.resolve([]),
  ]);

  return deduplicateResults(results.flat());
}

function deduplicateResults(results: ContextResult[]): ContextResult[] {
  const chunkIdMap = new Map<string, ContextResult>();

  for (const result of results) {
    const key = result.metadata?.chunk_id || String(result.id);
    if (!chunkIdMap.has(key)) {
      chunkIdMap.set(key, { ...result });
    } else {
      const existing = chunkIdMap.get(key);
      if (existing && result.score > existing.score) {
        chunkIdMap.set(key, { ...result, score: result.score });
      }
    }
  }

  return Array.from(chunkIdMap.values());
}

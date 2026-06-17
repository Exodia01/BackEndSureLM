import { db } from "../db";
import { semanticSearch, type SearchFilter } from "../qdrant";

export interface RetrievalResult {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
}

export async function postgresFullTextSearch(
  query: string,
  limit: number = 10
): Promise<RetrievalResult[]> {
  const results: any[] = await db.$queryRaw`
    SELECT 
      pi.id,
      pi."policyName",
      pi."policyProvider" as provider,
      ts_rank(
        to_tsvector('english', coalesce(pi."policyName", '') || ' ' || coalesce(pi."policyProvider", '')),
        plainto_tsquery('english', ${query})
      ) as score
    FROM "PolicyIssuance" pi
    WHERE 
      to_tsvector('english', coalesce(pi."policyName", '') || ' ' || coalesce(pi."policyProvider", '')) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  return results.map((row: any) => ({
    id: row.id,
    source: "postgres_fts" as const,
    score: row.score || 0,
    policyName: row.policyname,
    provider: row.provider,
  }));
}

export async function userHistoryLookup(
  agentId: string,
  limit: number = 5
): Promise<RetrievalResult[]> {
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
    id: row.id,
    source: "user_history" as const,
    score: row.score || 0,
    policyName: row.policyname,
    provider: row.provider,
  }));
}

export async function hybridRetrieve(
  query: string,
  agentId?: string,
  vector: number[] = [],
  filter?: SearchFilter
): Promise<RetrievalResult[]> {
  const results = await Promise.all([
    postgresFullTextSearch(query),
    semanticSearch(vector, filter).then((r) => r.map(row => ({
      id: String(row.id),
      source: "qdrant" as const,
      score: row.score,
      content: row.payload.content,
      policyName: row.payload.policy_name,
      provider: row.payload.provider,
      metadata: row.payload
    }))),
    agentId ? userHistoryLookup(agentId) : Promise.resolve([]),
  ]);

  return results.flat();
}

export async function searchPolicies(
  query: string,
  vector: number[],
  filter?: SearchFilter
): Promise<RetrievalResult[]> {
  const [ftsResults, vectorResults] = await Promise.all([
    postgresFullTextSearch(query),
    semanticSearch(vector, filter).then((r) => r.map(row => ({
      id: String(row.id),
      source: "qdrant" as const,
      score: row.score,
      content: row.payload.content,
      policyName: row.payload.policy_name,
      provider: row.payload.provider,
      metadata: row.payload
    }))),
  ]);

  return [...ftsResults, ...vectorResults];
}

export function scoreToRelevance(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
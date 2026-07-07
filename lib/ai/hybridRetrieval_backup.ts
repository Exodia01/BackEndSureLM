import { db } from "../db";
import { semanticSearch, type SearchFilter } from "../qdrant";
import { applyRRFS } from "./rerank/rrfs";
import { rerank } from "./rerank/reranker";

export { applyRRFS, type RerankResult } from "./rerank/rrfs";

export interface RetrievalResult {
  id: string;
  source: "postgres_fts" | "qdrant" | "user_history";
  score: number;
  content?: string;
  policyId?: string;
  policyName?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  
  // Optional fields for re-ranking
  rank?: number;
  rerankedScore?: number;
  relevanceRank?: number;
  relevance?: "high" | "medium" | "low";
  historyCount?: number;
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

export async function getHistoryCount(agentId: string, policyId: string): Promise<number> {
  try {
    const result: any[] = await db.$queryRaw`
      SELECT COUNT(*) as count
      FROM "PolicyIssuance" pi
      JOIN "PolicyLead" pl ON pi."leadId" = pl.id
      WHERE pl."agentId" = ${agentId}
        AND pi.id = ${policyId}
    `;
    
    return result[0]?.count || 0;
  } catch {
    return 0;
  }
}

export async function applyHistoryBoost(
  results: RetrievalResult[],
  agentId: string
): Promise<RetrievalResult[]> {
  // Moderate history bias: +0.15 max boost based on how many times each policy appears in history
  const MAX_BOOST = 0.15;
  const BOOST_PER_ISSUANCE = MAX_BOOST / 5; // Cap at 5 past issuances for calculation
  
  return await Promise.all(
    results.map(async (result) => {
      if (!agentId || !results.length) return result;
      
      // Calculate boost based on policy ID
      const count = await getHistoryCount(agentId, result.id);
      
      if (count > 0) {
        const boost = Math.min(count * BOOST_PER_ISSUANCE, MAX_BOOST);
        
        return {
          ...result,
          score: Math.min(result.score + boost, 1.0),
          historyCount: count,
        };
      }
      
      return result;
    })
  );
}

export async function hybridRetrieve(
  query: string,
  agentId?: string,
  vector: number[] = [],
  brochureIds?: string[]
): Promise<{ results: RetrievalResult[]; total: number }> {
  const filter: SearchFilter | undefined = brochureIds && brochureIds.length > 0 ? {
    should: brochureIds.map(brochureId => ({
      key: "brochure_id",
      match: { value: brochureId }
    }))
  } : undefined;
  
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

  // Flatten results from all sources
  const flatResults = results.flat();
  
  // Deduplicate by policy ID (from payload.policy_id or id), keep highest score
  const policyMap = new Map<string, RetrievalResult>();
  
  for (const result of flatResults) {
    // Use policyId if available, otherwise use id
    const policyId = result.policyId || result.id;
    
    if (!policyMap.has(policyId)) {
      policyMap.set(policyId, { ...result });
    } else {
      // Keep the version with higher score
      const existing = policyMap.get(policyId);
      if (existing && result.score > existing.score) {
        policyMap.set(policyId, { ...result, score: result.score });
      }
    }
  }
  
  // Convert to array and apply RRFS re-ranking
  let uniqueResults = Array.from(policyMap.values());
  
  // Apply history boost if agentId provided
  if (agentId && uniqueResults.length > 0) {
    uniqueResults = await applyHistoryBoost(uniqueResults, agentId);
    
    // Re-rank after applying history boost
    const reranked = applyRRFS(uniqueResults);
    
    return {
      results: reranked,
      total: reranked.length,
    };
  }
  
  // No history boost, just RRFS re-ranking
  const rrfsResults = applyRRFS(uniqueResults);
  
  if (rrfsResults.length > 0) {
    const topCandidates = rrfsResults.slice(0, 30);
    const rerankedResults = await rerank(query, topCandidates, 5);
    
    return {
      results: rerankedResults,
      total: rerankedResults.length,
    };
  }
  
  return {
    results: rrfsResults,
    total: rrfsResults.length,
  };
}

export async function searchPolicies(
  query: string,
  vector: number[],
  filter?: SearchFilter
): Promise<{ results: RetrievalResult[]; total: number }> {
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

  // Combine results, apply RRFS, then rerank top candidates
  const allResults = [...ftsResults, ...vectorResults];
  
  if (allResults.length > 0) {
    const rrfsResults = applyRRFS(allResults);
    const topCandidates = rrfsResults.slice(0, 30);
    const rerankedResults = await rerank(query, topCandidates, 5);
    
    return {
      results: rerankedResults,
      total: rerankedResults.length,
    };
  }
  
  return {
    results: allResults,
    total: allResults.length,
  };
}

export function scoreToRelevance(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

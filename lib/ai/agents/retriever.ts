import { db } from "../../db";
import { semanticSearch, POLICY_KNOWLEDGE_COLLECTION, type SearchFilter } from "../../qdrant";

export interface ContextResult {
  id: string;
  content: string;
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
  const results = await semanticSearch(vector, filter, POLICY_KNOWLEDGE_COLLECTION, limit);

  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    source: "qdrant" as const,
    content: (typeof r.payload.content === 'string' ? r.payload.content : ""),
    policyName: (typeof r.payload.policy_name === 'string' ? r.payload.policy_name : ""),
    provider: (typeof r.payload.provider === 'string' ? r.payload.provider : ""),
    metadata: r.payload,
  }));
}

export interface PolicyRetrievalOptions {
  /** Restrict retrieval to these policy IDs only. */
  policyIds?: string[];
  /**
   * Only include policies that are active AND have a current published
   * version. `Policy.currentVersionId` is set exclusively by
   * publishPolicyVersion(), which refuses to publish without approved
   * requirements and snapshots them, so a non-null currentVersionId is the
   * domain-grounded definition of "approved policy knowledge".
   */
  onlyApproved?: boolean;
  /** Alias of onlyApproved for readability at call sites. */
  onlyCurrentVersion?: boolean;
  /** Maximum number of results to return. */
  limit?: number;
}

/**
 * Policies that are safe to recommend, grounded in the domain model:
 *   isActive = true AND currentVersionId != null.
 * currentVersionId is only ever set inside publishPolicyVersion(), which
 * requires at least one approved (isDraft=false) requirement and creates an
 * immutable RequirementSnapshot at publish time. Hence a policy with a current
 * version always has approved, published, snapshotted requirement knowledge.
 */
export async function getRecommendablePolicies() {
  return db.policy.findMany({
    where: {
      isActive: true,
      currentVersionId: { not: null },
    },
    include: {
      brochures: { select: { brochureId: true } },
      currentVersion: {
        select: { id: true, versionNum: true, label: true, publishedAt: true },
      },
    },
  });
}

/** Resolve just the IDs of recommendable policies (reused by recommendation). */
export async function resolveRecommendablePolicyIds(): Promise<string[]> {
  const policies = await getRecommendablePolicies();
  return policies.map((p) => p.id);
}

/**
 * Policy-aware retrieval from the Qdrant `policy_knowledge` collection.
 *
 * Pipeline: query → qdrant → chunk → brochure → policy → policy version.
 * Provenance is enriched via the existing brochure_id → PolicyBrochure → Policy
 * relationship; Qdrant itself is NOT rebuilt.
 *
 * Returns deterministic, deduplicated results with standardized provenance in
 * `metadata`. Returns [] on empty results or when a vector is unavailable.
 */
export async function retrievePoliciesWithContext(
  query: string,
  vector: number[],
  options: PolicyRetrievalOptions = {}
): Promise<ContextResult[]> {
  const limit = options.limit ?? 10;
  const restrictToApproved =
    options.onlyApproved ?? options.onlyCurrentVersion ?? false;

  if (vector.length === 0) {
    return [];
  }

  let policyIds = options.policyIds;

  if (restrictToApproved) {
    const approvedIds = await resolveRecommendablePolicyIds();
    policyIds = policyIds
      ? policyIds.filter((id) => approvedIds.includes(id))
      : approvedIds;
  }

  let brochureIds: string[] | undefined;
  if (policyIds && policyIds.length > 0) {
    const links = await db.policyBrochure.findMany({
      where: { policyId: { in: policyIds } },
      select: { brochureId: true },
    });
    brochureIds = [...new Set(links.map((l) => l.brochureId))];
  }

  const filter: SearchFilter | undefined =
    brochureIds && brochureIds.length > 0
      ? {
          should: brochureIds.map((brochureId) => ({
            key: "brochure_id",
            match: { value: brochureId },
          })),
        }
      : undefined;

  const results = await qdrantVectorSearch(vector, filter, limit);
  return enrichWithPolicyProvenance(results, query);
}

/**
 * Enrich raw Qdrant results with brochure + policy + version provenance using
 * the Postgres PolicyBrochure join, then deduplicate deterministically.
 */
async function enrichWithPolicyProvenance(
  results: ContextResult[],
  query: string
): Promise<ContextResult[]> {
  if (results.length === 0) return [];

  const brochureIds = [
    ...new Set(
      results
        .map((r) => (r.metadata as any)?.brochure_id as string | undefined)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  const [brochures, links] = await Promise.all([
    db.brochure.findMany({
      where: { id: { in: brochureIds } },
      select: { id: true, basename: true, originalName: true },
    }),
    db.policyBrochure.findMany({
      where: { brochureId: { in: brochureIds } },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            provider: true,
            currentVersion: {
              select: { id: true, versionNum: true, label: true, publishedAt: true },
            },
          },
        },
      },
    }),
  ]);

  const brochureMap = new Map(brochures.map((b) => [b.id, b]));
  const policyByBrochure = new Map<string, (typeof links)[number]["policy"]>();
  for (const link of links) {
    if (!policyByBrochure.has(link.brochureId)) {
      policyByBrochure.set(link.brochureId, link.policy);
    }
  }

  const enriched = results.map((r) => {
    const raw = r.metadata as any;
    const brochureId = raw?.brochure_id as string | undefined;
    const brochure = brochureId ? brochureMap.get(brochureId) : undefined;
    const policy = brochureId ? policyByBrochure.get(brochureId) : undefined;

    const metadata: Record<string, unknown> = {
      ...(raw ?? {}),
      chunk_id: raw?.chunk_id ?? String(r.id),
      source: "qdrant",
      query,
    };
    if (brochure) {
      metadata.brochure_id = brochure.id;
      metadata.brochure_name = brochure.basename || brochure.originalName;
    }
    if (policy) {
      metadata.policy_id = policy.id;
      metadata.policy_name = policy.name;
      metadata.provider = policy.provider;
      metadata.policy_version_num = policy.currentVersion?.versionNum ?? null;
      metadata.policy_version_id = policy.currentVersion?.id ?? null;
    }

    return {
      ...r,
      policyId: policy?.id,
      policyName: policy?.name,
      provider: policy?.provider ?? r.provider,
      metadata,
    };
  });

  return deterministicDeduplicate(enriched);
}

/** Deterministic dedup: keep highest score per chunk, sort by score desc. */
function deterministicDeduplicate(results: ContextResult[]): ContextResult[] {
  const chunkIdMap = new Map<string, ContextResult>();
  for (const result of results) {
    const key = (result.metadata as any)?.chunk_id ?? String(result.id);
    const existing = chunkIdMap.get(key);
    if (!existing) {
      chunkIdMap.set(key, { ...result });
    } else if (result.score > existing.score) {
      chunkIdMap.set(key, { ...result, score: result.score });
    }
  }
  return Array.from(chunkIdMap.values()).sort((a, b) => b.score - a.score);
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
    content: "",
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
    const key = (result.metadata as any)?.chunk_id ?? String(result.id);
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

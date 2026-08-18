import type { ContextResult, RerankResult } from "./types";

// ---------------------------------------------------------------------------
// Product-aware reranker (v2)
// ---------------------------------------------------------------------------

/**
 * Known product name patterns for matching against queries.
 * Each entry: [regex pattern, canonical brochure name keywords]
 * Used to detect when a query explicitly mentions a product.
 */
const PRODUCT_NAME_PATTERNS: Array<{ pattern: RegExp; keywords: string[] }> = [
  { pattern: /\b(?:smart\s*life|smartlife)\b/i, keywords: ["smartlife"] },
  { pattern: /\b(?:e[\s-]*term)\b/i, keywords: ["e-term", "eterm"] },
  { pattern: /\b(?:term\s*plan|term\s*insurance)\b/i, keywords: ["term"] },
  { pattern: /\b(?:fortune\s*maximiser)\b/i, keywords: ["fortune", "maximiser"] },
  { pattern: /\b(?:wealth\s*optima)\b/i, keywords: ["wealth", "optima"] },
  { pattern: /\b(?:ace\s*investment)\b/i, keywords: ["ace", "investment"] },
  { pattern: /\b(?:assured\s*savings)\b/i, keywords: ["assured", "savings"] },
  { pattern: /\b(?:assured\s*pension)\b/i, keywords: ["assured", "pension"] },
  { pattern: /\b(?:guaranteed\s*savings)\b/i, keywords: ["guaranteed", "savings"] },
  { pattern: /\b(?:lifetime\s*income)\b/i, keywords: ["lifetime", "income"] },
  { pattern: /\b(?:premier\s*life)\b/i, keywords: ["premier", "life"] },
  { pattern: /\b(?:premier\s*endowment)\b/i, keywords: ["premier", "endowment"] },
  { pattern: /\b(?:premier\s*moneyback)\b/i, keywords: ["premier", "moneyback"] },
  { pattern: /\b(?:premier\s*pension)\b/i, keywords: ["premier", "pension"] },
  { pattern: /\b(?:classic\s*endowment)\b/i, keywords: ["classic", "endowment"] },
  { pattern: /\b(?:single\s*invest)\b/i, keywords: ["single", "invest"] },
  { pattern: /\b(?:health\s*shield)\b/i, keywords: ["health", "shield"] },
  { pattern: /\b(?:saral\s*pension)\b/i, keywords: ["saral", "pension"] },
  { pattern: /\b(?:saral\s*jeevan)\b/i, keywords: ["saral", "jeevan"] },
  { pattern: /\b(?:sampoorn\s*bima)\b/i, keywords: ["sampoorn", "bima"] },
  { pattern: /\b(?:bachat\s*bima)\b/i, keywords: ["bachat", "bima"] },
  { pattern: /\b(?:tulip)\b/i, keywords: ["tulip"] },
  { pattern: /\b(?:e[\s-]*invest)\b/i, keywords: ["e-invest", "einvest"] },
  { pattern: /\b(?:platinum\s*plan)\b/i, keywords: ["platinum"] },
  { pattern: /\b(?:family\s*floater)\b/i, keywords: ["health"] },
  { pattern: /\b(?:health\s*insurance)\b/i, keywords: ["health"] },
  { pattern: /\b(?:death\s*benefit)\b/i, keywords: ["death", "benefit"] },
  { pattern: /\b(?:maturity\s*benefit)\b/i, keywords: ["maturity"] },
  { pattern: /\b(?:surrender)\b/i, keywords: ["surrender"] },
  { pattern: /\b(?:rider)\b/i, keywords: ["rider"] },
  { pattern: /\b(?:exclusion)\b/i, keywords: ["exclusion"] },
  { pattern: /\b(?:tax\s*benefit|section\s*80c)\b/i, keywords: ["tax"] },
  { pattern: /\b(?:premium\s*payment)\b/i, keywords: ["premium"] },
  { pattern: /\b(?:entry\s*age|eligib)\b/i, keywords: ["eligib"] },
  { pattern: /\b(?:pension|retirement|annuit)\b/i, keywords: ["pension"] },
  { pattern: /\b(?:savings?|endow)\b/i, keywords: ["savings"] },
  { pattern: /\b(?:invest|ulip|unit[\s-]*linked)\b/i, keywords: ["invest"] },
  { pattern: /\b(?:protection|pure[\s-]*risk)\b/i, keywords: ["term", "protection"] },
];

/**
 * Extract product name keywords from a query string.
 */
function extractQueryKeywords(query: string): string[] {
  const keywords: string[] = [];
  for (const { pattern, keywords: kw } of PRODUCT_NAME_PATTERNS) {
    if (pattern.test(query)) {
      keywords.push(...kw);
    }
  }
  return [...new Set(keywords)];
}

/**
 * Check if a brochure name matches any of the query keywords.
 */
function brochureNameMatchesKeywords(
  brochureName: string,
  keywords: string[]
): number {
  if (keywords.length === 0 || !brochureName) return 0;
  const lower = brochureName.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) matches++;
  }
  return matches / keywords.length;
}

/**
 * Product-aware reranking using Qdrant scores as base semantic scores,
 * plus heuristic boosts for product name matching, chunk diversity,
 * and content keyword overlap.
 *
 * This is O(n) — no additional API calls to Ollama/Qdrant needed.
 */
export function applyProductAwareRerank(
  query: string,
  candidates: ContextResult[],
  topN: number = 10
): RerankResult[] {
  if (candidates.length === 0) return [];

  const queryKeywords = extractQueryKeywords(query);
  const queryLower = query.toLowerCase();

  // Group chunks by brochure_id
  const brochureGroups = new Map<string, ContextResult[]>();
  for (const c of candidates) {
    const bid = String((c.metadata as any)?.brochure_id || c.id);
    if (!brochureGroups.has(bid)) brochureGroups.set(bid, []);
    brochureGroups.get(bid)!.push(c);
  }

  // Calculate product-level composite scores
  const productScores = new Map<
    string,
    {
      maxSemanticScore: number;
      chunkCount: number;
      nameMatchScore: number;
      contentKeywordScore: number;
      compositeScore: number;
    }
  >();

  for (const [brochureId, chunks] of brochureGroups) {
    const maxSemanticScore = Math.max(...chunks.map((c) => c.score));

    // Chunk diversity: more chunks = more relevant (logarithmic)
    const chunkCount = chunks.length;
    const diversityScore = Math.log2(chunkCount + 1) / Math.log2(10); // normalize to ~0-1

    // Name match: does the brochure name match query keywords?
    const brochureName =
      String((chunks[0]?.metadata as any)?.brochure_name || "") ||
      String(chunks[0]?.policyName || "");
    const nameMatchScore = brochureNameMatchesKeywords(brochureName, queryKeywords);

    // Content keyword overlap: do chunk contents contain query terms?
    const contentText = chunks.map((c) => c.content.toLowerCase()).join(" ");
    const queryTerms = queryLower.split(/\s+/).filter((t) => t.length > 2);
    const contentKeywordScore =
      queryTerms.length > 0
        ? queryTerms.filter((t) => contentText.includes(t)).length / queryTerms.length
        : 0;

    // Composite score (weights derived from baseline analysis)
    const compositeScore =
      maxSemanticScore * 0.60 +      // base semantic similarity
      diversityScore * 0.10 +         // chunk diversity bonus
      nameMatchScore * 0.20 +         // product name match (strong signal)
      contentKeywordScore * 0.10;     // content keyword overlap

    productScores.set(brochureId, {
      maxSemanticScore,
      chunkCount,
      nameMatchScore,
      contentKeywordScore,
      compositeScore,
    });
  }

  // Re-score each candidate based on its product's composite score
  const reranked: RerankResult[] = candidates.map((c) => {
    const bid = String((c.metadata as any)?.brochure_id || c.id);
    const ps = productScores.get(bid);
    return {
      ...c,
      rerankedScore: ps?.compositeScore ?? c.score,
      relevanceRank: 0,
      relevance: undefined as any,
    };
  });

  // Sort by composite score descending
  reranked.sort((a, b) => (b.rerankedScore ?? 0) - (a.rerankedScore ?? 0));

  // Assign ranks and relevance labels
  const top = reranked.slice(0, topN);
  top.forEach((result, index) => {
    result.relevanceRank = index + 1;
    const score = result.rerankedScore ?? 0;
    if (score >= 0.65) {
      result.relevance = "high";
    } else if (score >= 0.50) {
      result.relevance = "medium";
    } else {
      result.relevance = "low";
    }
  });

  return top;
}

// ---------------------------------------------------------------------------
// Legacy implementations (kept for backward compatibility)
// ---------------------------------------------------------------------------

export function applyRRFS(results: ContextResult[]): RerankResult[] {
  const rankBySource = new Map<string, number>();

  results.forEach((result) => {
    const key = `${result.source}`;
    const currentRank = rankBySource.get(key) || 0;
    result.rank = currentRank + 1;
    rankBySource.set(key, result.rank);
  });

  const rrfsResults = results.map((result) => {
    const k = 60;

    const score = 1 / (result.rank! + k);

    return {
      ...result,
      rerankedScore: score,
      relevanceRank: 0,
      relevance: undefined as any,
    };
  });

  rrfsResults.sort((a, b) => {
    if (b.rerankedScore !== a.rerankedScore) {
      return b.rerankedScore - a.rerankedScore;
    }

    const sourcePriority = { postgres_fts: 0, qdrant: 1, user_history: 2 };
    return (
      (sourcePriority[a.source as keyof typeof sourcePriority] ?? 99) -
      (sourcePriority[b.source as keyof typeof sourcePriority] ?? 99)
    );
  });

  rrfsResults.forEach((result, index) => {
    result.relevanceRank = index + 1;

    if (result.rerankedScore >= 0.005) {
      result.relevance = "high";
    } else if (result.rerankedScore >= 0.002) {
      result.relevance = "medium";
    } else {
      result.relevance = "low";
    }
  });

  return rrfsResults;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${process.env.OLLAMA_HOST || "http://localhost:11434"}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "nomic-embed-text",
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function applySemanticRerank(
  query: string,
  candidates: ContextResult[],
  topN: number = 5
): Promise<RerankResult[]> {
  const documents: string[] = candidates.map((c) =>
    c.content || `${c.metadata?.content_snippet || ""} ${c.policyName || ""}`
  );

  try {
    const queryEmbedding = await generateEmbedding(query);
    const docEmbeddings: number[][] = [];

    for (const doc of documents) {
      const embedding = await generateEmbedding(doc);
      docEmbeddings.push(embedding);
    }

    const scores = docEmbeddings.map((docEmb) => cosineSimilarity(queryEmbedding, docEmb));

    return candidates
      .map((candidate, index) => ({
        ...candidate,
        rerankedScore: scores[index] ?? 0,
        relevanceRank: 0,
        relevance: undefined as any,
      }))
      .sort((a, b) => (b.rerankedScore ?? 0) - (a.rerankedScore ?? 0))
      .slice(0, topN)
      .map((result, index) => ({
        ...result,
        relevanceRank: index + 1,
        relevance:
          result.rerankedScore && result.rerankedScore >= 0.8
            ? "high"
            : result.rerankedScore && result.rerankedScore >= 0.5
              ? "medium"
              : "low" as const,
      }));
  } catch (error) {
    console.warn(
      `[WARNING] Ollama embedding reranking failed, falling back to RRF: ${(error as Error).message}`
    );

    return applyRRFS(candidates);
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

export async function rerank(
  query: string,
  candidates: ContextResult[],
  topN: number = 20
): Promise<{ results: RerankResult[]; method: "product_aware" | "semantic" | "rrfs" }> {
  try {
    // Product-aware reranking: O(n), no API calls, uses Qdrant scores + heuristics
    const productAwareReranked = applyProductAwareRerank(query, candidates, topN);
    return { results: productAwareReranked, method: "product_aware" };
  } catch (error) {
    console.warn("[WARNING] Product-aware reranking failed, falling back to RRFS");
    const rrfsReranked = applyRRFS(candidates);
    return { results: rrfsReranked as any, method: "rrfs" };
  }
}

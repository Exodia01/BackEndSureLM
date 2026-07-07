import type { ContextResult, RerankResult } from "./types";

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
): Promise<{ results: RerankResult[]; method: "semantic" | "rrfs" }> {
  try {
    const semanticReranked = await applySemanticRerank(query, candidates, topN);

    return { results: semanticReranked as any, method: "semantic" };
  } catch (error) {
    console.warn("[WARNING] Semantic reranking failed, falling back to RRFS");

    const rrfsReranked = applyRRFS(candidates);

    return { results: rrfsReranked as any, method: "rrfs" };
  }
}

import { RetrievalResult } from "@/lib/retrieval/types";
import { RerankResult, type rerankInput } from "./types";
import { generateOllamaEmbedding } from "../embeddings";

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://localhost:11434";

export function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));

  if (normA === 0 || normB === 0) return 0;

  return dot / (normA * normB);
}

async function generateEmbeddingsBatch(texts: string[], model: string = "bge-m3"): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const text of texts) {
    const embedding = await generateOllamaEmbedding(text, model);
    embeddings.push(embedding);
  }

  return embeddings;
}

export async function rerank(query: string, candidates: RetrievalResult[], topN: number = 5): Promise<RerankResult[]> {
  const documents: string[] = candidates.map(c =>
    c.content || `${c.payload?.content_snippet || ""} ${c.policyName || ""}`
  );

  try {
    const queryEmbedding = await generateOllamaEmbedding(query);
    const docEmbeddings = await generateEmbeddingsBatch(documents);

    const scores = docEmbeddings.map((docEmb) => cosineSimilarity(queryEmbedding, docEmb));

    return candidates
      .map((candidate, index) => ({
        ...candidate,
        rerankedScore: scores[index] ?? 0,
        relevanceRank: 0,
        relevance: undefined,
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
              : "low",
      }));
  } catch (error) {
    console.warn(
      `[WARNING] Ollama embedding reranking failed, falling back to RRF: ${(error as Error).message}`
    );

    const { applyRRFS } = await import("./rrfs");
    return applyRRFS(candidates).slice(0, topN);
  }
}

export async function hybridRerank(
  query: string,
  candidates: RetrievalResult[],
  topN: number = 20
): Promise<RerankResult[]> {
  const reranked = await rerank(query, candidates.slice(0, topN), 5);
  
  return reranked;
}





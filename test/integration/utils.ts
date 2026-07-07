import type { RetrievalResult } from "@/lib/retrieval/types";
import type { RerankResult } from "@/lib/ai/rerank/types";

export function createMockCandidate(options: {
  id?: string;
  content?: string;
  score?: number;
  source?: "fts" | "vector" | "history";
}): RetrievalResult {
  return {
    id: options.id || `chunk-${Date.now()}`,
    score: options.score ?? 0.5,
    source: options.source ?? "fts",
    payload: {
      chunk_id: options.id,
      content_snippet: options.content || "default content"
    }
  };
}

export async function checkOllamaHealth(): Promise<void> {
  const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
  try {
    const response = await fetch(`${ollamaUrl}/api/tags`);
    if (!response.ok) {
      throw new Error("Ollama service unavailable at " + ollamaUrl);
    }
  } catch (error: any) {
    throw new Error("Ollama health check failed: " + (error.message || error));
  }
}

export async function generateTestEmbedding(dimensions: number = 1024): Promise<number[]> {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1);
}

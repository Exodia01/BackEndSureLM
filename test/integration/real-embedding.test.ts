import { describe, it, expect } from "vitest";
import { generateOllamaEmbedding } from "@/lib/ai/embeddings";

describe("Real BGE-M3 Embeddings", () => {
  beforeAll(() => {
    if (!process.env.OLLAMA_HOST) {
      process.env.OLLAMA_HOST = "http://localhost:11434";
    }
  });

  it("should generate valid embeddings from bge-m3 model", { timeout: 60000 }, async () => {
    const embedding = await generateOllamaEmbedding("test query");

    expect(embedding.length).toBeGreaterThan(0);
    expect(typeof embedding[0]).toBe("number");
    expect(embedding.every((v) => typeof v === "number")).toBe(true);
  });

  it("should generate consistent embeddings for same text", async () => {
    const text = "Consistent test query for Ollama bge-m3";
    const emb1 = await generateOllamaEmbedding(text);
    const emb2 = await generateOllamaEmbedding(text);

    expect(emb1.length).toBe(emb2.length);
    expect(emb1.every((v, i) => v === emb2[i])).toBe(true);
  });

  it("should handle multiple embedding calls", async () => {
    const texts = ["first text", "second text", "third text"];
    
    for (const text of texts) {
      const embedding = await generateOllamaEmbedding(text);
      expect(embedding.length).toBeGreaterThan(0);
    }
  });
});

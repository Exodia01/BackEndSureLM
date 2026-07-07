import { describe, it, expect } from "vitest";
import { checkOllamaHealth } from "./utils";

describe("Ollama Integration Health Check", () => {
  beforeAll(async () => {
    await checkOllamaHealth();
  });

  it("should verify bge-m3 model is available", async () => {
    const ollamaUrl = process.env.OLLAMA_HOST || "http://localhost:11434";
    
    const response = await fetch(`${ollamaUrl}/api/tags`);
    expect(response.ok).toBe(true);
    
    const data = await response.json();
    const models = data.models || [];
    
    const bgeM3Found = models.some((m: any) => m.name?.includes("bge-m3"));
    expect(bgeM3Found).toBe(true);
  });

  it("should generate valid embeddings", async () => {
    const { generateOllamaEmbedding } = await import("@/lib/ai/embeddings");
    
    const embedding = await generateOllamaEmbedding("test query for bge-m3");
    
    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
    expect(embedding.every((v) => typeof v === "number")).toBe(true);
  });
});

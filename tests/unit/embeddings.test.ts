import { describe, it, expect, vi, afterEach } from "vitest";
import {
  generateEmbedding,
  generateEmbeddings,
  generateOllamaEmbedding,
} from "@/lib/ai/embeddings";

const OLLAMA_HOST =
  process.env.OLLAMA_HOST && !process.env.OLLAMA_HOST.includes("0.0.0.0")
    ? process.env.OLLAMA_HOST.replace(/\/v1$/, "")
    : "http://localhost:11434";

function mockFetch(ok: boolean, payload: unknown, statusText = "OK") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok,
      statusText,
      json: async () => payload,
    }))
  );
}

describe("lib/ai/embeddings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the embedding vector for a single prompt", async () => {
    mockFetch(true, { embedding: [0.1, 0.2, 0.3] });

    const embedding = await generateEmbedding("critical illness");
    expect(embedding).toEqual([0.1, 0.2, 0.3]);
  });

  it("throws when Ollama returns a non-ok response", async () => {
    mockFetch(false, {}, "Bad Request");

    await expect(generateEmbedding("critical illness")).rejects.toThrow(
      "Ollama embedding failed: Bad Request"
    );
  });

  it("generates embeddings for multiple texts sequentially", async () => {
    mockFetch(true, { embedding: [0.5, 0.6] });

    const embeddings = await generateEmbeddings(["a", "b"]);
    expect(embeddings).toEqual([
      [0.5, 0.6],
      [0.5, 0.6],
    ]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it("generateOllamaEmbedding posts to the embeddings endpoint with a model", async () => {
    mockFetch(true, { embedding: [1, 2] });

    await generateOllamaEmbedding("term plan", "nomic-embed-text");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      `${OLLAMA_HOST}/api/embeddings`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "nomic-embed-text", prompt: "term plan" }),
      })
    );
  });
});

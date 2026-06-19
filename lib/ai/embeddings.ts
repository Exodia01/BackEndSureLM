import dotenv from "dotenv";

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST 
  ? (process.env.OLLAMA_HOST === "0.0.0.0" || process.env.OLLAMA_HOST.includes("0.0.0.0")
      ? "http://localhost:11434"
      : (process.env.OLLAMA_HOST.endsWith("/v1") 
            ? process.env.OLLAMA_HOST.replace("/v1", "") 
            : process.env.OLLAMA_HOST))
  : "http://localhost:11434";
const EMBEDDING_MODEL = "nomic-embed-text";

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${OLLAMA_HOST}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama embedding failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (let i = 0; i < texts.length; i++) {
    embeddings.push(await generateEmbedding(texts[i]));
    if ((i + 1) % 50 === 0) {
      console.log(`Generated ${i + 1}/${texts.length} embeddings`);
    }
  }

  return embeddings;
}

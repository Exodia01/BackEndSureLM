export async function ensureCollection(
  name: string,
  vectorSize: number
): Promise<void> {
  const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
  
  try {
    const response = await fetch(`${QDRANT_URL}/collections`);
    if (!response.ok) {
      throw new Error("Failed to list collections");
    }

    const data: any = await response.json();
    const exists = data.collections?.some((c: any) => c.name === name);

    if (!exists) {
      await createCollection(name, vectorSize);
    }
  } catch (error) {
    console.error(`[ensureCollection] Failed to ensure collection ${name}:`, error);
    throw error;
  }
}

export async function createCollection(
  name: string,
  vectorSize: number
): Promise<void> {
  const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
  
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create collection ${name}: ${error.status}`);
    }
  } catch (error) {
    console.error(`[createCollection] Failed to create collection ${name}:`, error);
    throw error;
  }
}

export async function upsertPoints(
  collection: string,
  points: { id: string | number; vector: number[]; payload: Record<string, unknown> }[]
): Promise<void> {
  const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
  
  try {
    const response = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upsert points to ${collection}: ${error.status}`);
    }
  } catch (error) {
    console.error(`[upsertPoints] Failed to upsert to ${collection}:`, error);
    throw error;
  }
}

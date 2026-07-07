const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

import type { VectorSearchOptions } from "./types";

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function createCollection(
  name: string,
  vectorSize: number
): Promise<void> {
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
    throw new Error(`Failed to create collection: ${error.status}`);
  }
}

export async function ensureCollection(
  name: string,
  vectorSize: number
): Promise<void> {
  const collectionsResponse = await fetch(`${QDRANT_URL}/collections`);
  if (!collectionsResponse.ok) {
    throw new Error("Failed to list collections");
  }

  const collectionsData: any = await collectionsResponse.json();
  const exists = collectionsData.collections?.some((c: any) => c.name === name);

  if (!exists) {
    await createCollection(name, vectorSize);
  }
}

export async function upsertPoints(
  collection: string,
  points: { id: string | number; vector: number[]; payload: Record<string, unknown> }[]
): Promise<void> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to upsert points: ${error.status}`);
  }
}

export async function searchPoints(
  collection: string,
  vector: number[],
  options?: VectorSearchOptions
): Promise<{ id: string | number; score: number; payload: Record<string, unknown> }[]> {
  const requestBody: any = {
    vector,
    limit: options?.limit || 8,
    with_payload: true,
  };

  if (options?.filter) {
    requestBody.filter = {
      must: options.filter.map((f: { key: string; match?: { value: string | number } }) => ({
        key: f.key,
        match: f.match ? { value: f.match.value } : undefined,
      })),
    };
  }

  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to search: ${error.status}`);
  }

  const result: any = await response.json();
  return result.result?.map((r: any) => ({
    id: r.id,
    score: r.score,
    payload: r.payload,
  })) || [];
}

export async function deletePoints(
  collection: string,
  pointIds: (string | number)[]
): Promise<void> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}/points/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: pointIds,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to delete points: ${error.status}`);
  }
}

export async function getCollectionInfo(collection: string): Promise<any> {
  const response = await fetch(`${QDRANT_URL}/collections/${collection}`);
  if (!response.ok) {
    throw new Error(`Failed to get collection info: ${response.status}`);
  }

  return response.json();
}

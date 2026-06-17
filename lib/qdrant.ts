const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

export interface Point {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface FilterCondition {
  key: string;
  match?: { value: string | number };
  range?: { gte?: number; lte?: number; gt?: number; lt?: number };
}

export interface SearchFilter {
  must?: FilterCondition[];
  must_not?: FilterCondition[];
  should?: FilterCondition[];
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function createCollection(
  name: string,
  vectorSize: number,
  payloadSchema?: Record<string, string>
): Promise<void> {
  const requestBody: any = {
    vectors: {
      size: vectorSize,
      distance: "Cosine",
    },
  };

  if (payloadSchema) {
    requestBody.payload_indices = payloadSchema;
  }

  const response = await fetch(`${QDRANT_URL}/collections/${name}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create collection: ${error.status}`);
  }
}

export async function upsert(
  collection: string,
  points: Point[]
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

export async function search(
  collection: string,
  vector: number[],
  limit: number = 8,
  filter?: SearchFilter
): Promise<{ id: string | number; score: number; payload: Record<string, unknown> }[]> {
  const requestBody: any = {
    vector,
    limit,
    with_payload: true,
  };

  if (filter) {
    requestBody.filter = filter;
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

  const result = await response.json();
  return result.result.map((r: any) => ({
    id: r.id,
    score: r.score,
    payload: r.payload,
  }));
}

export async function semanticSearch(
  vector: number[],
  filter?: SearchFilter,
  collection: string = process.env.QDRANT_COLLECTION || "policies",
  limit: number = 8
): Promise<{ id: string; score: number; payload: Record<string, unknown> }[]> {
  const results = await search(collection, vector, limit, filter);
  
  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: r.payload,
  }));
}

export async function createPolicyCollection(
  vectorSize: number
): Promise<void> {
  const payloadSchema = {
    policy_id: "keyword",
    chunk_index: "integer",
    source: "keyword",
  };

  await createCollection("policies", vectorSize, payloadSchema);
}

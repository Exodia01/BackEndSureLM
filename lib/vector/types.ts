export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface VectorFilterCondition {
  key: string;
  match?: { value: string | number };
  range?: { gte?: number; lte?: number };
}

export interface VectorSearchOptions {
  limit?: number;
  filter?: VectorFilterCondition[];
}

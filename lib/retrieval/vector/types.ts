export interface VectorPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, unknown>;
}

export interface SearchFilterCondition {
  key: string;
  match?: { value: string | number };
  range?: { gte?: number; lte?: number };
}

export interface VectorSearchOptions {
  limit?: number;
  filter?: SearchFilterCondition[];
}
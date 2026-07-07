export interface Brochure {
  id: string;
  filename: string;
  source: string;
  status: "processing" | "ready";
  chunkCount: number;
  createdAt: Date;
}

export interface ChunkMetadata {
  chunk_id: string;
  document_id: string;
  chunk_order: number;
  content: string;
  category?: string;
  validation?: boolean;
}

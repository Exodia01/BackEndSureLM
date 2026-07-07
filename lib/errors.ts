export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(public details: Array<{ path: string[]; message: string }>) {
    super("Validation failed", 400, "VALIDATION_ERROR");
  }
}

export class EmbeddingError extends AppError {
  constructor(
    public chunkIndex: number,
    public original: Error
  ) {
    super(`Embedding failed for chunk ${chunkIndex}`);
    this.statusCode = 500;
    this.code = "EMBEDDING_FAILED";
  }
}

export class PdfProcessingError extends AppError {
  constructor(public page?: number) {
    super(page ? `PDF processing failed at page ${page}` : "PDF processing failed");
    this.statusCode = 400;
    this.code = "PDF_PROCESSING_ERROR";
  }
}

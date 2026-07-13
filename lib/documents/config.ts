export const PROMPT_TEMPLATES = {
  aadhaar_front: 'Extract name, DOB, gender, address, Aadhaar number. Preserve exact format.',
  aadhaar_back: 'Extract date of issue, issuing authority, hologram presence (Y/N)',
  pan: 'Extract name, father\'s name, DOB, PAN number',
  default: 'Extract all visible text from this document/image. Return ONLY the extracted text.',
};

export const VALIDATION_RULES = {
  aadhaar_number: /^(\d{4})-(\d{4})-(\d{4})$/,
  pan: /^([A-Z]{5}\d{4}[A-Z]{1})$/,
};

export interface OCRConfig {
  primaryModel: string;
  fallbackModel: string;
  baseUrl: string;
}

export class OCRConfig implements OCRConfig {
  get primaryModel(): string { return process.env.OCR_PRIMARY_MODEL || 'minicpm-v'; }
  get fallbackModel(): string { return process.env.OCR_FALLBACK_MODEL || 'llava:7b'; }
  get baseUrl(): string { return process.env.OLLAMA_HOST || 'http://localhost:11434'; }
}

export class StorageConfig {
  isLocal = process.env.STORAGE_BACKEND?.toLowerCase() === 'minio';
  awsRegion = process.env.AWS_REGION || 'us-east-1';
  minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  
  get originalsBucket(): string { return process.env.S3_ORIGINALS_BUCKET || 'surelm-documents-originals'; }
  get processedBucket(): string { return process.env.S3_PROCESSED_BUCKET || 'surelm-documents-processed'; }
}

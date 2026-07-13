import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfig } from './config';

export class DocumentStorage {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    const config = new StorageConfig();
    this.s3 = new S3Client({
      region: config.awsRegion,
      endpoint: config.isLocal ? config.minioEndpoint : undefined,
      forcePathStyle: config.isLocal,
    });
    this.bucket = config.originalsBucket;
  }

  async uploadOriginal(hash: string, fileBuffer: Buffer, mimetype: string): Promise<string> {
    const key = `originals/${hash}/original.${mimetype.split('/')[1]}`;
    
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimetype,
    }));

    return key;
  }

  async getPresignedUploadUrl(filename: string, mimetype: string): Promise<string> {
    const hash = await this.calculateHash(filename);
    const key = `originals/${hash}/original.${mimetype.split('/')[1]}`;

    return getSignedUrl(this.s3, new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimetype,
    }), { expiresIn: 3600 });
  }

  async uploadProcessed(docId: string, pdfBuffer: Buffer): Promise<string> {
    const key = `processed/${docId}/proof_ofSubmission.pdf`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    return key;
  }

  async uploadJson(docId: string, fileName: string, jsonData: unknown): Promise<string> {
    const key = `json/${docId}/${fileName}`;
    const jsonStr = JSON.stringify(jsonData);

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: Buffer.from(jsonStr),
      ContentType: 'application/json',
    }));

    return key;
  }

  async calculateHash(filename: string): Promise<string> {
    // Placeholder - implement SHA-256 hash calculation
    return `hash_${Date.now()}`;
  }
}

export class StorageConfig {
  isLocal = process.env.STORAGE_BACKEND?.toLowerCase() === 'minio';
  awsRegion = process.env.AWS_REGION || 'us-east-1';
  minioEndpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  
  get originalsBucket(): string {
    return process.env.S3_ORIGINALS_BUCKET || 'surelm-documents-originals';
  }

  get processedBucket(): string {
    return process.env.S3_PROCESSED_BUCKET || 'surelm-documents-processed';
  }
}

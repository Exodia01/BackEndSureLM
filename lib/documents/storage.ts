/**
 * Document storage abstraction.
 *
 * LocalDiskStorage is the default implementation: files land under
 * {PDF_STORAGE_DIR}/documents/{aa/bb}/{sha256}.{ext}, keyed only by the
 * content hash (never caller-controlled). A future S3 implementation can swap
 * in behind the same interface by implementing DocumentStorage and wiring it
 * in getDocumentStorage().
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface StoredObject {
  key: string;
  buffer: Buffer;
  mimeType: string;
}

export interface DocumentStorage {
  /** Write bytes under a generated key. Resolves the final key. */
  put(buffer: Buffer, mimeType: string): Promise<string>;
  /** Read bytes back by key. Returns null when the object does not exist. */
  get(key: string): Promise<Buffer | null>;
  /** Delete an object. Never throws on a missing object. */
  delete(key: string): Promise<void>;
  /** True when the object exists. */
  exists(key: string): Promise<boolean>;
  /** Storage root for diagnostics. */
  readonly root: string;
}

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const ALLOWED_MIME_TYPES = Object.keys(EXT_BY_MIME);

/** Path-traversal guard: keys are hash-derived, but never trust callers. */
function assertSafeKey(key: string): void {
  if (!key || typeof key !== "string") throw new Error("Invalid storage key");
  if (key.startsWith("/") || key.includes("\\") || key.includes("..")) {
    throw new Error("Unsafe storage key");
  }
}

class LocalDiskStorage implements DocumentStorage {
  readonly root: string;

  constructor(root: string) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
  }

  async put(buffer: Buffer, mimeType: string): Promise<string> {
    const ext = EXT_BY_MIME[mimeType];
    if (!ext) throw new Error(`Unsupported mime type: ${mimeType}`);
    const sha = crypto.createHash("sha256").update(buffer).digest("hex");
    const key = path.posix.join("documents", sha.slice(0, 2), sha.slice(2, 4), `${sha}.${ext}`);
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(path.resolve(this.root))) {
      throw new Error("Storage key escapes root");
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, buffer);
    return key;
  }

  async get(key: string): Promise<Buffer | null> {
    assertSafeKey(key);
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(path.resolve(this.root))) return null;
    try {
      return fs.readFileSync(abs);
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(path.resolve(this.root))) return;
    try {
      fs.unlinkSync(abs);
    } catch {
      // no-op on missing object
    }
  }

  async exists(key: string): Promise<boolean> {
    assertSafeKey(key);
    const abs = path.resolve(this.root, key);
    if (!abs.startsWith(path.resolve(this.root))) return false;
    try {
      return fs.statSync(abs).isFile();
    } catch {
      return false;
    }
  }
}

let singleton: DocumentStorage | null = null;

export function getDocumentStorage(): DocumentStorage {
  if (singleton) return singleton;
  const root = process.env.PDF_STORAGE_DIR || "/data/pdfs";
  singleton = new LocalDiskStorage(root);
  return singleton;
}

/** Test hook: point storage at a throwaway dir and rebuild the singleton. */
export function __resetDocumentStorage(root?: string): DocumentStorage {
  singleton = new LocalDiskStorage(root || process.env.PDF_STORAGE_DIR || "/data/pdfs");
  return singleton;
}

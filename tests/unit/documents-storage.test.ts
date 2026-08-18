import { describe, it, expect, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { __resetDocumentStorage } from "@/lib/documents/storage";

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "surelm-docstore-"));

describe("document storage", () => {
  beforeEach(() => {
    __resetDocumentStorage(tmpRoot);
  });

  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("stores bytes under a content-addressed key and reads them back", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    const buffer = Buffer.from("hello storage");
    const key = await storage.put(buffer, "image/png");
    expect(key).toMatch(/^documents\/[0-9a-f]{2}\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/);

    const read = await storage.get(key);
    expect(read).not.toBeNull();
    expect(read!.toString()).toBe("hello storage");
  });

  it("derives the same key for identical content (dedup)", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    const k1 = await storage.put(Buffer.from("same bytes"), "application/pdf");
    const k2 = await storage.put(Buffer.from("same bytes"), "application/pdf");
    expect(k1).toBe(k2);
  });

  it("rejects unsupported mime types", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    await expect(storage.put(Buffer.from("x"), "text/plain")).rejects.toThrow(/Unsupported/);
  });

  it("returns null for missing objects and false for exists", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    expect(await storage.get("documents/aa/bb/1234567890abcdef.png")).toBeNull();
    expect(await storage.exists("documents/aa/bb/1234567890abcdef.png")).toBe(false);
  });

  it("blocks path traversal keys", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    await expect(storage.get("../../etc/passwd")).rejects.toThrow(/Unsafe/);
    await expect(storage.get("documents/../../secret")).rejects.toThrow(/Unsafe/);
    await expect(storage.get("C:\\windows\\system32\\config")).rejects.toThrow(/Unsafe/);
    await expect(storage.exists("../escape")).rejects.toThrow(/Unsafe/);
  });

  it("deletes an object and reports existence after", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    const key = await storage.put(Buffer.from("to delete"), "image/jpeg");
    expect(await storage.exists(key)).toBe(true);
    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
    await storage.delete(key);
  });

  it("never writes outside the root even with a crafted key", async () => {
    const storage = __resetDocumentStorage(tmpRoot);
    const key = await storage.put(Buffer.from("test"), "image/png");
    const abs = path.resolve(tmpRoot, key);
    expect(abs.startsWith(path.resolve(tmpRoot))).toBe(true);
  });
});

/**
 * Pure MIME detection from magic bytes. Kept free of heavy native deps so API
 * routes can import it without bundling @napi-rs/canvas (which lives in ocr.ts).
 */

/** Detect the true file type from magic bytes. Returns the MIME or null. */
export function detectMimeType(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  const hex = buffer.subarray(0, 12).toString("hex");
  if (hex.startsWith("25504446")) return "application/pdf";
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  const pngSig = "89504e470d0a1a0a";
  if (hex.startsWith(pngSig)) return "image/png";
  const webpSig = "52494646";
  if (hex.startsWith(webpSig) && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

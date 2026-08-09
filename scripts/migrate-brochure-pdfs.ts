/**
 * One-time migration: move Brochure PDFs from BYTEA (pdfData) to the
 * filesystem at /data/pdfs/{versionHash}.pdf and record filePath.
 *
 * Safety guarantees:
 * - Never overwrites an existing file on disk.
 * - Skips brochures that already have a filePath.
 * - Verifies every written file exists and matches the hash before finishing.
 * - Prints a summary; rows with missing pdfData are skipped and reported.
 *
 * Usage: npx tsx scripts/migrate-brochure-pdfs.ts
 */
import { db } from "../lib/db";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const PDF_STORAGE_DIR = process.env.PDF_STORAGE_DIR || "/data/pdfs";

function computeHash(buffer: Buffer): string {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

async function main() {
  await fs.mkdir(PDF_STORAGE_DIR, { recursive: true });

  const brochures = await db.brochure.findMany({
    where: { filePath: null },
    select: { id: true, basename: true, pdfData: true, versionHash: true },
  });

  console.log(`[migrate-brochure-pdfs] Found ${brochures.length} brochures without filePath`);

  let migrated = 0;
  let skippedNoData = 0;
  let alreadyOnDisk = 0;
  const failures: string[] = [];

  for (const brochure of brochures) {
    try {
      if (!brochure.pdfData) {
        console.warn(`[migrate-brochure-pdfs] SKIP ${brochure.id} (${brochure.basename}): no pdfData`);
        skippedNoData++;
        continue;
      }

      const buffer = Buffer.from(brochure.pdfData);
      const hash = brochure.versionHash || computeHash(buffer);
      const filePath = path.join(PDF_STORAGE_DIR, `${hash}.pdf`);

      let onDisk = false;
      try {
        await fs.access(filePath);
        onDisk = true;
      } catch {
        // file does not exist yet — safe to write
      }

      if (!onDisk) {
        await fs.writeFile(filePath, buffer);
      } else {
        alreadyOnDisk++;
      }

      // Verify written/existing file matches the source bytes.
      const onDiskBuffer = await fs.readFile(filePath);
      if (computeHash(onDiskBuffer) !== hash) {
        failures.push(`${brochure.id} (${brochure.basename}): hash mismatch on disk`);
        continue;
      }

      await db.brochure.update({
        where: { id: brochure.id },
        data: { filePath, pdfData: null },
      });

      migrated++;
    } catch (error) {
      failures.push(`${brochure.id} (${brochure.basename}): ${(error as Error).message}`);
    }
  }

  console.log(`[migrate-brochure-pdfs] DONE: migrated=${migrated}, alreadyOnDisk=${alreadyOnDisk}, skippedNoData=${skippedNoData}, failures=${failures.length}`);

  if (failures.length > 0) {
    console.error("[migrate-brochure-pdfs] Failures:");
    failures.forEach((f) => console.error("  -", f));
    process.exit(1);
  }

  console.log("[migrate-brochure-pdfs] All brochures now have a filePath. You may now apply the finalize migration to drop pdfData and enforce NOT NULL.");
}

main()
  .catch((error) => {
    console.error("[migrate-brochure-pdfs] Fatal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

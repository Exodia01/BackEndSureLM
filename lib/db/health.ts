import { db } from "./client";
import axios from "axios";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkPostgresHealth(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await db.$queryRaw`SELECT 1`;
      console.log(`[db] Postgres health check passed (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.error(`[db] Postgres health check failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  return false;
}

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";

export async function checkQdrantHealth(): Promise<boolean> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.get(`${QDRANT_URL}/collections`);
      console.log(`[db] Qdrant health check passed (attempt ${attempt})`);
      return true;
    } catch (error) {
      console.error(`[db] Qdrant health check failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  return false;
}

export async function checkAllHealth(): Promise<{ postgres: boolean; qdrant: boolean }> {
  const [postgres, qdrant] = await Promise.all([checkPostgresHealth(), checkQdrantHealth()]);
  console.log(`[db] Health check results: postgres=${postgres}, qdrant=${qdrant}`);
  return { postgres, qdrant };
}

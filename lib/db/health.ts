import { db } from "../db";

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6334";

export async function checkPostgresHealth(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error("[db] Postgres health check failed:", error);
    return false;
  }
}

export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${QDRANT_URL}/collections`);
    return response.ok;
  } catch (error) {
    console.error("[db] Qdrant health check failed:", error);
    return false;
  }
}

export async function checkAllHealth(): Promise<{ postgres: boolean; qdrant: boolean }> {
  const [postgres, qdrant] = await Promise.all([checkPostgresHealth(), checkQdrantHealth()]);
  return { postgres, qdrant };
}
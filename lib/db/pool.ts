import { db } from "./client";
import type { PoolMetrics } from "@prisma/client/runtime/library";

export async function getPoolMetrics(): Promise<PoolMetrics | null> {
  try {
    const metrics = await db.$metrics?.prometheus();
    return metrics ? JSON.parse(metrics) : null;
  } catch (error) {
    console.error("[db] Failed to get pool metrics:", error);
    return null;
  }
}

export async function checkPoolStatus(): Promise<{
  connected: boolean;
  activeConnections: number;
  queuedQueries: number;
}> {
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    return {
      connected: true,
      activeConnections: 0,
      queuedQueries: 0,
    };
  } catch (error) {
    console.error("[db] Pool status check failed:", error);
    return {
      connected: false,
      activeConnections: 0,
      queuedQueries: 0,
    };
  }
}

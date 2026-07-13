import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

export async function logPoolStats(req: NextRequest) {
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const duration = Date.now() - start;
    
    console.log(`[db-pool] Query latency: ${duration}ms`);
  } catch (error) {
    console.error("[db-pool] Stats logging failed:", error);
  }
}

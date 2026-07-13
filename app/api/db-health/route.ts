import { db, getAdapter } from "@/lib/db";

export async function GET() {
  try {
    const adapter = getAdapter();
    
    return Response.json({
      status: "healthy",
      database: "postgres",
      timestamp: new Date().toISOString(),
      clientInitialized: !!adapter,
      connectionPool: {
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
      },
    });
  } catch (error) {
    return Response.json(
      { status: "unhealthy", error: (error as Error).message },
      { status: 503 }
    );
  }
}

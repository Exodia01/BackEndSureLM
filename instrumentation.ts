let isShuttingDown = false;

export function register() {
  if (isShuttingDown) return;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`[shutdown] Received ${signal}, draining connections...`);

    const forceExitTimeout = setTimeout(() => {
      console.error("[shutdown] Force exit after timeout");
      process.exit(1);
    }, 10_000);

    try {
      const modId = "@/lib/db";
      const mod = await new Function("id", "return import(id)")(modId);
      await mod.db.$disconnect();
      console.log("[shutdown] Database connections closed");
    } catch (error) {
      console.error("[shutdown] Error closing database:", error);
    }

    clearTimeout(forceExitTimeout);
    console.log("[shutdown] Graceful shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

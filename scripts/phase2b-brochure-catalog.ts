import "dotenv/config";
import { db } from "../lib/db";

(async () => {
  const brochures = await db.brochure.findMany({
    orderBy: { basename: "asc" },
    select: {
      id: true,
      basename: true,
      originalName: true,
      status: true,
      versionNum: true,
      totalPages: true,
    },
  });
  const chunkCounts = await db.chunk.groupBy({
    by: ["brochureId"],
    _count: { _all: true },
  });
  const map = new Map(chunkCounts.map((c) => [c.brochureId, c._count._all]));
  const out = brochures.map((b) => ({
    ...b,
    chunkCount: map.get(b.id) ?? 0,
  }));
  console.log(JSON.stringify(out, null, 1));
})();
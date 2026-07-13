import { db } from "./lib/db"

async function count() {
  const result: any[] = await db.$queryRaw`SELECT COUNT(*) as c FROM "Chunk"`
  console.log("Chunk count:", result[0].c)
}

count()

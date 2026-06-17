import "dotenv/config";
import { db } from "./lib/db";

async function testDB() {
  console.log("Testing DB connection...");
  try {
    const result = await db.$queryRaw`SELECT 1`;
    console.log("DB OK:", result);
  } catch (error) {
    console.error("DB Error:", error);
    process.exit(1);
  }
}

testDB();

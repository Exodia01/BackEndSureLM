import dotenv from "dotenv";

dotenv.config();

process.env.DATABASE_URL = "postgresql://admin:[REDACTED-CREDENTIAL]@localhost:5432/surelm";

console.log("BEFORE import - DATABASE_URL:", process.env.DATABASE_URL);

import { db } from "../lib/db.ts";

console.log("AFTER import - DATABASE_URL:", process.env.DATABASE_URL);

try {
  const result = await db.$queryRaw`SELECT 1`;
  console.log("SUCCESS: Database connection works!", result);
} catch (error) {
  console.error("ERROR:", error.message);
  console.error("Full error:", error);
}

import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MIGRATION_SQL = readFileSync(
  join(
    __dirname,
    "..",
    "prisma",
    "migrations",
    "20260816120000_phase2f_frozen_requirement_fields",
    "migration.sql"
  ),
  "utf8"
);

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  await c.query("BEGIN");
  try {
    await c.query(MIGRATION_SQL);
    await c.query("COMMIT");
    console.log("Migration applied.");
  } catch (e: unknown) {
    await c.query("ROLLBACK");
    console.error("Migration failed, rolled back:", (e as Error).message);
    await c.end();
    process.exit(1);
  }

  const cols = await c.query(
    `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
      WHERE table_name = 'RequirementDefinition'
        AND column_name IN ('category','documentType','isMandatory','displayOrder','onMaxAttemptsMessage')
      ORDER BY column_name`
  );
  console.log("New columns:", JSON.stringify(cols.rows, null, 1));

  const cnt = await c.query('SELECT count(*) AS n FROM "RequirementDefinition"');
  console.log("RequirementDefinition row count:", cnt.rows[0].n);

  await c.end();
})();
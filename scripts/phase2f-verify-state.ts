import "dotenv/config";
import { db } from "../lib/db";
import { EXTRACTION_MODEL } from "../lib/ai/extractRequirements";

(async () => {
  const counts = {
    policies: await db.policy.count(),
    policyVersions: await db.policyVersion.count(),
    policyBrochures: await db.policyBrochure.count(),
    requirementDefinitions: await db.requirementDefinition.count(),
    requirementSnapshots: await db.requirementSnapshot.count(),
    brochures: await db.brochure.count(),
    chunks: await db.chunk.count({ where: { brochureId: { not: null } } }),
  };
  const cols = await db.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='RequirementDefinition' AND column_name IN ('category','documentType','isMandatory','displayOrder','onMaxAttemptsMessage') ORDER BY column_name`
  );
  console.log("DB counts:", JSON.stringify(counts));
  console.log(
    "New columns present:",
    JSON.stringify((cols as { column_name: string }[]).map((c) => c.column_name))
  );
  console.log("EXTRACTION_MODEL:", EXTRACTION_MODEL);
})();
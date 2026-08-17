import "dotenv/config";
import { db } from "../lib/db";

const P = console.log;
const FAIL = (...a: unknown[]) => P("FAIL:", ...a);
const OK = (...a: unknown[]) => P("OK:", ...a);
let checks = 0, fails = 0;

function check(cond: boolean, label: string, detail = "") {
  checks++;
  if (cond) OK(label);
  else { fails++; FAIL(label, detail); }
}

(async () => {
  // 1. Top-level counts
  const [policyCount, linkCount, reqTotal, approvedTotal, draftTotal, versionCount, snapshotCount, brochureCount, chunkCount] =
    await Promise.all([
      db.policy.count(),
      db.policyBrochure.count(),
      db.requirementDefinition.count(),
      db.requirementDefinition.count({ where: { isDraft: false } }),
      db.requirementDefinition.count({ where: { isDraft: true } }),
      db.policyVersion.count(),
      db.requirementSnapshot.count(),
      db.brochure.count(),
      db.chunk.count(),
    ]);
  P(`\nCounts: policies=${policyCount} links=${linkCount} reqs=${reqTotal} approved=${approvedTotal} drafts=${draftTotal} versions=${versionCount} snapshots=${snapshotCount} brochures=${brochureCount} chunks=${chunkCount}`);
  check(policyCount === 27, "policies == 27", `got ${policyCount}`);
  check(linkCount === 27, "policyBrochure links == 27", `got ${linkCount}`);
  check(draftTotal === 0, "no drafts remain after approval", `got ${draftTotal}`);

  // 2. Per-policy: exactly one link, one version, one snapshot, correct linkage, no duplicates
  const policies = await db.policy.findMany({ orderBy: { name: "asc" } });
  let policiesWithVersion = 0;
  for (const p of policies) {
    const links = await db.policyBrochure.count({ where: { policyId: p.id } });
    const versions = await db.policyVersion.findMany({ where: { policyId: p.id }, include: { snapshot: true } });
    const drafts = await db.requirementDefinition.count({ where: { policyId: p.id, isDraft: true } });
    const approved = await db.requirementDefinition.count({ where: { policyId: p.id, isDraft: false } });
    if (versions.length > 0) {
      policiesWithVersion++;
      check(links === 1, `link==1 for ${p.name}`, `got ${links}`);
      check(versions.length === 1, `version==1 for ${p.name}`, `got ${versions.length}`);
      check(versions[0].label === "v1", `label v1 for ${p.name}`);
      check(drafts === 0, `no drafts for ${p.name}`);
      check(approved > 0, `approved>0 for ${p.name}`, `got ${approved}`);
      const snap = versions[0].snapshot;
      if (snap) {
        check(snap.policyVersionId === versions[0].id, `snapshot->version for ${p.name}`);
        check(snap.policyId === p.id, `snapshot->policy for ${p.name}`);
        check(p.currentVersionId === versions[0].id, `currentVersion pointer for ${p.name}`);
      } else {
        fails++; FAIL(`snapshot exists for ${p.name}`);
      }
      const nonDraftInSnap = snap ? (await db.requirementDefinition.count({ where: { id: { in: (snap.requirements as unknown as { id: string }[])?.map((r) => r.id) ?? [] }, isDraft: true } })) : -1;
      check(nonDraftInSnap === 0, `no drafts in snapshot for ${p.name}`, `got ${nonDraftInSnap}`);
    }
    // duplicate requirement check
    const dupKeys = (await db.$queryRawUnsafe(
      `SELECT "ruleKey", COUNT(*) as c FROM "RequirementDefinition" WHERE "policyId" = '${p.id}' AND "isDraft" = false GROUP BY "ruleKey" HAVING COUNT(*) > 1`
    )) as { ruleKey: string; c: number }[];
    check(dupKeys.length === 0, `no duplicate approved ruleKeys for ${p.name}`, JSON.stringify(dupKeys));
  }
  check(policiesWithVersion === 27, "policies with published version == 27", `got ${policiesWithVersion}`);

  // 3. Provenance verification on every approved requirement
  const reqs = await db.requirementDefinition.findMany({ where: { isDraft: false } });
  let provOk = 0, provBad = 0;
  const models = new Set<string>();
  for (const r of reqs) {
    const prov = r.provenance as { extraction_model?: string; source_brochure_id?: string } | null;
    if (prov && prov.extraction_model === "qwen2.5:7b" && prov.source_brochure_id && r.sourceChunkIds?.length) provOk++;
    else { provBad++; if (prov?.extraction_model) models.add(prov.extraction_model); }
  }
  check(provOk === reqs.length, "provenance complete + qwen2.5:7b on all approved reqs", `ok=${provOk} bad=${provBad} models=${[...models]}`);

  // 4. Orphan/duplicate links
  const orphans = (await db.$queryRawUnsafe(
    `SELECT lb."brochureId", COUNT(*) as c FROM "PolicyBrochure" lb LEFT JOIN "Brochure" b ON b.id = lb."brochureId" WHERE b.id IS NULL GROUP BY lb."brochureId"`
  )) as { brochureId: string; c: number }[];
  check(orphans.length === 0, "no orphan brochure links", JSON.stringify(orphans));

  // 5. Qdrant vector count must still be 486
  const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6334";
  const collResp = await fetch(`${qdrantUrl}/collections/policy_knowledge`);
  const collData = await collResp.json();
  const qdrantPoints = collData.result?.points_count ?? -1;
  check(qdrantPoints === 486, "Qdrant policy_knowledge points == 486", `got ${qdrantPoints}`);

  P(`\nChecks: ${checks} total, ${fails} failed`);
  await db.$disconnect();
})();
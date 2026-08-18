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

interface SnapshotRequirement {
  id?: string | null;
  ruleKey: string;
  label: string;
  validationRules?: Record<string, unknown> | null;
}

(async () => {
  P("=== PHASE 2I STEP 2: AUTHORITATIVE DATA AUDIT ===");

  const policies = await db.policy.findMany({ orderBy: { name: "asc" } });

  let crossPolicyRefs = 0;
  let snapshotMismatches = 0;
  let arrayTermPolicies = 0;
  let scalarTermPolicies = 0;
  let scalarOrArrayTerms = 0;

  for (const p of policies) {
    const approved = await db.requirementDefinition.findMany({
      where: { policyId: p.id, isDraft: false },
      orderBy: { ruleKey: "asc" },
    });
    const version = p.currentVersionId
      ? await db.policyVersion.findUnique({
          where: { id: p.currentVersionId },
          include: { snapshot: true },
        })
      : null;
    if (!version?.snapshot) {
      fails++; FAIL(`snapshot missing for ${p.name}`);
      continue;
    }
    const snapReqs = version.snapshot.requirements as unknown as SnapshotRequirement[];

    // 2a. Cross-policy snapshot isolation: every requirement ID referenced by
    // the snapshot must belong to this policy's OWN approved set.
    const approvedIds = new Set(approved.map((r) => r.id));
    const foreignIds: string[] = [];
    for (const r of snapReqs) {
      if (r.id && !approvedIds.has(r.id)) foreignIds.push(r.id);
    }
    if (foreignIds.length > 0) {
      crossPolicyRefs += foreignIds.length;
      fails++;
      FAIL(`cross-policy snapshot refs for ${p.name}: ${foreignIds.join(", ")}`);
    } else {
      OK(`no cross-policy snapshot refs for ${p.name}`);
    }

    // 2b. Snapshot == approved set (exact match both directions).
    const snapIds = new Set(snapReqs.map((r) => r.id).filter(Boolean) as string[]);
    const missing = approved.filter((r) => !snapIds.has(r.id)).map((r) => r.ruleKey);
    const extra = snapReqs.filter((r) => r.id && !approvedIds.has(r.id)).map((r) => r.ruleKey);
    if (missing.length === 0 && extra.length === 0) {
      OK(`snapshot == approved set for ${p.name} (${approved.length})`);
    } else {
      snapshotMismatches++;
      fails++;
      FAIL(`snapshot != approved set for ${p.name}`, `missing=[${missing}] extra=[${extra}]`);
    }

    // 2c. policyTermYears scalar + array flow into BOTH the definition and the
    // frozen snapshot, unchanged.
    for (const req of approved) {
      const rules = req.validationRules as Record<string, unknown> | null;
      const val = rules?.policyTermYears;
      if (val === undefined || val === null) continue;
      scalarOrArrayTerms++;
      const isArray = Array.isArray(val);
      const isNumber = typeof val === "number";
      if (!(isArray || isNumber)) {
        fails++;
        FAIL(`policyTermYears bad type for ${p.name} ${req.ruleKey}`, String(val));
        continue;
      }
      if (isArray) {
        arrayTermPolicies++;
        check(Array.isArray(val) && (val as number[]).every((n) => Number.isInteger(n)), `array policyTermYears ok for ${p.name} ${req.ruleKey}`, JSON.stringify(val));
      } else {
        scalarTermPolicies++;
        check(Number.isInteger(val), `scalar policyTermYears ok for ${p.name} ${req.ruleKey}`, String(val));
      }
      // The frozen snapshot must carry the exact same value.
      const snapReq = snapReqs.find((s) => s.id === req.id);
      const snapVal = snapReq?.validationRules?.policyTermYears;
      check(
        JSON.stringify(snapVal) === JSON.stringify(val),
        `snapshot policyTermYears matches for ${p.name} ${req.ruleKey}`,
        `def=${JSON.stringify(val)} snap=${JSON.stringify(snapVal)}`
      );
    }
  }

  check(crossPolicyRefs === 0, "no cross-policy snapshot references anywhere", `found ${crossPolicyRefs}`);
  check(snapshotMismatches === 0, "snapshot == approved set for every policy", `mismatches=${snapshotMismatches}`);
  check(arrayTermPolicies >= 2, ">=2 policies with ARRAY policyTermYears", `found ${arrayTermPolicies}`);
  check(scalarTermPolicies >= 2, ">=2 policies with SCALAR policyTermYears", `found ${scalarTermPolicies}`);
  check(scalarOrArrayTerms > 0, "policyTermYears present across corpus", `found ${scalarOrArrayTerms} terms`);

  // 2d. RequirementSnapshot immutability at the code level: no service in the
  // application lifecycle updates or deletes a snapshot (CREATE only, inside
  // publishPolicyVersion's transaction). The ONLY delete path is the admin-only
  // DELETE /api/policies/[id] hard-delete of a whole policy, which is
  // E5-hardened (blocked when any PolicyIssuance references the policy name).
  const { execSync } = await import("child_process");
  const runRg = (pattern: string): string => {
    try {
      return execSync(pattern, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return "";
    }
  };
  const updates = runRg(`rg -l "requirementSnapshot\\.(update|updateMany)" --glob "!node_modules" .`);
  check(updates.length === 0, "no RequirementSnapshot update/updateMany anywhere", updates || "none");
  const deletes = runRg(`rg -l "requirementSnapshot\\.(delete|deleteMany)" --glob "!node_modules" --glob "!scripts/phase2i-data-audit.ts" .`);
  const deleteSites = deletes ? deletes.split(/\r?\n/) : [];
  const onlyAdminDelete =
    deleteSites.every((f) => f.includes("app\\api\\policies") || f.includes("app/api/policies")) &&
    deleteSites.length >= 1;
  check(onlyAdminDelete, "snapshot delete only in admin policy-delete route", deletes || "none");

  P(`\nChecks: ${checks} total, ${fails} failed`);
  await db.$disconnect();
})();
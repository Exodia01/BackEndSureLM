import "dotenv/config";
import { db } from "../lib/db";
import {
  classifyRequirement,
  type RequirementClassification,
} from "../lib/applications/checklist";

const P = console.log;

(async () => {
  P("=== PHASE 2J: REQUIREMENT TAXONOMY AUDIT ===\n");

  const policies = await db.policy.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      currentVersionId: true,
    },
  });

  type ReqRow = {
    id: string;
    ruleKey: string;
    label: string;
    description: string | null;
    category: string | null;
    isMandatory: boolean | null;
    validationRules: unknown;
    policyId: string;
  };

  const allReqs: ReqRow[] = await db.requirementDefinition.findMany({
    where: { isDraft: false },
    orderBy: [{ policyId: "asc" }, { ruleKey: "asc" }],
    select: {
      id: true,
      ruleKey: true,
      label: true,
      description: true,
      category: true,
      isMandatory: true,
      validationRules: true,
      policyId: true,
    },
  });

  P(`Total approved RequirementDefinitions: ${allReqs.length}\n`);

  const counts: Record<RequirementClassification, number> = {
    CUSTOMER_EVIDENCE: 0,
    POLICY_KNOWLEDGE: 0,
    UNCLASSIFIED: 0,
  };

  const byPolicy: Record<
    string,
    {
      name: string;
      isActive: boolean;
      hasVersion: boolean;
      total: number;
      byClass: Record<RequirementClassification, number>;
      evidenceReqs: ReqRow[];
      unclassifiedReqs: ReqRow[];
    }
  > = {};

  for (const p of policies) {
    byPolicy[p.id] = {
      name: p.name,
      isActive: p.isActive,
      hasVersion: p.currentVersionId !== null,
      total: 0,
      byClass: { CUSTOMER_EVIDENCE: 0, POLICY_KNOWLEDGE: 0, UNCLASSIFIED: 0 },
      evidenceReqs: [],
      unclassifiedReqs: [],
    };
  }

  const ruleKeySummary: Record<
    string,
    {
      classification: RequirementClassification;
      count: number;
      policies: string[];
      sampleLabel: string;
    }
  > = {};

  for (const req of allReqs) {
    const cls = classifyRequirement(req.ruleKey);
    counts[cls]++;

    const pol = byPolicy[req.policyId];
    if (pol) {
      pol.total++;
      pol.byClass[cls]++;
      if (cls === "CUSTOMER_EVIDENCE") pol.evidenceReqs.push(req);
      if (cls === "UNCLASSIFIED") pol.unclassifiedReqs.push(req);
    }

    if (!ruleKeySummary[req.ruleKey]) {
      ruleKeySummary[req.ruleKey] = {
        classification: cls,
        count: 0,
        policies: [],
        sampleLabel: req.label,
      };
    }
    ruleKeySummary[req.ruleKey].count++;
    if (pol && !ruleKeySummary[req.ruleKey].policies.includes(pol.name)) {
      ruleKeySummary[req.ruleKey].policies.push(pol.name);
    }
  }

  P("=== CLASSIFICATION COUNTS ===");
  P(`  CUSTOMER_EVIDENCE: ${counts.CUSTOMER_EVIDENCE}`);
  P(`  POLICY_KNOWLEDGE:  ${counts.POLICY_KNOWLEDGE}`);
  P(`  UNCLASSIFIED:      ${counts.UNCLASSIFIED}`);
  P("");

  P("=== RULE KEY SUMMARY ===");
  const sortedKeys = Object.entries(ruleKeySummary).sort(
    (a, b) => b[1].count - a[1].count
  );
  for (const [key, info] of sortedKeys) {
    const flag =
      info.classification === "UNCLASSIFIED" ? " *** ARTIFACT/UNCLASSIFIED" : "";
    P(
      `  ${key.padEnd(35)} [${info.classification.padEnd(18)}] count=${
        info.count
      } policies=${info.policies.length}${flag}`
    );
    P(`    label: ${info.sampleLabel}`);
  }
  P("");

  P("=== PER-POLICY SUMMARY ===");
  const issuable: string[] = [];
  const evidenceBlocked: string[] = [];
  const artifactBlocked: string[] = [];

  for (const p of policies) {
    const info = byPolicy[p.id];
    const evCount = info.byClass.CUSTOMER_EVIDENCE;
    const unCount = info.byClass.UNCLASSIFIED;
    const pkCount = info.byClass.POLICY_KNOWLEDGE;
    const status = !info.hasVersion
      ? "NO_VERSION"
      : unCount > 0
      ? "BLOCKED_ARTIFACTS"
      : evCount > 0
      ? "EVIDENCE_REQUIRED"
      : "ISSUABLE";

    if (status === "ISSUABLE") issuable.push(info.name);
    if (status === "EVIDENCE_REQUIRED") evidenceBlocked.push(info.name);
    if (status === "BLOCKED_ARTIFACTS") artifactBlocked.push(info.name);

    P(
      `  ${info.name.padEnd(35)} total=${String(info.total).padEnd(3)} PK=${String(
        pkCount
      ).padEnd(3)} CE=${String(evCount).padEnd(3)} UN=${String(unCount).padEnd(
        3
      )} → ${status}`
    );

    if (info.evidenceReqs.length > 0) {
      for (const r of info.evidenceReqs) {
        P(`    ↳ CE: ${r.ruleKey} (${r.label})`);
      }
    }
    if (info.unclassifiedReqs.length > 0) {
      for (const r of info.unclassifiedReqs) {
        P(`    ↳ UN: ${r.ruleKey} (${r.label})`);
      }
    }
  }
  P("");

  P("=== ISSUANCE SIMULATION RESULT ===");
  P(`  Issuable (no evidence or artifacts):        ${issuable.length}`);
  for (const n of issuable) P(`    - ${n}`);
  P(`  Evidence required (customer docs needed):    ${evidenceBlocked.length}`);
  for (const n of evidenceBlocked) P(`    - ${n}`);
  P(`  Blocked by artifacts (UNCLASSIFIED):         ${artifactBlocked.length}`);
  for (const n of artifactBlocked) P(`    - ${n}`);
  P("");

  P("=== ARTIFACT/UNCLASSIFIED DETAILS ===");
  const unclassifiedReqs = allReqs.filter(
    (r) => classifyRequirement(r.ruleKey) === "UNCLASSIFIED"
  );
  if (unclassifiedReqs.length === 0) {
    P("  None found.");
  } else {
    for (const r of unclassifiedReqs) {
      const pol = byPolicy[r.policyId];
      P(
        `  ${r.ruleKey} → ${r.label} (policy: ${pol?.name ?? r.policyId})`
      );
      P(`    description: ${r.description ?? "(none)"}`);
    }
  }
  P("");

  P("=== VERDICT ===");
  const allIssuable =
    issuable.length +
    evidenceBlocked.length +
    artifactBlocked.length ===
    policies.length;
  P(`  Total policies: ${policies.length}`);
  P(`  All classified: ${allIssuable}`);
  P(
    `  Phase 2J outcome: ${issuable.length} policies issuable without evidence, ${evidenceBlocked.length} require customer evidence, ${artifactBlocked.length} blocked by unclassified artifacts`
  );
  P(
    `  Fail-closed artifacts: ${
      unclassifiedReqs.length
    } requirements across ${artifactBlocked.length} policies`
  );

  await db.$disconnect();
})().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

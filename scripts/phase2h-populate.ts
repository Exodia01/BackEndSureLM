import "dotenv/config";
import { db } from "../lib/db";
import {
  extractRequirements,
  approveRequirement,
} from "../lib/ai/extractRequirements";
import { publishPolicyVersion } from "../lib/ai/services/policyVersioning";

// ---------------------------------------------------------------------------
// Phase 2H — Authoritative Policy chain population (ADMIN workflow, scripted).
//
// This script drives the EXACT same workflow functions used by the ADMIN API
// routes:
//   - Policy creation        -> db.policy.create      (same as POST /api/policies)
//   - PolicyBrochure link    -> db.policyBrochure.create (same as POST /api/policies/[id]/brochures)
//   - Requirement extraction -> extractRequirements() (same as POST /api/policies/[id]/requirements)
//   - Requirement approval   -> approveRequirement()  (same as POST .../approve, approvedBy="admin")
//   - Version publish        -> publishPolicyVersion()(same as POST /api/policies/[id]/versions)
//
// No business logic is duplicated: the workflow functions above are reused
// verbatim. Extraction provenance is produced by extractRequirements() using
// EXTRACTION_MODEL from .env (= qwen2.5:7b). No OCR, no re-ingestion, no
// Qdrant writes. Drafts are verified before approval; policies whose
// extraction is empty/malformed are STOPPED and reported, not patched.
// ---------------------------------------------------------------------------

const PROVIDER = "Kotak Mahindra Life Insurance Company Ltd";
const APPROVED_BY = "admin";

interface PolicySpec {
  pdf: string;
  brochureId: string;
  name: string;
  uin: string;
  category: string;
}

const SPECS: PolicySpec[] = [
  { pdf: "e4a48981ca8b291a7fbb13ec92b6e1c1.pdf", brochureId: "cmsuhu7qp00008shwjpvatllv", name: "Kotak Assured Savings Plan", uin: "107N081V04", category: "Non-Participating Endowment Assurance" },
  { pdf: "0ceed5fed1ff5bfdb880724c4365d451.pdf", brochureId: "cmsuhucvr000f8shweaf2872h", name: "Kotak Assured Pension", uin: "107N123V05", category: "Annuity (Non-Linked Non-Participating)" },
  { pdf: "138eacc67aae28caec8d79a53f1b7ec5.pdf", brochureId: "cmsuhuhqt001h8shwb1pbvfam", name: "Kotak Fortune Maximiser", uin: "107N125V02", category: "Participating Savings" },
  { pdf: "2f7a7c10e70fcdd560f5fa1e0c7104b7.pdf", brochureId: "cmsuhumhs002g8shwu2evos16", name: "Kotak Wealth Optima Plan", uin: "107L118V02", category: "Unit-Linked Endowment (Non-Par)" },
  { pdf: "d4853dcd6adb711d9d9d2e0f3b6bfd2f.pdf", brochureId: "cmsuhuojk00328shwjnkyl1s4", name: "Kotak e-Term", uin: "107N129V01", category: "Pure Risk Premium (Non-Linked Non-Par)" },
  { pdf: "8516e79796940f38b95b6fc3ce8d4de0.pdf", brochureId: "cmsuhuqid003p8shwbv10hbxp", name: "Kotak Platinum", uin: "107L067V06", category: "Unit-Linked Endowment (Non-Par)" },
  { pdf: "029338920108e96d1a6f0454f335dfe9.pdf", brochureId: "cmsuhut43004f8shwzxw3kr9w", name: "Kotak HealthShield", uin: "107N105V01", category: "Health (Fixed Benefit, Non-Linked)" },
  { pdf: "732ecf17c4283768808f6152b665761f.pdf", brochureId: "cmsuhuwoc005j8shwteuvxo78", name: "Kotak Single Invest Plus", uin: "107L075V02", category: "Unit-Linked Single Premium Joint Life" },
  { pdf: "2f129dc39060dfb8e405ebc119902d45.pdf", brochureId: "cmsuhuybt00618shw8kjayeio", name: "Kotak Ace Investment", uin: "107L064V05", category: "Unit-Linked (Non-Par)" },
  { pdf: "65759500fb0d507facc06261c8ada8e3.pdf", brochureId: "cmsuhv0qq006o8shwdb40d5bl", name: "Kotak Assured Income Accelerator", uin: "107N089V03", category: "Anticipated Endowment (Guaranteed Income)" },
  { pdf: "55acfbbcdb3ced3da175828d2209b160.pdf", brochureId: "cmsuhv1xy00758shw3wq30tom", name: "Kotak Classic Endowment Plan", uin: "107N082V02", category: "Participating Savings" },
  { pdf: "c03da4f713658824c3e6f92fc1c6fc01.pdf", brochureId: "cmsuhv35o007k8shw0rovlvl3", name: "Kotak e-Invest", uin: "107L121V01", category: "Unit-Linked Endowment (Non-Par)" },
  { pdf: "717a34255f2e86b530c38c9af6ed896b.pdf", brochureId: "cmsuhv6if008k8shwkdtxwu93", name: "Kotak Guaranteed Savings Plan", uin: "107N100V03", category: "Non-Linked Non-Participating Endowment" },
  { pdf: "ab8802d97e9abb7f9f1d0a15f9e7b3b3.pdf", brochureId: "cmsuhv7uf00918shwnfnxyih7", name: "Kotak Lifetime Income Plan", uin: "107N103V11", category: "Immediate Annuity" },
  { pdf: "17f7d37582d002b596a2bc7a96398d2a.pdf", brochureId: "cmsuhv8u8009f8shwbcf9euep", name: "Kotak Premier Endowment Plan", uin: "107N079V02", category: "Participating Endowment" },
  { pdf: "23c513b099b1696770c845469ec6944a.pdf", brochureId: "cmsuhva17009u8shwqsv6am11", name: "Kotak Premier Life Plan", uin: "107N096V03", category: "Participating Whole Life" },
  { pdf: "80864dca028195d7092debfa335afc6e.pdf", brochureId: "cmsuhvbre00ad8shw1efvuu6g", name: "Kotak Sampoorn Bima", uin: "107N092V02", category: "Micro Insurance" },
  { pdf: "b5af7c2b8fb43c873821ef55fcd97be5.pdf", brochureId: "cmsuhvckf00al8shw5bptp692", name: "Kotak Saral Pension", uin: "107N124V01", category: "Immediate Annuity (Single Premium)" },
  { pdf: "ef33cb3233fe3e53ec7307dee2ccb237.pdf", brochureId: "cmsuhveg700b48shwov4fsppi", name: "Kotak Single Invest Advantage", uin: "107L065V04", category: "Unit-Linked Single Premium" },
  { pdf: "5e425760352fd62a759cc600662a716d.pdf", brochureId: "cmsuhvga500bp8shwp9cqjbl6", name: "Kotak SmartLife", uin: "107N102V02", category: "Limited Pay Participating" },
  { pdf: "1c57c1c62381cda6cdcff2120f16ddac.pdf", brochureId: "cmsuhvhib00c58shwavzgq7hw", name: "Kotak TULIP", uin: "107L131V01", category: "Unit-Linked Endowment (Non-Par)" },
  { pdf: "a0bc2cbf43610a783b1c9ce65cd6e383.pdf", brochureId: "cmsuhvkgw00d58shwrmy4qzkw", name: "Kotak e-Term Plan", uin: "107N104V02", category: "Pure Protection (Non-Linked Non-Par)" },
  { pdf: "0416d739c338074f52bc16214e5782ba.pdf", brochureId: "cmsuhvmg700dr8shwi4y3bcij", name: "Kotak POS Bachat Bima", uin: "107N117V01", category: "Non-Linked Non-Participating Savings+Protection" },
  { pdf: "0e4e916e86f21e2ddde70c702d3c4801.pdf", brochureId: "cmsuhvnoq00e88shw5e1nkl0m", name: "Kotak Saral Jeevan Bima", uin: "107N120V01", category: "Pure Risk Premium" },
  { pdf: "f42896380673c9839d22e6869b0054e7.pdf", brochureId: "cmsuhvpae00eo8shw8s7z6036", name: "Kotak Premier MoneyBack", uin: "107N083V02", category: "MoneyBack (Savings cum Insurance)" },
  { pdf: "0889e5c90557c8fe40cf2c985099932b.pdf", brochureId: "cmsuhvqkp00f38shwgpaebhxz", name: "Kotak Premier Pension Plan", uin: "107N094V02", category: "Participating Pension" },
  { pdf: "afd3c9c99bb38f0a62b14787d6abfed9.pdf", brochureId: "cmsuhrloy000044hwfyp6qkbg", name: "Kotak Term Plan", uin: "107N005V05", category: "Term (Pure Protection)" },
];

interface PolicyResult {
  spec: PolicySpec;
  policyId?: string;
  linkId?: string;
  draftsCreated?: number;
  approved?: number;
  versionId?: string;
  snapshotId?: string;
  status: "OK" | "FAILED" | "STOPPED";
  error?: string;
  draftIssue?: string;
}

const ALLOWED_CATEGORIES = [
  "eligibility", "premium_payment", "death_benefit", "maturity_survival_benefit",
  "riders", "surrender_maturity", "policy_loan", "revival_lapse", "tax_benefits",
  "policy_features", "claims_conditions",
];

function verifyDrafts(drafts: any[], spec: PolicySpec): string | null {
  if (!Array.isArray(drafts) || drafts.length === 0) {
    return "extraction produced no requirements";
  }
  for (const d of drafts) {
    if (!d || typeof d !== "object") return "malformed requirement record";
    if (!d.ruleKey || typeof d.ruleKey !== "string") return "missing ruleKey";
    if (!d.label || typeof d.label !== "string") return "missing label";
    if (!d.description || typeof d.description !== "string") return "missing description";
    if (!ALLOWED_CATEGORIES.includes(d.category)) {
      return `unsupported category: ${d.category}`;
    }
    if (typeof d.confidence !== "number" || d.confidence < 0 || d.confidence > 1) {
      return "invalid confidence";
    }
    if (!["EXPLICIT", "INFERRED", "UNCERTAIN"].includes(d.extractionMode)) {
      return "invalid extractionMode";
    }
    if (d.validationRules === undefined || d.validationRules === null) {
      return "missing validationRules";
    }
    if (!d.provenance) return "missing provenance";
    if (d.provenance.source_brochure_id !== spec.brochureId) {
      return `provenance source_brochure_id mismatch: ${d.provenance.source_brochure_id}`;
    }
    if (d.provenance.extraction_model !== "qwen2.5:7b") {
      return `provenance extraction_model unexpected: ${d.provenance.extraction_model}`;
    }
    if (!Array.isArray(d.sourceChunkIds) || d.sourceChunkIds.length === 0) {
      return "no sourceChunkIds";
    }
  }
  return null;
}

async function processPolicy(spec: PolicySpec): Promise<PolicyResult> {
  const result: PolicyResult = { spec, status: "OK" };

  // --- Pre-create log (user requirement #10) -------------------------------
  console.log("\n============================================================");
  console.log(`PDF:      ${spec.pdf}`);
  console.log(`Brochure: ${spec.brochureId}`);
  console.log(`Policy:   ${spec.name}`);
  console.log(`UIN:      ${spec.uin}`);
  console.log(`Category: ${spec.category}`);
  console.log(`Provider: ${PROVIDER}`);
  console.log("------------------------------------------------------------");

  try {
    // Idempotent lookup: a policy already carrying a current version is DONE.
    const existing = await db.policy.findFirst({ where: { name: spec.name } });
    if (existing && existing.currentVersionId) {
      result.policyId = existing.id;
      result.status = "OK";
      const link = await db.policyBrochure.findUnique({
        where: { policyId_brochureId: { policyId: existing.id, brochureId: spec.brochureId } },
      });
      if (link) result.linkId = link.id;
      const approvedCount = await db.requirementDefinition.count({
        where: { policyId: existing.id, isDraft: false },
      });
      result.approved = approvedCount;
      const version = await db.policyVersion.findUnique({
        where: { id: existing.currentVersionId! },
        include: { snapshot: true },
      });
      result.versionId = version?.id;
      result.snapshotId = version?.snapshot?.id;
      console.log(`[SKIP] Already complete:  ${existing.id} (v=${result.versionId}, snap=${result.snapshotId}, approved=${approvedCount})`);
      return result;
    }

    // 1. Policy creation (identical to POST /api/policies) — reuse if exists
    let policy = existing;
    if (!policy) {
      policy = await db.policy.create({
        data: {
          name: spec.name,
          provider: PROVIDER,
          category: spec.category,
          allowReuse: false,
        },
      });
      console.log(`[1] Policy created:        ${policy.id}`);
    } else {
      console.log(`[1] Policy reused:         ${policy.id}`);
    }
    result.policyId = policy.id;

    // 2. PolicyBrochure link (identical to POST /api/policies/[id]/brochures)
    const existingLink = await db.policyBrochure.findUnique({
      where: { policyId_brochureId: { policyId: policy.id, brochureId: spec.brochureId } },
    });
    let link = existingLink;
    if (!link) {
      link = await db.policyBrochure.create({
        data: { policyId: policy.id, brochureId: spec.brochureId },
      });
      console.log(`[2] Brochure linked:       ${link.id}`);
    } else {
      console.log(`[2] Brochure already linked: ${link.id}`);
    }
    result.linkId = link.id;

    // 3. Requirement extraction -> drafts (identical to POST .../requirements)
    const extraction = await extractRequirements(spec.brochureId, policy.id);
    result.draftsCreated = extraction.draftsCreated;
    console.log(`[3] Extraction:            ${extraction.draftsCreated} draft(s)`);

    const drafts = await db.requirementDefinition.findMany({
      where: { policyId: policy.id, brochureId: spec.brochureId, isDraft: true },
      orderBy: { ruleKey: "asc" },
    });
    const issue = verifyDrafts(drafts, spec);
    if (issue) {
      result.status = "STOPPED";
      result.draftIssue = issue;
      console.error(`[X] STOPPED policy (draft verification failed): ${issue}`);
      return result;
    }

    // 4. Approve every draft (identical to POST .../requirements/[id]/approve)
    let approved = 0;
    for (const d of drafts) {
      await approveRequirement(d.id, APPROVED_BY);
      approved++;
    }
    result.approved = approved;
    console.log(`[4] Approved:              ${approved}/${drafts.length}`);

    // 5. Publish version + immutable snapshot (identical to POST .../versions)
    const { version, snapshot } = await publishPolicyVersion({
      policyId: policy.id,
      label: "v1",
      publishedBy: APPROVED_BY,
    });
    result.versionId = version.id;
    result.snapshotId = snapshot.id;
    console.log(`[5] Version published:     ${version.id} (snapshot ${snapshot.id})`);

    return result;
  } catch (error) {
    result.status = "FAILED";
    result.error = error instanceof Error ? error.message : String(error);
    console.error(`[X] FAILED policy ${spec.name}: ${result.error}`);
    return result;
  }
}

async function main() {
  console.log(`Phase 2H population — ${SPECS.length} policies, model=${process.env.EXTRACTION_MODEL || "(unset)"}`);

  const results: PolicyResult[] = [];
  for (const spec of SPECS) {
    const r = await processPolicy(spec);
    results.push(r);
  }

  const ok = results.filter((r) => r.status === "OK");
  const stopped = results.filter((r) => r.status === "STOPPED");
  const failed = results.filter((r) => r.status === "FAILED");

  console.log("\n\n==================== RUN SUMMARY ====================");
  console.log(`Policies OK:       ${ok.length}`);
  console.log(`Policies STOPPED:  ${stopped.length}${stopped.length ? " -> " + stopped.map((r) => `${r.spec.name} (${r.draftIssue})`).join("; ") : ""}`);
  console.log(`Policies FAILED:   ${failed.length}${failed.length ? " -> " + failed.map((r) => `${r.spec.name} (${r.error})`).join("; ") : ""}`);
  console.log(`Total drafted:     ${results.reduce((s, r) => s + (r.draftsCreated ?? 0), 0)}`);
  console.log(`Total approved:    ${results.reduce((s, r) => s + (r.approved ?? 0), 0)}`);

  // Machine-readable result for post-run verification
  console.log("\nRESULT_JSON=" + JSON.stringify(results));
  await db.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal:", err);
  await db.$disconnect();
  process.exit(1);
});
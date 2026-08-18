import "dotenv/config";
import { generateRecommendations } from "../lib/ai/generateRecommendations";
import { db } from "../lib/db";

const P = console.log;

// 6-category matrix: realistic customer profiles. Each case lists the policies
// that SHOULD be eligible candidates (from the authoritative corpus), to check
// the engine never invents names or recommends outside its evidence.
const CATEGORIES: Array<{
  id: string;
  query: string;
  context: Record<string, unknown>;
  expectsSuitability: boolean;
  expectedPlausible: string[]; // canonical names that are plausible for this profile
}> = [
  {
    id: "term",
    query: "Which pure protection term plan should I buy?",
    context: { age: 30, income: 800000, familySize: 3, goals: ["financial protection for family"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak Term Plan", "Kotak e-Term", "Kotak e-Term Plan"],
  },
  {
    id: "savings_endowment",
    query: "I want guaranteed savings and a maturity payout.",
    context: { age: 35, income: 1500000, familySize: 2, goals: ["guaranteed savings", "long term wealth"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak Guaranteed Savings Plan", "Kotak Assured Savings Plan", "Kotak Classic Endowment Plan", "Kotak Premier Endowment Plan"],
  },
  {
    id: "pension_annuity",
    query: "I am retiring soon and need a pension plan with regular income.",
    context: { age: 55, income: 2000000, familySize: 2, goals: ["retirement income", "annuity"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak Assured Pension", "Kotak Premier Pension Plan", "Kotak Saral Pension", "Kotak Lifetime Income Plan"],
  },
  {
    id: "ulip",
    query: "I want market-linked wealth creation over 15 years.",
    context: { age: 28, income: 1200000, familySize: 1, goals: ["wealth creation", "market linked"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak Wealth Optima Plan", "Kotak TULIP", "Kotak e-Invest", "Kotak Single Invest Plus", "Kotak Single Invest Advantage"],
  },
  {
    id: "health",
    query: "I need a health plan with critical illness cover.",
    context: { age: 40, income: 1000000, familySize: 4, goals: ["health cover", "critical illness"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak HealthShield"],
  },
  {
    id: "micro_insurance",
    query: "I want an affordable micro insurance policy with low premium.",
    context: { age: 30, income: 250000, familySize: 4, goals: ["affordable cover", "micro insurance"] },
    expectsSuitability: true,
    expectedPlausible: ["Kotak Sampoorn Bima", "Kotak POS Bachat Bima", "Kotak Saral Jeevan Bima"],
  },
];

(async () => {
  P("=== PHASE 2I STEP 4: RECOMMENDATION VALIDATION (6-CATEGORY MATRIX) ===\n");

  // Canonical name set from the DB — the ground truth for "no fabricated names".
  const policies = await db.policy.findMany({ select: { id: true, name: true, isActive: true, currentVersionId: true } });
  const canonicalById = new Map(policies.map((p) => [p.id, p.name]));
  const canonicalNames = new Set(policies.map((p) => p.name));
  P(`Canonical policies in DB: ${policies.length}\n`);

  let totalRecommendations = 0;
  let fabricatedNames = 0;
  let inventedIds = 0;
  let noEvidenceCases = 0;
  let missingRequirements = 0;

  for (const cat of CATEGORIES) {
    P(`--- ${cat.id.toUpperCase()} ---`);
    const result = await generateRecommendations(cat.query, {
      age: cat.context.age as number,
      income: cat.context.income as number,
      familySize: cat.context.familySize as number,
      goals: cat.context.goals as string[],
    });

    if (result.insufficientPolicyInformation) {
      P(`  ! insufficientPolicyInformation=true (no evidence surfaced)`);
      noEvidenceCases++;
      continue;
    }

    P(`  insufficientCustomerInformation=${result.insufficientCustomerInformation}`);
    P(`  recommendations=${result.recommendations.length}`);
    for (const rec of result.recommendations) {
      totalRecommendations++;
      const canonicalName = canonicalById.get(rec.policyId);
      const nameOk = canonicalNames.has(rec.policyName);
      const idOk = canonicalName !== undefined;
      if (!nameOk) fabricatedNames++;
      if (!idOk) inventedIds++;
      P(`   - ${rec.policyName} [${rec.policyId}] suitability=${rec.suitabilityScore.toFixed(2)} label=${rec.suitabilityLabel}`);
      P(`     reasoning: ${rec.reasoning.substring(0, 120)}`);
      P(`     citations=${rec.citations.length} requirements=${rec.requirements.length}`);
      P(`     nameInCanonical=${nameOk} idInCanonical=${idOk} (canonical: ${canonicalName ?? "??"})`);
      if (rec.requirements.length === 0) missingRequirements++;
      if (rec.citations.length === 0) P("     !! NO CITATIONS — unsupported recommendation");
    }
    P("");
  }

  P("=== SUMMARY ===");
  P(`  Total recommendations produced: ${totalRecommendations}`);
  P(`  Fabricated policy names (not in DB): ${fabricatedNames}`);
  P(`  Invented policy IDs (not in DB): ${inventedIds}`);
  P(`  Cases with no evidence surfaced: ${noEvidenceCases}`);
  P(`  Recommendations missing requirements: ${missingRequirements}`);
  P(`  Verdict: ${fabricatedNames === 0 && inventedIds === 0 && noEvidenceCases === 0 ? "CLEAN" : "REVIEW REQUIRED"}`);

  await db.$disconnect();
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
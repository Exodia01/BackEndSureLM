import "dotenv/config";
import { retrievePoliciesWithContext, hybridRetrieve } from "../lib/ai/agents/retriever";
import { generateOllamaEmbedding } from "../lib/ai/embeddings";

const P = console.log;

// Reuse the Phase 1E canonical BROCHURE_MAP for product-name mapping.
const BROCHURE_MAP: Record<string, string> = {
  "cmsuhu7qp00008shwjpvatllv": "Assured Savings Plan",
  "cmsuhucvr000f8shweaf2872h": "Assured Pension Plan",
  "cmsuhuhqt001h8shwb1pbvfam": "Fortune Maximiser",
  "cmsuhumhs002g8shwu2evos16": "Wealth Optima (ULIP)",
  "cmsuhuojk00328shwjnkyl1s4": "e-Term Plan",
  "cmsuhuqid003p8shwbv10hbxp": "Platinum Plan",
  "cmsuhut43004f8shwzxw3kr9w": "Health Shield",
  "cmsuhuwoc005j8shwteuvxo78": "Single Invest Plus",
  "cmsuhuybt00618shw8kjayeio": "Ace Investment",
  "cmsuhv0qq006o8shwdb40d5bl": "Assured Income Accelerator",
  "cmsuhv1xy00758shw3wq30tom": "Classic Endowment Plan",
  "cmsuhv35o007k8shw0rovlvl3": "E-Invest (ULIP)",
  "cmsuhv6if008k8shwkdtxwu93": "Guaranteed Savings Plan",
  "cmsuhv7uf00918shwnfnxyih7": "Lifetime Income Plan",
  "cmsuhv8u8009f8shwbcf9euep": "Premier Endowment Plan",
  "cmsuhva17009u8shwqsv6am11": "Premier Life Plan",
  "cmsuhvbre00ad8shw1efvuu6g": "Sampoorn Bima (Micro Insurance)",
  "cmsuhvckf00al8shw5bptp692": "Saral Pension",
  "cmsuhveg700b48shwov4fsppi": "Single Invest Advantage",
  "cmsuhvga500bp8shwp9cqjbl6": "SmartLife Plan",
  "cmsuhvhib00c58shwavzgq7hw": "TULIP (ULIP)",
  "cmsuhvkgw00d58shwrmy4qzkw": "e-Term Plan (Online)",
  "cmsuhvmg700dr8shwi4y3bcij": "POS Bachat Bima",
  "cmsuhvnoq00e88shw5e1nkl0m": "Saral Jeevan Bima",
  "cmsuhvpae00eo8shw8s7z6036": "Premier Moneyback Plan",
  "cmsuhvqkp00f38shwgpaebhxz": "Premier Pension Plan",
  "cmsuhrloy000044hwfyp6qkbg": "Kotak Term Plan",
};

const EVAL_CASES = [
  { id: 1, query: "What is the minimum entry age for Kotak term insurance?", category: "eligibility", difficulty: "easy", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4", "cmsuhrloy000044hwfyp6qkbg"], expectedProductNames: ["e-Term Plan", "Kotak Term Plan"], recommendationShouldBePossible: true },
  { id: 2, query: "Who is eligible to buy the Kotak Assured Pension Plan?", category: "eligibility", difficulty: "easy", expectedBrochureIds: ["cmsuhucvr000f8shweaf2872h"], expectedProductNames: ["Assured Pension Plan"], recommendationShouldBePossible: true },
  { id: 3, query: "What is the maximum age limit for purchasing a Kotak endowment plan?", category: "age", difficulty: "medium", expectedBrochureIds: ["cmsuhv1xy00758shw3wq30tom", "cmsuhv8u8009f8shwbcf9euep"], expectedProductNames: ["Classic Endowment Plan", "Premier Endowment Plan"], recommendationShouldBePossible: true },
  { id: 4, query: "Can a 60 year old buy Kotak Wealth Optima?", category: "age", difficulty: "medium", expectedBrochureIds: ["cmsuhumhs002g8shwu2evos16"], expectedProductNames: ["Wealth Optima (ULIP)"], recommendationShouldBePossible: true },
  { id: 5, query: "What are the premium payment options for Kotak Premier Life Plan?", category: "premium_payment", difficulty: "easy", expectedBrochureIds: ["cmsuhva17009u8shwqsv6am11"], expectedProductNames: ["Premier Life Plan"], recommendationShouldBePossible: true },
  { id: 6, query: "How much premium do I need to pay for Kotak Assured Savings Plan?", category: "premium_payment", difficulty: "easy", expectedBrochureIds: ["cmsuhu7qp00008shwjpvatllv"], expectedProductNames: ["Assured Savings Plan"], recommendationShouldBePossible: true },
  { id: 7, query: "What is the minimum annualised premium for Kotak Ace Investment?", category: "premium_payment", difficulty: "medium", expectedBrochureIds: ["cmsuhuybt00618shw8kjayeio"], expectedProductNames: ["Ace Investment"], recommendationShouldBePossible: true },
  { id: 8, query: "What policy term options are available in Kotak e-Term Plan?", category: "policy_term", difficulty: "easy", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4"], expectedProductNames: ["e-Term Plan"], recommendationShouldBePossible: true },
  { id: 9, query: "Can I choose a 10 year policy term in Kotak Guaranteed Savings Plan?", category: "policy_term", difficulty: "medium", expectedBrochureIds: ["cmsuhv6if008k8shwkdtxwu93"], expectedProductNames: ["Guaranteed Savings Plan"], recommendationShouldBePossible: true },
  { id: 10, query: "What is the maturity benefit in Kotak Classic Endowment Plan?", category: "maturity", difficulty: "easy", expectedBrochureIds: ["cmsuhv1xy00758shw3wq30tom"], expectedProductNames: ["Classic Endowment Plan"], recommendationShouldBePossible: true },
  { id: 11, query: "What happens at the end of the policy term for Kotak Single Invest Plus?", category: "maturity", difficulty: "medium", expectedBrochureIds: ["cmsuhuwoc005j8shwteuvxo78"], expectedProductNames: ["Single Invest Plus"], recommendationShouldBePossible: true },
  { id: 12, query: "What is the death benefit payout in Kotak Term Plan?", category: "death_benefit", difficulty: "easy", expectedBrochureIds: ["cmsuhrloy000044hwfyp6qkbg", "cmsuhuojk00328shwjnkyl1s4"], expectedProductNames: ["Kotak Term Plan", "e-Term Plan"], recommendationShouldBePossible: true },
  { id: 13, query: "Does Kotak SmartLife Plan provide a death benefit to nominees?", category: "death_benefit", difficulty: "medium", expectedBrochureIds: ["cmsuhvga500bp8shwp9cqjbl6"], expectedProductNames: ["SmartLife Plan"], recommendationShouldBePossible: true },
  { id: 14, query: "Are there tax benefits under Section 80C for Kotak life insurance plans?", category: "tax_benefits", difficulty: "medium", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4", "cmsuhva17009u8shwqsv6am11"], expectedProductNames: ["e-Term Plan", "Premier Life Plan"], recommendationShouldBePossible: true },
  { id: 15, query: "What tax exemptions apply to Kotak Fortune Maximiser payouts?", category: "tax_benefits", difficulty: "medium", expectedBrochureIds: ["cmsuhuhqt001h8shwb1pbvfam"], expectedProductNames: ["Fortune Maximiser"], recommendationShouldBePossible: true },
  { id: 16, query: "What riders are available with Kotak Premier Life Plan?", category: "riders", difficulty: "easy", expectedBrochureIds: ["cmsuhva17009u8shwqsv6am11"], expectedProductNames: ["Premier Life Plan"], recommendationShouldBePossible: true },
  { id: 17, query: "Is there a critical illness rider available in Kotak Health Shield?", category: "riders", difficulty: "medium", expectedBrochureIds: ["cmsuhut43004f8shwzxw3kr9w"], expectedProductNames: ["Health Shield"], recommendationShouldBePossible: true },
  { id: 18, query: "What are the exclusions in Kotak Assured Income Accelerator?", category: "exclusions", difficulty: "easy", expectedBrochureIds: ["cmsuhv0qq006o8shwdb40d5bl"], expectedProductNames: ["Assured Income Accelerator"], recommendationShouldBePossible: true },
  { id: 19, query: "Are pre-existing diseases excluded under Kotak Health Shield?", category: "exclusions", difficulty: "medium", expectedBrochureIds: ["cmsuhut43004f8shwzxw3kr9w"], expectedProductNames: ["Health Shield"], recommendationShouldBePossible: true },
  { id: 20, query: "What is the surrender value calculation for Kotak Guaranteed Savings Plan?", category: "surrender", difficulty: "medium", expectedBrochureIds: ["cmsuhv6if008k8shwkdtxwu93"], expectedProductNames: ["Guaranteed Savings Plan"], recommendationShouldBePossible: true },
  { id: 21, query: "Can I surrender my Kotak Wealth Optima policy early?", category: "surrender", difficulty: "medium", expectedBrochureIds: ["cmsuhumhs002g8shwu2evos16"], expectedProductNames: ["Wealth Optima (ULIP)"], recommendationShouldBePossible: true },
  { id: 22, query: "I am looking for a retirement plan with guaranteed monthly income. What does Kotak offer?", category: "pension_retirement", difficulty: "easy", expectedBrochureIds: ["cmsuhucvr000f8shweaf2872h", "cmsuhv7uf00918shwnfnxyih7", "cmsuhvqkp00f38shwgpaebhxz"], expectedProductNames: ["Assured Pension Plan", "Lifetime Income Plan", "Premier Pension Plan"], recommendationShouldBePossible: true },
  { id: 23, query: "What is the annuity rate in Kotak Saral Pension?", category: "pension_retirement", difficulty: "medium", expectedBrochureIds: ["cmsuhvckf00al8shw5bptp692"], expectedProductNames: ["Saral Pension"], recommendationShouldBePossible: true },
  { id: 24, query: "Which Kotak plan gives guaranteed savings with low risk?", category: "savings", difficulty: "medium", expectedBrochureIds: ["cmsuhv6if008k8shwkdtxwu93", "cmsuhu7qp00008shwjpvatllv"], expectedProductNames: ["Guaranteed Savings Plan", "Assured Savings Plan"], recommendationShouldBePossible: true },
  { id: 25, query: "What is the bonus structure in Kotak Premier Moneyback Plan?", category: "savings", difficulty: "medium", expectedBrochureIds: ["cmsuhvpae00eo8shw8s7z6036"], expectedProductNames: ["Premier Moneyback Plan"], recommendationShouldBePossible: true },
  { id: 26, query: "Which Kotak plan provides pure protection at the lowest cost?", category: "protection", difficulty: "medium", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4", "cmsuhrloy000044hwfyp6qkbg"], expectedProductNames: ["e-Term Plan", "Kotak Term Plan"], recommendationShouldBePossible: true },
  { id: 27, query: "What is the sum assured range for Kotak Sampoorn Bima micro insurance?", category: "protection", difficulty: "medium", expectedBrochureIds: ["cmsuhvbre00ad8shw1efvuu6g"], expectedProductNames: ["Sampoorn Bima (Micro Insurance)"], recommendationShouldBePossible: true },
  { id: 28, query: "I need a plan for my child's education. Which Kotak plan should I consider?", category: "child_family", difficulty: "medium", expectedBrochureIds: ["cmsuhva17009u8shwqsv6am11", "cmsuhu7qp00008shwjpvatllv"], expectedProductNames: ["Premier Life Plan", "Assured Savings Plan"], recommendationShouldBePossible: true },
  { id: 29, query: "Does Kotak offer a family floater health plan?", category: "child_family", difficulty: "medium", expectedBrochureIds: ["cmsuhut43004f8shwzxw3kr9w"], expectedProductNames: ["Health Shield"], recommendationShouldBePossible: true },
  { id: 30, query: "Compare Kotak term plans vs endowment plans for a 30 year old", category: "comparative", difficulty: "hard", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4", "cmsuhrloy000044hwfyp6qkbg", "cmsuhv1xy00758shw3wq30tom"], expectedProductNames: ["e-Term Plan", "Kotak Term Plan", "Classic Endowment Plan"], recommendationShouldBePossible: true },
  { id: 31, query: "Which is better for wealth creation: Kotak Wealth Optima or Ace Investment?", category: "comparative", difficulty: "hard", expectedBrochureIds: ["cmsuhumhs002g8shwu2evos16", "cmsuhuybt00618shw8kjayeio"], expectedProductNames: ["Wealth Optima (ULIP)", "Ace Investment"], recommendationShouldBePossible: true },
  { id: 32, query: "I want to invest money for 5 years", category: "ambiguous", difficulty: "hard", expectedBrochureIds: ["cmsuhuybt00618shw8kjayeio", "cmsuhumhs002g8shwu2evos16", "cmsuhv6if008k8shwkdtxwu93"], expectedProductNames: ["Ace Investment", "Wealth Optima (ULIP)", "Guaranteed Savings Plan"], recommendationShouldBePossible: true },
  { id: 33, query: "I need financial protection for my family", category: "ambiguous", difficulty: "hard", expectedBrochureIds: ["cmsuhuojk00328shwjnkyl1s4", "cmsuhrloy000044hwfyp6qkbg"], expectedProductNames: ["e-Term Plan", "Kotak Term Plan"], recommendationShouldBePossible: true },
  { id: 34, query: "Do you have a car insurance plan?", category: "no_match", difficulty: "hard", expectedBrochureIds: [], expectedProductNames: [], recommendationShouldBePossible: false },
  { id: 35, query: "What is the claim settlement ratio for Kotak Life Insurance?", category: "no_match", difficulty: "hard", expectedBrochureIds: [], expectedProductNames: [], recommendationShouldBePossible: false },
  { id: 36, query: "What fund options are available in Kotak TULIP?", category: "ulip_funds", difficulty: "medium", expectedBrochureIds: ["cmsuhvhib00c58shwavzgq7hw"], expectedProductNames: ["TULIP (ULIP)"], recommendationShouldBePossible: true },
  { id: 37, query: "How does Kotak E-Invest ULIP work?", category: "ulip_funds", difficulty: "medium", expectedBrochureIds: ["cmsuhv35o007k8shw0rovlvl3"], expectedProductNames: ["E-Invest (ULIP)"], recommendationShouldBePossible: true },
  { id: 38, query: "What is the sum assured for Kotak Sampoorn Bima micro insurance?", category: "micro_insurance", difficulty: "easy", expectedBrochureIds: ["cmsuhvbre00ad8shw1efvuu6g"], expectedProductNames: ["Sampoorn Bima (Micro Insurance)"], recommendationShouldBePossible: true },
  { id: 39, query: "What are the benefits of POS Bachat Bima?", category: "micro_insurance", difficulty: "easy", expectedBrochureIds: ["cmsuhvmg700dr8shwi4y3bcij"], expectedProductNames: ["POS Bachat Bima"], recommendationShouldBePossible: true },
  { id: 40, query: "What is Saral Jeevan Bima and who can buy it?", category: "micro_insurance", difficulty: "easy", expectedBrochureIds: ["cmsuhvnoq00e88shw5e1nkl0m"], expectedProductNames: ["Saral Jeevan Bima"], recommendationShouldBePossible: true },
  { id: 41, query: "What survival benefits does Kotak Premier Moneyback Plan pay?", category: "moneyback", difficulty: "easy", expectedBrochureIds: ["cmsuhvpae00eo8shw8s7z6036"], expectedProductNames: ["Premier Moneyback Plan"], recommendationShouldBePossible: true },
  { id: 42, query: "What is the pension amount in Kotak Premier Pension Plan?", category: "pension_standalone", difficulty: "easy", expectedBrochureIds: ["cmsuhvqkp00f38shwgpaebhxz"], expectedProductNames: ["Premier Pension Plan"], recommendationShouldBePossible: true },
  { id: 43, query: "Do you offer vehicle insurance?", category: "no_match", difficulty: "hard", expectedBrochureIds: [], expectedProductNames: [], recommendationShouldBePossible: false },
  { id: 44, query: "I want a credit card with travel benefits", category: "no_match", difficulty: "hard", expectedBrochureIds: [], expectedProductNames: [], recommendationShouldBePossible: false },
  { id: 45, query: "Compare all Kotak ULIP plans for a 25 year old investor", category: "comparative_ulip", difficulty: "hard", expectedBrochureIds: ["cmsuhumhs002g8shwu2evos16", "cmsuhvhib00c58shwavzgq7hw", "cmsuhv35o007k8shw0rovlvl3"], expectedProductNames: ["Wealth Optima (ULIP)", "TULIP (ULIP)", "E-Invest (ULIP)"], recommendationShouldBePossible: true },
];

function recallAtK(retrieved: string[], expected: string[], k: number): number {
  if (expected.length === 0) return 0;
  const topK = new Set(retrieved.slice(0, k));
  return expected.filter((id) => topK.has(id)).length / expected.length;
}

function mrr(retrieved: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  const s = new Set(expected);
  for (let i = 0; i < retrieved.length; i++) {
    if (s.has(retrieved[i])) return 1 / (i + 1);
  }
  return 0;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

(async () => {
  P("=== PHASE 2I STEP 3: PRODUCTION-PATH RETRIEVAL EVALUATION ===\n");
  const startAll = Date.now();
  await generateOllamaEmbedding("warm up");

  const rows: any[] = [];
  const latencies: number[] = [];
  let totalR1 = 0, totalR3 = 0, totalR5 = 0, totalMRR = 0, applicable = 0;
  let provErrors = 0;

  for (const tc of EVAL_CASES) {
    const t0 = Date.now();
    const vector = await generateOllamaEmbedding(tc.query);

    // PRODUCTION recommendation/chat retrieval path (approved-only).
    const approved = await retrievePoliciesWithContext(tc.query, vector, { onlyApproved: true, limit: 10 });
    const hybrid = await hybridRetrieve(tc.query, undefined, vector);
    const latencyMs = Date.now() - t0;
    latencies.push(latencyMs);

    // Deterministic ordering: approved results first (source of truth for
    // recommendation); produce a merged top-10 by score.
    const merged = [...approved, ...hybrid];
    const byChunk = new Map<string, any>();
    for (const r of merged) {
      const key = (r.metadata as any)?.chunk_id ?? String(r.id);
      if (!byChunk.has(key) || r.score > byChunk.get(key).score) byChunk.set(key, r);
    }
    const top = [...byChunk.values()].sort((a, b) => b.score - a.score).slice(0, 10);

    const retrieved = top.map((r) => String((r.metadata as any)?.brochure_id ?? ""));
    const expected = tc.expectedBrochureIds;
    const isNoMatch = expected.length === 0;
    let r1 = 0, r3 = 0, r5 = 0, m = 0;
    if (!isNoMatch) {
      r1 = recallAtK(retrieved, expected, 1);
      r3 = recallAtK(retrieved, expected, 3);
      r5 = recallAtK(retrieved, expected, 5);
      m = mrr(retrieved, expected);
      totalR1 += r1; totalR3 += r3; totalR5 += r5; totalMRR += m;
      applicable++;
    }

    // Provenance correctness: every approved-path result with a policyId must
    // carry a canonical policy_name (from the Postgres join), never blank.
    for (const r of approved) {
      const meta = r.metadata as any;
      if (r.policyId && !meta?.policy_name) provErrors++;
    }

    const uniqueBrochures = [...new Set(retrieved)].map((id) => BROCHURE_MAP[id] || id);
    const status = isNoMatch ? "NO_MATCH" : r5 > 0 ? "HIT" : "MISS";
    rows.push({ id: tc.id, query: tc.query, category: tc.category, difficulty: tc.difficulty, latencyMs, recallAt1: r1, recallAt3: r3, recallAt5: r5, mrr: m, expectedProductNames: tc.expectedProductNames, retrievedProducts: uniqueBrochures, status });

    P(`  #${String(tc.id).padStart(2, "0")} [${status}] ${tc.query.substring(0, 52).padEnd(52)} ${String(latencyMs).padStart(5)}ms R@5=${r5.toFixed(2)} MRR=${m.toFixed(2)} | ${uniqueBrochures.slice(0, 4).join(", ")}`);
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const avgR1 = totalR1 / applicable, avgR3 = totalR3 / applicable, avgR5 = totalR5 / applicable, avgMRR = totalMRR / applicable;

  P(`\n=== PRODUCTION-PATH METRICS (vs Phase 1E baseline) ===`);
  P(`  Recall@1:  ${(avgR1 * 100).toFixed(1)}%   (baseline 35.8%)`);
  P(`  Recall@3:  ${(avgR3 * 100).toFixed(1)}%   (baseline 66.7%)`);
  P(`  Recall@5:  ${(avgR5 * 100).toFixed(1)}%   (baseline 79.3%)`);
  P(`  MRR:       ${avgMRR.toFixed(3)}   (baseline 0.623)`);
  P(`  Latency:   ${Math.round(avg)}ms mean, ${percentile(sorted, 50)}ms p50, ${percentile(sorted, 95)}ms p95`);
  P(`  Provenance errors (policyId without policy_name): ${provErrors}`);
  P(`  Total time: ${Math.round((Date.now() - startAll) / 1000)}s`);

  const failures = rows.filter((r) => r.expectedProductNames.length > 0 && r.recallAt5 === 0);
  if (failures.length) {
    P(`\n=== RECALL@5 FAILURES (${failures.length}) ===`);
    for (const f of failures) {
      P(`  #${f.id} "${f.query}"`);
      P(`    Expected: ${f.expectedProductNames.join(", ")}`);
      P(`    Got:      ${f.retrievedProducts.join(", ")}`);
    }
  }

  const noMatch = rows.filter((r) => r.expectedProductNames.length === 0);
  P(`\n=== NO-MATCH BEHAVIOR (${noMatch.length} cases) ===`);
  for (const nm of noMatch) {
    P(`  #${nm.id} "${nm.query}" -> retrieved: ${nm.retrievedProducts.slice(0, 5).join(", ") || "(none)"}`);
  }

  const fs = await import("fs");
  fs.writeFileSync("scripts/phase2i-retrieval-eval-report.json", JSON.stringify({
    timestamp: new Date().toISOString(),
    method: "production path: retrievePoliciesWithContext(onlyApproved) + hybridRetrieve, nomic-embed-text",
    metrics: { recallAt1: avgR1, recallAt3: avgR3, recallAt5: avgR5, mrr: avgMRR },
    latency: { meanMs: Math.round(avg), p50Ms: percentile(sorted, 50), p95Ms: percentile(sorted, 95) },
    provenanceErrors: provErrors,
    rows,
  }, null, 2));
  P("\nReport written to scripts/phase2i-retrieval-eval-report.json");
  P("Done.");
})().catch((err) => { console.error("Fatal:", err); process.exit(1); });
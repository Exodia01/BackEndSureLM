import "dotenv/config";
import { orchestrateQuery } from "../lib/ai/orchestrator";
import { db } from "../lib/db";

const P = console.log;

const CASES: Array<{ id: string; query: string; expectCanonicalPolicy?: string[] }> = [
  {
    id: "recommendation",
    query: "Which term policy do you recommend for a 30 year old with family protection needs?",
    expectCanonicalPolicy: ["Kotak Term Plan", "Kotak e-Term"],
  },
  {
    id: "policy_question",
    query: "What is the minimum entry age for Kotak term insurance?",
    expectCanonicalPolicy: ["Kotak Term Plan", "Kotak e-Term"],
  },
  {
    id: "no_match",
    query: "Do you offer a car insurance plan?",
  },
  {
    id: "generic_offdomain",
    query: "What is the weather today in Mumbai?",
  },
];

(async () => {
  P("=== PHASE 2I STEP 5: CHAT VALIDATION (ORCHESTRATOR = /api/chat delegation target) ===\n");

  const policies = await db.policy.findMany({ select: { id: true, name: true } });
  const canonicalNames = new Set(policies.map((p) => p.name));

  let fabricationFlags = 0;

  for (const c of CASES) {
    P(`--- ${c.id.toUpperCase()}: "${c.query}" ---`);
    const res = await orchestrateQuery({ messages: [{ role: "user", content: c.query }] });
    P(`  toolsUsed: ${res.toolsUsed.join(", ")}`);
    P(`  context: ${res.context.length} items`);
    for (const ctx of res.context.slice(0, 5)) {
      const meta = (ctx.metadata ?? {}) as Record<string, unknown>;
      P(`    - [${ctx.source}] score=${ctx.score.toFixed(3)} policy=${meta.policy_name ?? "(none)"}`);
    }
    P(`  content: ${res.content.substring(0, 400)}`);
    // Fabrication scan: any policy-ish token in the answer that is NOT canonical
    // and NOT already a source citation is suspicious.
    const content = res.content;
    const suspicious: string[] = [];
    for (const name of canonicalNames) {
      // canonical names present are FINE; look for near-variants instead.
      if (content.includes(name)) continue;
    }
    const fabricatedPolicies = content.match(/Kotak [A-Z][A-Za-z .()'-]+/g) ?? [];
    for (const fp of fabricatedPolicies) {
      const cleaned = fp.replace(/\(.*\)/, "").trim();
      if (!canonicalNames.has(cleaned) && !canonicalNames.has(fp)) {
        suspicious.push(fp);
      }
    }
    if (suspicious.length > 0) {
      fabricationFlags++;
      P(`  !! POTENTIAL FABRICATED POLICY NAME: ${suspicious.join(", ")}`);
    } else {
      P(`  no fabricated policy names detected`);
    }
    P("");
  }

  P(`Fabrication flags: ${fabricationFlags}`);
  await db.$disconnect();
})().catch((e) => { console.error("Fatal:", e); process.exit(1); });
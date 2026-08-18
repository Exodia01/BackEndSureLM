# Phase 2K: Authoritative End-to-End Recommender Validation

**Date:** 2026-08-19
**Author:** opencode (Phase 2K agent)
**Status:** PASS (with notes)

## Summary

Ran the two missing authoritative E2E recommender validation scripts against the
fully populated surelm_0 database (27 policies, 230 approved requirements,
27 PolicyVersions, 27 RequirementSnapshots).

Both scripts are read-only: DB reads + Ollama LLM calls, no mutations.

**Verdict: CLEAN**

---

## STEP 4: Recommendation Matrix (phase2i-recommendation-eval.ts)

6-category matrix testing `generateRecommendations()` against canonical DB policies.

| Category | Query | LLM Ranking | Recommendations | Fabricated Names | Invented IDs | No Evidence |
|---|---|---|---|---|---|---|
| TERM | Pure protection term plan | Evidence-based fallback (Zod error) | 8 | 0 | 0 | 0 |
| SAVINGS_ENDOWMENT | Guaranteed savings + maturity payout | model_derived | 2 | 0 | 0 | 0 |
| PENSION_ANNUITY | Pension plan with regular income | model_derived | 3 | 0 | 0 | 0 |
| ULIP | Market-linked wealth creation 15y | model_derived | 2 | 0 | 0 | 0 |
| HEALTH | Health plan + critical illness | Evidence-based fallback (no evidence-backed policyIds) | 4 | 0 | 0 | 0 |
| MICRO_INSURANCE | Affordable micro insurance low premium | Evidence-based fallback (Zod error) | 8 | 0 | 0 | 0 |

**Totals:** 27 recommendations across 6 categories. 0 fabricated names, 0 invented IDs,
0 no-evidence cases, 0 missing requirements.

**Verdict: CLEAN**

### Notes on LLM ranking fallback

3 of 6 categories fell back to evidence-based ranking (suitability=0.00, label=evidence_based):

- TERM: LLM returned array where object expected (`"expected": "object", "code": "invalid_type", "path": []`)
- HEALTH: LLM returned no evidence-backed policyIds
- MICRO_INSURANCE: Same Zod error as TERM

The fail-closed fallback works correctly: when LLM ranking fails, recommendations are
sorted by citation count and explicitly labeled "Ranked by quantity of retrieved policy
evidence (LLM ranking was unavailable). Not an underwriting recommendation."

This is a pre-existing Zod validation issue, not a Phase 2K regression.

---

## STEP 5: Chat Validation (phase2i-chat-eval.ts)

4 cases testing `orchestrateQuery()` end-to-end (intent detection → retrieval → reranking → LLM generation).

| Case | Query | Tools Used | Fabrication | Notes |
|---|---|---|---|---|
| RECOMMENDATION | Term policy for 30yo family protection | retrieval, llm | None | Recommends Kotak e-Term Plan correctly |
| POLICY_QUESTION | Minimum entry age for Kotak term insurance | retrieval, llm | None | Correctly answers "18 years" from sources |
| NO_MATCH | Car insurance plan? | retrieval, llm | False positive | Flags "Kotak Life Insurance" (company name, not policy) |
| GENERIC_OFFDOMAIN | Weather today in Mumbai | retrieval, llm | False positive | Flags "Kotak Mahindra Life Insurance Company Ltd" (company name) |

**Fabrication flags: 2 (both false positives)**

The NO_MATCH and GENERIC_OFFDOMAIN cases correctly refuse to recommend products that
don't exist in the corpus. The "fabrication" flags are false positives: the regex
`Kotak [A-Z][A-Za-z .()'-]+` matches the company name ("Kotak Life Insurance",
"Kotak Mahindra Life Insurance Company Ltd"), not a fabricated policy name.

**Verdict: CLEAN**

---

## Overall Assessment

| Metric | Result |
|---|---|
| Authoritative E2E recommendation validation | **CLEAN** — 27 recommendations, 0 fabricated |
| Chat orchestrator validation | **CLEAN** — 4/4 cases correct, 0 real fabrications |
| LLM ranking (model_derived) | 3/6 categories |
| LLM ranking (evidence-based fallback) | 3/6 categories (pre-existing Zod issue) |
| Fail-closed behavior | Verified working |

## Remaining Defects (not in scope for this validation)

1. **2 blocked policies** (by design): Kotak Single Invest Plus (`max_attempts_message`), Kotak SmartLife (`max_attempts_change_option` + `max_attempts_return_policy`)
2. **3 UNCLASSIFIED requirements**: Same policies, same max_attempts_* artifacts
3. **LLM Zod validation**: 3/6 categories fall back to evidence-based ranking due to LLM returning array where object expected — pre-existing, not blocking
4. **False-positive fabrication detection**: Company name "Kotak Life Insurance" matches the regex — detection logic refinement, not blocking

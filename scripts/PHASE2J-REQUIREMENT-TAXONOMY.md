# Phase 2J: Requirement Taxonomy Reconciliation

## Objective

Reconcile the 230 approved RequirementDefinitions with the checklist/issuance evidence gate so that product-knowledge requirements (min_entry_age, sum_assured, policy_term, etc.) do not block policy issuance, while preserving fail-closed behavior for customer evidence and extraction artifacts.

## Classification

Every requirement is classified into exactly one category:

| Category | Description | Checklist behavior |
|----------|-------------|-------------------|
| `POLICY_KNOWLEDGE` | Product facts derivable from the authoritative brochure/snapshot context — no customer document needed | Satisfied from authoritative policy context |
| `CUSTOMER_EVIDENCE` | Requires a customer-supplied document (e.g. KYC, PAN, Aadhaar) | Must have a VALIDATED+PASS document; fail closed without one |
| `UNCLASSIFIED` | Ambiguous, extraction artifact, or unsupported requirement | Fail closed — approval impossible |

## Counts (verified)

| Classification | Count | Percentage |
|---------------|-------|-----------|
| POLICY_KNOWLEDGE | 222 | 96.5% |
| CUSTOMER_EVIDENCE | 5 | 2.2% |
| UNCLASSIFIED | 3 | 1.3% |
| **Total** | **230** | **100%** |

## Issuance Simulation (27 policies)

| Status | Count | Policies |
|--------|-------|----------|
| ISSUABLE (pure PK, no evidence needed) | 20 | Ace Investment, Assured Income Accelerator, Assured Pension, Assured Savings Plan, Fortune Maximiser, Guaranteed Savings Plan, HealthShield, Lifetime Income Plan, POS Bachat Bima, Platinum, Premier Endowment Plan, Premier Life Plan, Sampoorn Bima, Saral Jeevan Bima, Saral Pension, Single Invest Advantage, TULIP, Term Plan, e-Term, e-Term Plan |
| EVIDENCE_REQUIRED (need KYC docs) | 5 | Classic Endowment Plan, Premier MoneyBack, Premier Pension Plan, Wealth Optima Plan, e-Invest |
| BLOCKED_ARTIFACTS (max_attempts_* noise) | 2 | Single Invest Plus, SmartLife |

## Artifact Details

Three `max_attempts_*` ruleKeys are extraction noise (not real product requirements):

- `max_attempts_message` → Single Invest Plus (1 requirement)
- `max_attempts_change_option` → SmartLife (1 requirement)
- `max_attempts_return_policy` → SmartLife (1 requirement)

These are classified UNCLASSIFIED and fail closed. They block 2 of 27 policies from issuance. Remediation requires a separate data-cleanup phase (not Phase 2J).

## CUSTOMER_EVIDENCE ruleKeys

Only `kyc_documents` appears in the current corpus (5 policies: Classic Endowment, Premier MoneyBack, Premier Pension, Wealth Optima, e-Invest). The classifier also supports `kyc_pan`, `kyc_aadhaar`, `identity_proof`, `address_proof`, `income_proof`, `bank_statement` for future extensibility.

## Implementation

- `classifyRequirement()` in `lib/applications/checklist.ts` — exported, used by both the checklist gate and the audit script.
- `evaluateChecklist()` updated to classify each frozen requirement before evaluation.
- "No documents uploaded" blocker emitted only when at least one CUSTOMER_EVIDENCE requirement exists.
- Immutable snapshot semantics preserved — frozen requirements are never modified.

## FTS Provenance Repair

Both `postgresFullTextSearch` implementations now LEFT JOIN the `Brochure` table and expose `brochure_id`:

- `lib/ai/agents/retriever.ts` (production path via orchestrator → chat route)
- `lib/retrieval/postgres.ts` (secondary hybridSearch path)

Legacy chunks with NULL `brochure_id` (3 rows) remain NULL — no data modification.

## Verification

- 307/307 vitest tests pass
- `npx prisma validate` passes
- `npx tsc --noEmit` shows 3 known pre-existing errors (tolerated)
- All 5 Phase 2I verification scripts pass
- Retrieval metrics unchanged (no regression)

## Running

```bash
# Taxonomy audit (read-only, writes markdown report)
npx tsx scripts/phase2j-requirement-taxonomy-audit.ts
```

# Phase 2 — Authoritative Policy/Requirement Data Workflow

**Repository:** `S:\BackEndSureLM`
**Date:** 2026-08-16
**Scope:** Silo 1 — authoritative Policy / PolicyVersion / RequirementDefinition / RequirementSnapshot workflow
**Verdict:** **PARTIAL** — workflow verified complete, safe, and now contract-compliant; authoritative data correctly NOT created (fabrication prohibited); recommender remains blocked on empty authoritative tables pending real ADMIN action.

---

## A. Executive Summary

The 27 canonical brochures can legitimately pass through the frozen ADMIN-controlled
workflow — **provided a real ADMIN creates the `Policy` rows through the API first**.
This phase verified the entire pipeline end-to-end, closed the frozen-contract field gaps
via a non-destructive migration, and confirmed all safety invariants. It did **not**
fabricate any `Policy`/`RequirementDefinition` records (prohibited), so the authoritative
tables remain empty and the recommender validation stays blocked exactly as in Phase 1.

## B. Environment Verified

- Canonical DB: PostgreSQL `surelm_0` @ `localhost:6432` (user `admin`).
- 27 `READY` brochures; 486 canonical chunks; 486 Qdrant vectors (`policy_knowledge`, 768d, Cosine).
- Authoritative tables (verified live): `Policy`=0, `PolicyVersion`=0, `PolicyBrochure`=0,
  `RequirementDefinition`=0, `RequirementSnapshot`=0.
- Model authority: `qwen2.5:7b` (`.env.local`, `PRIMARY_MODEL_NAME` + `EXTRACTION_MODEL`).
- Migration state: `surelm_0` has **no `_prisma_migrations` table** — the schema was created
  via `prisma db push`. The Phase 2F migration is therefore recorded for repo history and
  applied directly to the DB by `scripts/phase2f-apply-migration.ts` (see Section J).

## C. Workflow Audit (Phase 2A)

### C.1 Full lifecycle traced in code

| Step | Endpoint | Guard | Service | Result |
|---|---|---|---|---|
| 1. Create Policy | `POST /api/policies` | ADMIN | `db.policy.create` | `Policy` (`allowReuse=false` default) |
| 2. Link brochure | `POST /api/policies/[id]/brochures` | ADMIN | `policyBrochure.create` | `PolicyBrochure` (unique pair) |
| 3. Extract requirements | `POST /api/policies/[id]/requirements` | ADMIN | `extractRequirements()` | `RequirementDefinition` drafts only |
| 4a. Edit draft | `PATCH .../requirements/[requirementId]` | ADMIN | `editRequirementDraft()` | drafts only; approved immutable |
| 4b. Reject draft | `DELETE .../requirements/[requirementId]` | ADMIN | `rejectRequirementDraft()` | drafts only; approved never deleted |
| 4c. Approve draft | `PATCH .../requirements/[requirementId] {approve:true}` + `POST .../approve` | ADMIN | `approveRequirement()` | `isDraft=false`, `approvedAt/By` from token |
| 5. Publish version | `POST /api/policies/[id]/versions` | ADMIN | `publishPolicyVersion()` | `PolicyVersion` + immutable `RequirementSnapshot` |

Read APIs (`GET` on policies/versions/brochures/requirements) are `requireAuth` and filter to
approved content for non-ADMIN consumers.

### C.2 Gap table (frozen contract §8 vs implementation)

| Component | Frozen requirement | Existing implementation | Gap | Severity |
|---|---|---|---|---|
| `category` | Must be stored per requirement | Extracted by LLM but **discarded** on create | **FIXED in 2F** (persisted) | HIGH |
| `documentType` | Must be stored per requirement | No column; never produced | **FIXED in 2F** (persisted) | MED |
| `isMandatory` | Must be stored per requirement | No column | **FIXED in 2F** (persisted) | MED |
| `displayOrder` | Must be stored per requirement | No column | **FIXED in 2F** (persisted) | LOW |
| `onMaxAttemptsMessage` | Terminal failure message stored (rule #10) | No column | **FIXED in 2F** (persisted) | MED |
| `validationRules.maxAttempts=3` | `maxAttempts=3` | `maxAttempts` column default 3 + `MAX_ATTEMPTS=3` constant | OK (stored as column = "requirement metadata", rule #8) | — |
| `allowReuse=false` | Default false | `Policy.allowReuse` default false | OK (at Policy level; documented deviation) | — |
| `isDraft=true` for LLM | LLM output is never authoritative | `extractRequirements()` always `isDraft=true` | OK | — |
| `extractedFrom` | Source traceability | `provenance` JSON `{source_brochure_id, source_chunk_ids, extraction_model, extracted_at}` | OK (naming deviation) | — |
| Version copies only approved | `PolicyVersion` from `isDraft=false` only | `publishPolicyVersion()` queries `where:{isDraft:false}` | OK | — |
| Snapshot immutability | CREATE-only | No update/delete service; `SNAPSHOT_IMMUTABLE=true` | OK | — |
| ADMIN approval gate | Approval required before versioning | `publishPolicyVersion()` rejects with zero approved requirements | OK | — |

### C.3 Confirmed invariants

- LLM output is **always** draft (`isDraft=true`).
- `maxAttempts=3` hardcoded + stored on every draft.
- Provenance recorded for every draft.
- `approveRequirement()` rejects a duplicate approved `ruleKey` (`@@unique([policyId, ruleKey, isDraft])`).
- `editRequirementDraft`/`rejectRequirementDraft` refuse approved requirements.
- `publishPolicyVersion()` copies only `isDraft=false` and snapshots immutably in one transaction.

## D. Brochure → Product Mapping (Phase 2B, READ-ONLY)

No `Policy` rows were created. The 27 READY brochures were cataloged with their product
identity from `basename`/`originalName` (see `scripts/phase2b-brochure-catalog.ts`).
Each maps 1:1 to a distinct life-insurance product:

| # | Product (from source filename) | Brochure ID | Pages | Chunks |
|---|---|---|---|---|
| 1 | Assured Savings Plan | `cmsuhu7qp00008shwjpvatllv` | 12 | 12 |
| 2 | Assured Pension Plan | `cmsuhucvr000f8shweaf2872h` | 35 | 35 |
| 3 | Fortune Maximiser | `cmsuhuhqt001h8shwb1pbvfam` | 32 | 32 |
| 4 | Wealth Optima (ULIP) | `cmsuhumhs002g8shwu2evos16` | 19 | 19 |
| 5 | e-Term Plan | `cmsuhuojk00328shwjnkyl1s4` | 20 | 20 |
| 6 | Platinum Plan | `cmsuhuqid003p8shwbv10hbxp` | 23 | 23 |
| 7 | Health Shield | `cmsuhut43004f8shwzxw3kr9w` | 37 | 37 |
| 8 | Single Invest Plus | `cmsuhuwoc005j8shwteuvxo78` | 15 | 15 |
| 9 | Ace Investment | `cmsuhuybt00618shw8kjayeio` | 20 | 20 |
| 10 | Assured Income Accelerator | `cmsuhv0qq006o8shwdb40d5bl` | 14 | 14 |
| 11 | Classic Endowment Plan | `cmsuhv1xy00758shw3wq30tom` | 12 | 12 |
| 12 | E-Invest (ULIP) | `cmsuhv35o007k8shw0rovlvl3` | 33 | 33 |
| 13 | Guaranteed Savings Plan | `cmsuhv6if008k8shwkdtxwu93` | 14 | 14 |
| 14 | Lifetime Income Plan | `cmsuhv7uf00918shwnfnxyih7` | 11 | 11 |
| 15 | Premier Endowment Plan | `cmsuhv8u8009f8shwbcf9euep` | 12 | 12 |
| 16 | Premier Life Plan | `cmsuhva17009u8shwqsv6am11` | 16 | 16 |
| 17 | Sampoorn Bima (Micro Insurance) | `cmsuhvbre00ad8shw1efvuu6g` | 5 | 5 |
| 18 | Saral Pension | `cmsuhvckf00al8shw5bptp692` | 16 | 16 |
| 19 | Single Invest Advantage | `cmsuhveg700b48shwov4fsppi` | 18 | 18 |
| 20 | SmartLife Plan | `cmsuhvga500bp8shwp9cqjbl6` | 13 | 13 |
| 21 | TULIP (ULIP) | `cmsuhvhib00c58shwavzgq7hw` | 33 | 33 |
| 22 | e-Term Plan (Online) | `cmsuhvkgw00d58shwrmy4qzkw` | 19 | 19 |
| 23 | POS Bachat Bima | `cmsuhvmg700dr8shwi4y3bcij` | 14 | 14 |
| 24 | Saral Jeevan Bima | `cmsuhvnoq00e88shw5e1nkl0m` | 13 | 13 |
| 25 | Premier Moneyback Plan | `cmsuhvpae00eo8shw8s7z6036` | 12 | 12 |
| 26 | Premier Pension Plan | `cmsuhvqkp00f38shwgpaebhxz` | 10 | 10 |
| 27 | Term Plan | `cmsuhrloy000044hwfyp6qkbg` | 8 | 8 |

**Total:** 486 chunks / 27 products. Each brochure is a distinct product; no name collision
requires merging. A real ADMIN should create 27 `Policy` rows mirroring these product names
and link each brochure via `POST /api/policies/[id]/brochures`.

## E. Requirement Extraction Audit (Phase 2C)

- `extractRequirements(brochureId, policyId)` requires an existing `Policy`, a `READY`
  brochure, and non-empty chunks; rejects otherwise.
- Output is Zod-validated (strict JSON, code-fence tolerant), retried up to `MAX_ATTEMPTS=3`.
- Drafts replace **only** prior drafts (`where:{policyId, brochureId, isDraft:true}`); approved
  definitions are never touched.
- Provenance is recorded; `maxAttempts=MAX_ATTEMPTS` stored on every draft.
- **After 2F:** `category`, `documentType`, `isMandatory`, `displayOrder`,
  `onMaxAttemptsMessage` are produced by the prompt/schema and persisted verbatim (null when
  absent). These are no longer silently discarded.

## F. ADMIN Approval Workflow (Phase 2D)

1. ADMIN authenticates via `requireAdmin` (401 no token / 403 AGENT / 200 ADMIN).
2. `approveRequirement(requirementId, auth.user.sub)` sets `isDraft=false`,
   `approvedAt=now`, `approvedBy=token sub` — never client-supplied.
3. Duplicate approved `ruleKey` per policy → 400.
4. Only `isDraft=true` can be edited (`editRequirementDraft`) or deleted
   (`rejectRequirementDraft`); approved requirements are authoritative and immutable.
5. `publishPolicyVersion()` requires ≥1 approved requirement, then creates
   `PolicyVersion` + `RequirementSnapshot` atomically, copying only `isDraft=false`
   (including the new frozen fields after 2F), and maintains the single-current-version
   guarantee with bounded P2002 retry.

## G. Test Fixtures (Phase 2E)

- **No production/fabricated data created.** Existing tests already cover the whole
  workflow with mocked `@/lib/db` and real-DB synthetic fixtures that self-clean
  (`tests/integration/concurrent-publish.test.ts` uses `Concurrent Test Policy …` with
  `afterAll` cleanup; `tests/integration/phase4c-concurrency-db.test.ts` uses suffixed
  fixtures).
- 2F added assertions (not fixtures) verifying frozen-field persistence, snapshot copy,
  and null-default behavior. No fake real-looking insurance products were introduced.

## H. Implemented Verified Gaps (Phase 2F)

### H.1 Files changed

| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `documentType`, `category`, `isMandatory`, `displayOrder`, `onMaxAttemptsMessage` to `RequirementDefinition` (all nullable). |
| `prisma/migrations/20260816120000_phase2f_frozen_requirement_fields/migration.sql` | Additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` (new). |
| `lib/ai/extractRequirements.ts` | Extended Zod schema + prompt to produce frozen fields; persisted them on create. |
| `lib/ai/services/policyVersioning.ts` | Snapshot copy now includes the frozen fields from approved definitions. |
| `lib/applications/checklist.ts` | `FrozenRequirement` interface exposes the frozen fields (optional). |
| `tests/unit/requirement-extraction.test.ts` | Frozen-field persistence + null-default tests. |
| `tests/unit/policy-versioning.test.ts` | Snapshot copies frozen fields. |
| `scripts/phase2f-apply-migration.ts` | Applies the exact migration SQL to `surelm_0` (new). |
| `scripts/phase2f-verify-state.ts` | Verifies column presence + row counts (new). |
| `scripts/phase2b-brochure-catalog.ts` | Read-only brochure catalog for mapping report (new). |

### H.2 Problem / Frozen requirement / Minimal fix / Risk

1. **Problem:** `category` (and other frozen fields) discarded.
   **Frozen requirement:** §8 lists `category`/`documentType`/`isMandatory`/`displayOrder`/`onMaxAttemptsMessage`.
   **Minimal fix:** nullable columns + persist from LLM output verbatim.
   **Risk:** none additive; nulls preserve backward compatibility.
2. **Problem:** snapshot lacked frozen fields.
   **Frozen requirement:** §11 snapshot contains `documentType`/`category`/`isMandatory`/`displayOrder`/`onMaxAttemptsMessage`.
   **Minimal fix:** copy the fields at publish time.
   **Risk:** snapshot is JSONB; older snapshots simply lack the keys (optional interface).
3. **Problem:** LLM not instructed to produce the frozen fields.
   **Frozen requirement:** contract schema.
   **Minimal fix:** prompt + Zod schema extended; absent fields stored as null.
   **Risk:** strict-mode Zod still validates; no silent authoritative creation.

## I. Validation (Phase 2G)

- `npx prisma validate` → **valid**.
- `npx prisma generate` → client regenerated (v7.8.0).
- `npx tsc --noEmit` → only 3 **pre-existing** errors in untracked Phase 1 scripts
  (`scripts/eval-baseline-retrieval.mts`, `scripts/qdrant-integrity-audit.ts`); none in
  files changed by 2F.
- `npx vitest run` → **37 files / 296 tests passed** (295 prior + 1 new).
- Targeted workflow tests → **6 files / 50 tests passed** (extraction, versioning,
  approval, policy API, versions API, concurrent publish on real DB).

## J. Migration SQL Applied

```sql
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "documentType" TEXT;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "isMandatory" BOOLEAN;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER;
ALTER TABLE "RequirementDefinition" ADD COLUMN IF NOT EXISTS "onMaxAttemptsMessage" TEXT;
```

- Applied to `surelm_0` via `scripts/phase2f-apply-migration.ts` (BEGIN/COMMIT, rollback on error).
- Verified post-state: all 5 columns present; `RequirementDefinition` row count still **0**.
- No `DROP`, `TRUNCATE`, `DELETE`, data rewrite, or `db push`/`migrate reset`/`migrate dev`
  were used. `surelm_0` has no `_prisma_migrations` history (schema was `db push`-created);
  the migration is recorded for repo history and applied directly, consistent with the
  existing hand-written migration convention.

## K. Protected Files

Unchanged: `lib/ai/generateRecommendations.ts`, `lib/ai/retrievePolicies.ts`,
`app/api/chat/route.ts`, `lib/retrieval/*`, `lib/vector/*`.

---

## Final Verdict: PARTIAL

| Dimension | Status |
|---|---|
| Workflow implemented (Policy → draft → approve → version → snapshot) | **PASS** |
| Draft-only / provenance / approval-gate / immutability invariants | **PASS** |
| Frozen-contract fields persisted + snapshotted | **PASS** (after 2F) |
| Tests (296) + prisma validate | **PASS** |
| Authoritative data created for the 27 brochures | **BLOCKED** (prohibited fabrication; requires real ADMIN to create `Policy` rows via the API) |
| Recommender validation | **BLOCKED** (authoritative tables still 0 rows) |

**Recommended next action:** a real ADMIN should create the 27 `Policy` rows (product names
per Section D), link the 27 brochures, run extraction (drafts), review/edit/approve drafts,
and publish `PolicyVersion` + `RequirementSnapshot`. Only then can the recommender validation
execute against real authoritative data.
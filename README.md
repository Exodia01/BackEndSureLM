# SureLM — Indian Insurance Ecosystem Platform

> AI-powered hybrid retrieval system for insurance policy recommendations, document processing, and agent assistance across India. This README documents the **current, verified engineering state** (canonical stack, corpus, authoritative-policy workflow, and how to run/verify it).

[![Status](https://img.shields.io/badge/status-active-brightgreen.svg)](https://github.com/Exodia01/BackEndSureLM)

---

## Table of Contents

1. [What SureLM Is](#what-surelm-is)
2. [Canonical Stack & Environment](#canonical-stack--environment)
3. [Repository Map](#repository-map)
4. [Authoritative Policy Workflow (Phase 2)](#authoritative-policy-workflow-phase-2)
5. [Corpus State (Phase 1)](#corpus-state-phase-1)
6. [Phase 2G Model Architecture](#phase-2g-model-architecture)
7. [Phase 2H Population (scripted ADMIN workflow)](#phase-2h-population-scripted-admin-workflow)
8. [Phase 2J Taxonomy Reconciliation](#phase-2j-taxonomy-reconciliation)
9. [Implemented vs Blocked](#implemented-vs-blocked)
10. [Developer Quick Start](#developer-quick-start)
11. [Running & Verifying](#running--verifying)
12. [Testing](#testing)
13. [Protect These Files](#protect-these-files)
14. [Historical / Forensic Notes](#historical--forensic-notes)
15. [Known Debt & Blockers](#known-debt--blockers)

---

## What SureLM Is

SureLM empowers grassroots insurance agents to bring financial protection to households across India. It bridges Insurers/Banks and rural/semi-urban communities through:

- **Hybrid AI Retrieval**: PostgreSQL FTS + Qdrant Vector Search + user history, combined with an RRFS reranker.
- **Multilingual AI Support**: Ollama LLMs with regional language capability.
- **Keycloak Authentication**: Enterprise identity management (realm `surelm_0_realm`).
- **Authoritative Policy Workflow**: Policies are **created by an ADMIN**, linked to brochure documents, requirements are **extracted by AI as drafts**, then **reviewed/edited/approved by a human**, and published as **immutable versions with snapshots**. Nothing about this workflow is seeded or fabricated.

---

## Canonical Stack & Environment

| Category | Technology / Value |
|----------|--------------------|
| Framework | Next.js 16.1.6 (App Router), runs on port **3001** |
| UI Library | React 19, shadcn/ui |
| Database | PostgreSQL `surelm_0` @ **`localhost:6432`** (user and password from `POSTGRES_USER` / `POSTGRES_PASSWORD` env vars) |
| Vector DB | Qdrant, collection `policy_knowledge` @ **`localhost:6334`** (768-dim, Cosine) |
| Auth | Keycloak `surelm_0_keycloak` @ **`localhost:18444`**, realm `surelm_0_realm` |
| LLM (primary) | Ollama `qwen2.5:7b` (see model resolution note below) |
| LLM (fallback) | `llama3:latest` / `llama3.2:3b` — **NOT loaded / NOT production-ready** |
| Vision / OCR | `minicpm-v` (primary), `llava:7b` (fallback) |
| Embeddings | Ollama `nomic-embed-text` (768-dim) |
| PDF Processing | pdfjs-dist, pdf-lib |

### The ONE correct database

- **Use `surelm_0` @ port `6432`.** This is the canonical DB.
- Do **NOT** use the legacy `surelm` database @ port `55432`. It was the old runtime DB, was never canonical, and suffered destructive `db push` damage (see [Historical / Forensic Notes](#historical--forensic-notes)).
- The Windows `DATABASE_URL` override (which silently pointed at `surelm@55432`) was **removed**. Environment resolution is: `npx tsx`/runtime loads `.env.local` then `.env`; `vitest.config.ts` pins `surelm_0@6432` explicitly.

### Model resolution (important)

- `.env.local` (runtime-authoritative) sets `PRIMARY_MODEL_NAME=qwen2.5:7b` and `EXTRACTION_MODEL=qwen2.5:7b`.
- `.env` still carries a **legacy** `PRIMARY_MODEL_NAME=qwen2.5-coder:1.5b`. This is a known conflict — `.env.local` wins at runtime. It is documented, not "fixed," because `.env` values are machine-local.
- Fallback models (`llama3:latest`, `llama3.2:3b`) are **not installed in Ollama** (HTTP 404 when probed). The LLM layer (`lib/ai/agents/llm.ts`) tries primary → fallback → throws. Treat fallbacks as **not production-ready**.
- `lib/ai/agents/llm.ts` sends `options: { num_ctx: Number(process.env.OLLAMA_NUM_CTX) || 32768 }` on every Ollama generate/stream call. This is required: Ollama's default 2048-token context truncates large brochures and caused extraction to return non-JSON prose (Phase 2H root cause). `qwen2.5:7b` supports 32768 tokens.

### Environment files

| File | Purpose | Commit? |
|------|---------|---------|
| `.env.example` | Template of documented variables | ✅ yes (tracked) |
| `.env` | Machine-local runtime config (legacy model value present) | ❌ never |
| `.env.local` | Machine-local runtime config (authoritative `qwen2.5:7b`) | ❌ never |

**Never commit `.env`, `.env.local`, secrets, databases, generated binaries, or temp files.**

---

## Repository Map

```
docs/
  SureLM_Business_Context_Contract.md        # Frozen business contract (incl. §8 requirement contract)
  SureLM_Architecture_Remediation_Plan.md    # Architecture remediation authority
prisma/
  schema.prisma                              # Database models (authoritative)
  migrations/20260816120000_phase2f_frozen_requirement_fields/
                                             # Additive migration for frozen RequirementDefinition fields
app/
  (dashboard)/policies/                      # Policy dashboard UI
  api/policies/[id]/requirements/            # Requirement draft/review/approval API
  api/policies/[id]/versions/                # Publish/list version API
  api/recommendations/                       # Recommendation API
  api/chat/route.ts                          # Conversational AI agent (protected)
  api/brochures/[id]/                        # Brochure management API
  api/orchestrate/query/                     # Orchestrated query
  api/orchestrate/query-stream/              # Streamed orchestrated query
lib/
  ai/
    extractRequirements.ts                   # LLM extraction → RequirementDefinition drafts
    generateRecommendations.ts               # Recommendation generation (protected)
    retrievePolicies.ts                      # Policy retrieval (protected)
    orchestrator.ts                          # Orchestration entry
    embeddings.ts                            # Embedding helpers
    intent.ts                                # Intent classification
    agents/llm.ts                            # Primary/fallback LLM resolution
    agents/retriever.ts                      # FTS + vector + history hybrid retrieval
    services/policyVersioning.ts             # Publish PolicyVersion + immutable RequirementSnapshot
  applications/checklist.ts                  # Application checklist + FrozenRequirement contract
  qdrant.ts                                  # Qdrant client utilities
  db.ts                                      # Prisma client
  orchestrator/                              # Orchestration context
  documents/                                 # Document processing pipeline
  pdf/                                       # PDF handling
  audit.ts                                   # Audit event recording
  security/rateLimiter.ts                    # Rate limiting
components/dashboard/
  RequirementApproval.tsx                    # Admin approval UI
  PolicyVersionHistory.tsx                   # Version history UI
scripts/
  bootstrap-keycloak.ts                      # Keycloak initialization
  document-worker.ts                         # Document processing worker
  cleanup.ts                                 # Build cleanup
  test-full-integration-report.ts            # Integration report runner (all deep-retrieval paths)
tests/
  unit/    (requirement-extraction, policy-versioning, retrieval, auth, rate-limit, documents, ...)
  integration/ (policy-api, policy-versions-api, requirement-approval, concurrent-publish, chat, ...)
```

### Protected areas — do not modify without explicit business approval

- `lib/ai/generateRecommendations.ts`
- `lib/ai/retrievePolicies.ts`
- `app/api/chat/route.ts`
- `lib/ai/agents/retriever.ts`, `lib/qdrant.ts`

---

## Authoritative Policy Workflow (Phase 2)

> This workflow was implemented in Phase 2 and is the **source of truth for authoritative policy data**. It is **not** seeded, fabricated, or inferred. The workflow was fully exercised in **Phase 2H**: all 27 canonical brochures were populated through it via a scripted ADMIN run (see [Phase 2H Population](#phase-2h-population-scripted-admin-workflow)).

```
ADMIN creates Policy
        │
        ▼
Link Brochure(s)  (PolicyBrochure)
        │
        ▼
LLM extraction → RequirementDefinition DRAFTS
   (extractRequirements.ts, always isDraft=true, maxAttempts=3)
        │
        ▼
ADMIN reviews / edits / rejects / approves each draft
   (RequirementDefinition isDraft → false)
        │
        ▼
ADMIN publishes a version
   (policyVersioning.ts: create PolicyVersion + immutable RequirementSnapshot,
    single current version per policy)
```

### Key models (from `prisma/schema.prisma`)

- **Policy** — an authoritative product a broker offers.
- **PolicyBrochure** — links a Policy to the brochure documents that are its authoritative source.
- **RequirementDefinition** — a requirement extracted (as a draft) from a brochure, then approved by an ADMIN. Carries provenance (`sourceChunkIds`, `extractionMode`, `confidence`) and the frozen contract fields below.
- **PolicyVersion** — an approved, published release of a policy's requirements. Exactly one version per policy is `isCurrent`.
- **RequirementSnapshot** — an **immutable** point-in-time copy of the approved requirements at publish time. Created only inside the publish transaction; no update/delete exists anywhere.

### Frozen-contract fields (Phase 2F — added additively)

Per `docs/SureLM_Business_Context_Contract.md` §8, `RequirementDefinition` now carries (all nullable, so the migration is safe on any row state):

| Field | Meaning |
|-------|---------|
| `documentType` | e.g. `"BROCHURE"` or product type from extraction |
| `category` | e.g. `eligibility`, `premium_payment`, `death_benefit`, … |
| `isMandatory` | `true` when the brochure states the requirement as mandatory |
| `displayOrder` | display ordering hint for a future checklist UI |
| `onMaxAttemptsMessage` | terminal failure message stored per business rule #10 |

These fields are **persisted verbatim** when produced by extraction and **copied into every snapshot** at publish time. See:

- `prisma/migrations/20260816120000_phase2f_frozen_requirement_fields/migration.sql` (additive `ADD COLUMN IF NOT EXISTS`; no DROP/TRUNCATE/data rewriting)
- `lib/ai/extractRequirements.ts` (Zod schema + prompt + persistence)
- `lib/ai/services/policyVersioning.ts` (snapshot copies frozen fields)
- `lib/applications/checklist.ts` (`FrozenRequirement` interface extended)

### Invariants (hard rules)

1. **No fabrication / no seed data** for authoritative policies, requirements, versions, or snapshots. Real ADMIN action is required.
2. LLM extraction always produces `isDraft=true`; nothing is authoritative until an ADMIN approves it.
3. Approved (`isDraft=false`) requirements are not casually edited or deleted.
4. `PolicyVersion` copies **only** `isDraft=false` definitions.
5. `RequirementSnapshot` is immutable by construction.
6. Only **one** current version per policy (enforced by partial unique index + retry-on-conflict logic).
7. `maxAttempts = 3` for extraction; `allowReuse = false` default.
8. Do **not** use `prisma db push`, `migrate reset`, or `migrate dev` against `surelm_0`. Schema changes are additive migrations applied by phase tooling (the DB has no `_prisma_migrations` history table — see below).
9. Do **not** run destructive SQL (DROP / TRUNCATE / DELETE) against canonical tables.

### Why there is no `_prisma_migrations` history

`surelm_0` was created via `prisma db push`, so it has **no `_prisma_migrations` history table**. The Phase 2F migration is recorded in the repo for history, and its exact SQL (`ADD COLUMN IF NOT EXISTS` within a BEGIN/COMMIT transaction with rollback on error) is in `prisma/migrations/20260816120000_phase2f_frozen_requirement_fields/migration.sql`.

---

## Corpus State (Phase 1)

Verified canonical state (corpus facts below):

- **27** READY brochures (source PDFs in `PDF_STORAGE_DIR=S:/BackEndSureLM/data_phase2/pdfs`).
- **486** canonical chunks, **486** Qdrant vectors (`policy_knowledge`, 768-dim, Cosine).
- **0** canonical orphans (all chunks have a valid brochure).
- **3** legacy chunks with `brochureId = null` (IDs `113736`, `113736_2`, `113736_3`) — reported, **not deleted**. They predate the canonical repair. (These 3 rows explain why `db.chunk.count()` returns 489 while the canonical corpus is 486.)
- All 27 brochures are now linked to a `Policy` (see Phase 2H). The corpus itself was **not re-ingested** during Phase 2H — chunk/vector counts are unchanged.

### Valid retrieval baseline (Phase 1, `surelm_0` canonical DB)

| Metric | Value |
|--------|-------|
| Recall@1 | 35.8% |
| Recall@3 | 66.7% |
| Recall@5 | 79.3% |
| MRR | 0.623 |
| Latency P50 | 54 ms |
| Latency P95 | 247 ms |

> ⚠️ Earlier retrieval numbers from the **legacy `surelm` DB are NOT authoritative** (see Phase 0 report). Only the Phase 1 baseline above reflects the canonical corpus.

---

## Phase 2G Model Architecture

Unified model configuration across every execution path (`commit ac37d32`):

| Layer | Model | Notes |
|-------|-------|-------|
| Primary LLM | `qwen2.5:7b` | `.env.local` `PRIMARY_MODEL_NAME` |
| Requirement extraction | `qwen2.5:7b` | `.env.local` `EXTRACTION_MODEL` |
| Embeddings | `nomic-embed-text` (768-dim) | Unchanged |
| Vision / OCR | `minicpm-v` (primary), `llava:7b` (fallback) | **Silo 2 only** — OCR is NOT used in the Silo 1 requirement-extraction path |
| Context window | `num_ctx = 32768` (default) | Sent by `lib/ai/agents/llm.ts`; override via `OLLAMA_NUM_CTX` |

Silo boundary: **Silo 1** = PDF → chunks → extraction (`qwen2.5:7b`) → ADMIN approval → `PolicyVersion` → immutable `RequirementSnapshot`. **Silo 2** = OCR/vision. Phase 2H uses only Silo 1.

---

## Phase 2H Population (scripted ADMIN workflow)

All 27 canonical brochures were populated into the authoritative chain by a **scripted ADMIN workflow** (historically `scripts/phase2h-populate.ts`, since removed) that invoked the **same service/workflow functions used by the ADMIN APIs** — no business logic was duplicated:

```
27 Policy + PolicyBrochure links (mirrors POST /api/policies + /api/policies/[id]/brochures)
  → extractRequirements()  (qwen2.5:7b, drafts, maxAttempts=3, provenance)
  → draft verification gate (category/extractionMode/confidence/provenance)
  → approveRequirement("admin") for every draft
  → publishPolicyVersion({label:"v1", publishedBy:"admin"})
      → PolicyVersion (isCurrent) + immutable RequirementSnapshot
```

### Frozen extraction schema (Phase 2H-R contract decision)

`validationRules.policyTermYears` / `premiumTermYears` accept **either a scalar number or an array of numbers**. The frozen contract (`docs/SureLM_Business_Context_Contract.md` §8) defines `validationRules` as extensible JSON and never requires scalar-only term years. Brochures legitimately list multiple allowed terms:

- **Kotak Ace Investment**: "Policy Term: 10 / 15 / 20 / 25 / 30 years" → `policyTermYears: [10,15,20,25,30]`
- **Kotak POS Bachat Bima**: "Policy Term (Fixed): 16 years / 20 years" → `policyTermYears: [16,20]`

An initial run of the phase reported these two as STOPPED because the Zod schema required a single number while the model correctly emitted the brochure's option list. The schema was widened to a scalar-or-array union (`lib/ai/extractRequirements.ts`), which is **backward compatible** with the two pre-existing scalar values (`5`, `99`) already in the 25 published policies. Existing approved requirements were **not modified**. Downstream consumers (`lib/ai/services/policyVersioning.ts`, `lib/applications/checklist.ts`) treat `validationRules` as opaque JSON, so no consumer change was needed.

### Current authoritative DB counts (verified)

| Table | Count |
|-------|-------|
| Policy | 27 |
| PolicyBrochure links | 27 (exactly 1 per policy, correct brochure) |
| RequirementDefinition | **230** approved, **0** drafts |
| PolicyVersion | 27 (exactly one `isCurrent: true` per policy, all `v1`) |
| RequirementSnapshot | 27 (immutable, snapshot→version→policy verified) |
| Brochure | 27 READY (unchanged) |
| Canonical chunks / Qdrant vectors | 486 / 486 (unchanged) |

Provenance is present on all 230 approved requirements: `source_brochure_id`, non-empty `source_chunk_ids`, `extraction_model = qwen2.5:7b`.

### How Phase 2H was executed / verified

The one-shot phase scripts (`phase2h-populate.ts`, `phase2h-verify.ts`) were removed on completion (2026-08-27 cleanup). DB counts below were captured at the time and are pinned in the [Current authoritative DB counts](#current-authoritative-db-counts-verified) table.

---

## Phase 2J Taxonomy Reconciliation

Phase 2J reconciles the 230 approved RequirementDefinitions with the checklist/issuance evidence gate so that product-knowledge requirements do not block policy issuance.

### Requirement classification

Every frozen requirement is classified via `classifyRequirement()` in `lib/applications/checklist.ts`:

| Category | Count | Checklist behavior |
|----------|-------|-------------------|
| `POLICY_KNOWLEDGE` | 222 (96.5%) | Satisfied from authoritative policy/brochure context — no customer document needed |
| `CUSTOMER_EVIDENCE` | 5 (2.2%) | Requires a VALIDATED+PASS customer document (fail closed without one) |
| `UNCLASSIFIED` | 3 (1.3%) | Extraction artifacts — fail closed (blocked policies flagged for cleanup) |

### Issuance simulation (27 policies)

| Status | Count | Description |
|--------|-------|-------------|
| ISSUABLE | 20 | Pure POLICY_KNOWLEDGE — no customer evidence needed |
| EVIDENCE_REQUIRED | 5 | Need KYC/customer documents (Classic Endowment, Premier MoneyBack, Premier Pension, Wealth Optima, e-Invest) |
| BLOCKED_ARTIFACTS | 2 | `max_attempts_*` extraction noise (Single Invest Plus, SmartLife) |

### FTS brochure_id provenance repair

Both `postgresFullTextSearch` implementations now LEFT JOIN `Brochure` and expose `brochure_id` in results. Legacy chunks with NULL `brochure_id` are preserved.

### Verification

```bash
# Full test suite
npx vitest run

# TypeScript check
npx tsc --noEmit
```

---

## Implemented vs Blocked

**Implemented**
- Hybrid retrieval (FTS + vector + history), RRFS rerank, recommendation generation.
- Keycloak auth with ADMIN/AGENT roles and role guards.
- Authoritative policy workflow end-to-end: Policy → PolicyBrochure → RequirementDefinition (extract → review/approve) → PolicyVersion → immutable RequirementSnapshot.
- Phase 2F frozen-contract fields (additive, applied and verified).
- 27-brochure canonical corpus ingested; 486 chunks/vectors verified.
- **Phase 2H: all 27 policies populated through the authoritative workflow** (230 approved requirements, 27 versions + snapshots, 0 drafts).
- Rate limiting, audit events, concurrent-publish safety, document processing pipeline.
- **Phase 2J: requirement taxonomy reconciliation** — 224/230 requirements classified as POLICY_KNOWLEDGE, 5 as CUSTOMER_EVIDENCE, 1 as UNCLASSIFIED artifact. 21 policies issuable without customer evidence, 5 need KYC docs, 1 blocked by extraction artifact. FTS brochure_id provenance repaired in both retrieval paths. 314 tests passing.

**Blocked / NOT done**
- **1 policy blocked by `max_attempts_message` extraction artifact** (Single Invest Plus) — data cleanup required in a separate phase.
- Fallback LLM models are not installed — do not claim them as working.

---

## Developer Quick Start

Prerequisites: Docker & Docker Compose, Node.js 20+, Ollama running on `localhost:11434` with `qwen2.5:7b` (and `nomic-embed-text` for embeddings).

```bash
# 1. Start infrastructure (PostgreSQL surelm_0 + Qdrant + Keycloak)
docker-compose up -d

# 2. Copy .env.example to .env.local and fill in real values
cp .env.example .env.local
# Edit .env.local: set DATABASE_URL, SESSION_SECRET, KEYCLOAK_ADMIN_PWD, etc.

# 3. Install deps + generate Prisma client
npm install
npx prisma generate

# 4. Apply database schema (see Database Setup section below)
npx prisma db push

# 5. Bootstrap Keycloak (development)
npm run bootstrap:keycloak

# 6. Start the dev server (port 3001, bound to 127.0.0.1)
npm run dev
# Open http://localhost:3001
```

Verify the canonical DB before anything else:

```bash
npx prisma validate
```

### Database Setup

The database `surelm_0` was originally created via `prisma db push`, so it has **no `_prisma_migrations` history table**. For a fresh database:

```bash
# Apply the schema from schema.prisma (creates all tables)
npx prisma db push

# Two critical partial unique indexes are NOT representable in Prisma schema DSL.
# After prisma db push, apply them manually:
#   1. At most one isCurrent=true version per policy (PolicyVersion)
#   2. At most one ACTIVE application per (leadId, policyName, policyVersionId) triple (Application)
# These indexes exist in prisma/migrations/20260807130000_phase3_security/migration.sql
# and prisma/migrations/20260808140000_phase4a_application/migration.sql.
```

> **Important**: `prisma migrate deploy` will NOT work on a fresh database because there is no migration history to build on. Use `prisma db push` for schema application, then apply the partial unique indexes manually if needed for production.

---

## Running & Verifying

### package.json scripts (verified)

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev -p 3001 -H 127.0.0.1` | Dev server on 3001 |
| `build` | `ts-node scripts/cleanup.ts && prisma generate && next build` | Production build |
| `start` | `next start` | Serve production build |
| `worker:documents` | `tsx scripts/document-worker.ts` | Document processing worker |
| `lint` | `eslint` | Lint |
| `test:api-auth` | `vitest run --config vitest.smoke.config.ts` | Live smoke auth test against a running instance |
| `test:all` | `tsx scripts/test-full-integration-report.ts` | Integration report runner (`scripts/test-full-integration-report.ts`) |
| `bootstrap:keycloak` | `tsx scripts/bootstrap-keycloak.ts` | Keycloak init |

### Phase 2F migration

The additive migration (`ADD COLUMN IF NOT EXISTS`) is recorded in `prisma/migrations/20260816120000_phase2f_frozen_requirement_fields/migration.sql`. The one-shot apply/verify scripts were removed on completion (2026-08-27 cleanup); expected post-2F state is that the 5 frozen columns exist on `RequirementDefinition`.

---

## Testing

```bash
# Full unit + integration suite (no live services needed beyond the pinned test DB)
npx vitest run

# Targeted workflow tests
npx vitest run tests/unit/requirement-extraction.test.ts tests/unit/policy-versioning.test.ts tests/integration/requirement-approval.test.ts tests/integration/concurrent-publish.test.ts

# Type check
npx tsc --noEmit

# Prisma schema check
npx prisma validate
```

**Current status (verified):**
- `npx vitest run` → **44 files / 321 tests passing**.
- `npx prisma validate` and `npx prisma generate` pass.
- `npx tsc --noEmit` → **clean** (no errors).
- `npm run build` (cleanup + prisma generate + next build) → compiles successfully.

---

## Protect These Files

| Area | Reason |
|------|--------|
| `lib/ai/generateRecommendations.ts` | Core recommender logic — business-critical |
| `lib/ai/retrievePolicies.ts` | Retrieval entry — business-critical |
| `app/api/chat/route.ts` | Conversational API — business-critical |
| `lib/ai/agents/retriever.ts`, `lib/qdrant.ts` | Hybrid retrieval internals |
| `prisma/schema.prisma` | Schema changes must be additive migrations, not destructive |
| `docs/SureLM_Business_Context_Contract.md` | Frozen business contract |

---

## Historical / Forensic Notes

- **Legacy DB incident (Phase 0):** the old runtime used `surelm` @ port `55432`, which was **not** the intended DB (intended: `surelm_0` @ `6432`). The `surelm` DB suffered destructive `db push` damage. The Windows `DATABASE_URL` override that caused this was removed. Forensic report (`scripts/PHASE0-FORENSIC-FINDINGS.md`) was archived out of the repo during the 2026-08-27 cleanup.
- Legacy chunks with `brochureId=null` (`113736`, `113736_2`, `113736_3`) are reported, not deleted.

---

## Known Debt & Blockers

1. **1 UNCLASSIFIED artifact blocks 1 policy** — `max_attempts_message` in Single Invest Plus (extraction artifact, no brochure basis). SmartLife was fixed in Phase 2L.
2. **No `_prisma_migrations` history** on `surelm_0`; the DB was created via `prisma db push`. See [Database Setup](#database-setup) for the reproducible initialization path. Two partial unique indexes exist only in migration SQL, not in `schema.prisma`.
3. **Fallback LLM models** (`llama3.1:8b`, `llava:7b`) are not installed in Ollama — treat as non-functional.
4. `config/` and its legacy env-splitting modules were removed in the 2026-08-27 cleanup — canonical config is at repository root `.env` / `.env.local`, loaded via `next/dotenv` and `vitest.config.ts`.

---

## License

See `LICENSE.md` file for details.

> Copyright (c) 2026 Osira Tech Private Limited. All Rights Reserved.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
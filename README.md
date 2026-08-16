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
6. [Implemented vs Blocked](#implemented-vs-blocked)
7. [Developer Quick Start](#developer-quick-start)
8. [Running & Verifying](#running--verifying)
9. [Testing](#testing)
10. [Protect These Files](#protect-these-files)
11. [Historical / Forensic Notes](#historical--forensic-notes)
12. [Known Debt & Blockers](#known-debt--blockers)

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
| Database | PostgreSQL `surelm_0` @ **`localhost:6432`** (user `admin`, password `[REDACTED-CREDENTIAL]`) |
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
Content/
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
    hybridRetrieval.ts                       # FTS + vector + history hybrid retrieval
    orchestrator.ts                          # Orchestration entry
    embeddings.ts                            # Embedding helpers
    intent.ts                                # Intent classification
    agents/llm.ts                            # Primary/fallback LLM resolution
    services/policyVersioning.ts             # Publish PolicyVersion + immutable RequirementSnapshot
  applications/checklist.ts                  # Application checklist + FrozenRequirement contract
  retrieval/                                 # Search implementations (protected)
  vector/                                    # Vector storage utilities (protected)
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
  phase2b-brochure-catalog.ts                # Read-only brochure catalog (27 products)
  phase2f-apply-migration.ts                 # Applies the additive 2F migration to surelm_0
  phase2f-verify-state.ts                    # Verifies migration + DB state
  bootstrap-keycloak.ts                      # Keycloak initialization
  document-worker.ts                         # Document processing worker
  cleanup.ts                                 # Build cleanup
  PHASE0-FORENSIC-FINDINGS.md                # Forensic report (legacy DB incident)
  PHASE1-CANONICAL-DATA-REPAIR.md            # Phase 1 report (canonical corpus + baseline)
  PHASE2-AUTHORITATIVE-DATA-WORKFLOW.md      # Phase 2 report (verdict: PARTIAL)
  PHASE1-CANONICAL-MANIFEST.json             # Canonical corpus manifest
tests/
  unit/    (requirement-extraction, policy-versioning, retrieval, auth, rate-limit, documents, ...)
  integration/ (policy-api, policy-versions-api, requirement-approval, concurrent-publish, chat, ...)
```

### Protected areas — do not modify without explicit business approval

- `lib/ai/generateRecommendations.ts`
- `lib/ai/retrievePolicies.ts`
- `app/api/chat/route.ts`
- `lib/retrieval/*`, `lib/vector/*`

---

## Authoritative Policy Workflow (Phase 2)

> This workflow was implemented in Phase 2 and is the **source of truth for authoritative policy data**. It is **not** seeded, fabricated, or inferred. Verdict from `scripts/PHASE2-AUTHORITATIVE-DATA-WORKFLOW.md`: **PARTIAL** — workflow fully wired, but authoritative tables are empty pending real ADMIN action.

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

Per `Content/SureLM_Business_Context_Contract.md` §8, `RequirementDefinition` now carries (all nullable, so the migration is safe on any row state):

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

`surelm_0` was created via `prisma db push`, so it has **no `_prisma_migrations` history table**. The Phase 2F migration is recorded in the repo for history, and its exact SQL is applied directly to the DB by `scripts/phase2f-apply-migration.ts` (BEGIN/COMMIT, rollback on error, `ADD COLUMN IF NOT EXISTS`). `scripts/phase2f-verify-state.ts` confirms the columns exist and reports row counts.

---

## Corpus State (Phase 1)

Verified canonical state (see `scripts/PHASE1-CANONICAL-DATA-REPAIR.md` and `scripts/PHASE1-CANONICAL-MANIFEST.json`):

- **27** READY brochures (source PDFs in `PDF_STORAGE_DIR=S:/BackEndSureLM/data_phase2/pdfs`).
- **486** canonical chunks, **486** Qdrant vectors (`policy_knowledge`, 768-dim, Cosine).
- **0** canonical orphans (all chunks have a valid brochure).
- **3** legacy chunks with `brochureId = null` (IDs `113736`, `113736_2`, `113736_3`) — reported, **not deleted**. They predate the canonical repair.

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

## Implemented vs Blocked

**Implemented**
- Hybrid retrieval (FTS + vector + history), RRFS rerank, recommendation generation.
- Keycloak auth with ADMIN/AGENT roles and role guards.
- Authoritative policy workflow end-to-end: Policy → PolicyBrochure → RequirementDefinition (extract → review/approve) → PolicyVersion → immutable RequirementSnapshot.
- Phase 2F frozen-contract fields (additive, applied and verified).
- 27-brochure canonical corpus ingested; 486 chunks/vectors verified.
- Rate limiting, audit events, concurrent-publish safety, document processing pipeline.

**Blocked / NOT done**
- **End-to-end recommender validation on authoritative data** — blocked because authoritative tables are empty (`Policy`, `PolicyVersion`, `PolicyBrochure`, `RequirementDefinition`, `RequirementSnapshot` are all `0` rows). A real ADMIN must create policies and run the workflow before the recommender can be validated against authoritative data.
- Fallback LLM models are not installed — do not claim them as working.

---

## Developer Quick Start

Prerequisites: Docker & Docker Compose, Node.js 20+, Ollama running on `localhost:11434` with `qwen2.5:7b` (and `nomic-embed-text` for embeddings).

```bash
# 1. Start infrastructure (PostgreSQL surelm_0 + Qdrant + Keycloak)
docker-compose up -d

# 2. Ensure env files exist (never commit these)
#    .env.local (runtime-authoritative): DATABASE_URL=surelm_0@6432, QDRANT_URL=http://localhost:6334,
#    PRIMARY_MODEL_NAME=qwen2.5:7b, EXTRACTION_MODEL=qwen2.5:7b, KEYCLOAK_URL=https://localhost:18444/auth,
#    KEYCLOAK_REALM=surelm_0_realm, PDF_STORAGE_DIR=S:/BackEndSureLM/data_phase2/pdfs

# 3. Install deps + generate Prisma client
npm install
npx prisma generate

# 4. Bootstrap Keycloak (development)
npm run bootstrap:keycloak

# 5. Start the dev server (port 3001, bound to 127.0.0.1)
npm run dev
# Open http://localhost:3001
```

Verify the canonical DB before anything else:

```bash
npx tsx scripts/check-db-state.ts      # or phase2f-verify-state.ts for Phase 2F columns
```

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
| `test-db` | `tsx test-db.ts` | DB connectivity check |
| `test:api-auth` | `vitest run --config vitest.smoke.config.ts` | Live smoke auth test against a running instance |
| `test:all` | `tsx test-full-integration-report.ts` | Integration report runner (root `test-full-integration-report.ts`) |
| `bootstrap:keycloak` | `tsx scripts/bootstrap-keycloak.ts` | Keycloak init |

### Phase 2F verification

```bash
# Apply the additive migration (safe to re-run; idempotent ADD COLUMN IF NOT EXISTS)
npx tsx scripts/phase2f-apply-migration.ts

# Verify columns + row counts
npx tsx scripts/phase2f-verify-state.ts
```

Expected post-2F state: the 5 frozen columns exist on `RequirementDefinition`; authoritative tables are `0` rows until an ADMIN runs the workflow.

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
- `npx vitest run` → **37 files / 296 tests passing**.
- `npx prisma validate` and `npx prisma generate` pass.
- `npx tsc --noEmit` → only **3 pre-existing errors** in untracked Phase 1 scripts (`scripts/eval-baseline-retrieval.mts` duplicate property; `scripts/qdrant-integrity-audit.ts` cannot find module `./lib/db`; `scripts/qdrant-integrity-audit.ts` `Property 'filter' does not exist`). These are not in the shipped workflow code.

---

## Protect These Files

| Area | Reason |
|------|--------|
| `lib/ai/generateRecommendations.ts` | Core recommender logic — business-critical |
| `lib/ai/retrievePolicies.ts` | Retrieval entry — business-critical |
| `app/api/chat/route.ts` | Conversational API — business-critical |
| `lib/retrieval/*`, `lib/vector/*` | Search/vector internals |
| `prisma/schema.prisma` | Schema changes must be additive migrations, not destructive |
| `Content/SureLM_Business_Context_Contract.md` | Frozen business contract |

---

## Historical / Forensic Notes

- **Legacy DB incident (Phase 0):** the old runtime used `surelm` @ port `55432`, which was **not** the intended DB (intended: `surelm_0` @ `6432`). The `surelm` DB suffered destructive `db push` damage. The Windows `DATABASE_URL` override that caused this was removed. Full forensic details: `scripts/PHASE0-FORENSIC-FINDINGS.md`.
- Phase reports (in `scripts/`): `PHASE0-FORENSIC-FINDINGS.md`, `PHASE1-CANONICAL-DATA-REPAIR.md`, `PHASE2-AUTHORITATIVE-DATA-WORKFLOW.md`.
- Legacy chunks with `brochureId=null` (`113736`, `113736_2`, `113736_3`) are reported, not deleted.

---

## Known Debt & Blockers

1. **Authoritative tables empty** — recommender cannot be validated end-to-end on authoritative data until an ADMIN creates policies via the workflow.
2. **`.env` legacy model value** (`qwen2.5-coder:1.5b`) conflicts with `.env.local` (`qwen2.5:7b`); `.env.local` wins. Clean up per machine.
3. **Fallback models not installed** in Ollama.
4. **No `_prisma_migrations` history** on `surelm_0`; migrations must be applied by phase tooling, never by `db push`/`migrate dev`.
5. 3 pre-existing `tsc` errors in untracked Phase 1 scripts (see [Testing](#testing)).

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
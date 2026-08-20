# PHASE 0 — FORENSIC FINDINGS

**Date:** 2026-08-15
**Mode:** Read-only audit. No data modified.

---

## 1. Actual Intended Database

**surelm_0** on port 6432 (user: `admin`, password: `[REDACTED]`)

| Source | Evidence |
|--------|----------|
| `docker-compose.yml` | `container_name: surelm_0_postgres`, `POSTGRES_DB: surelm_0`, `ports: "6432:5432"` |
| `.env` | `DATABASE_URL=postgresql://admin:[REDACTED]@localhost:6432/surelm_0` |
| `.env.local` | `DATABASE_URL=postgresql://admin:[REDACTED]@localhost:6432/surelm_0` |
| `prisma.config.ts` | `datasource.url = env("DATABASE_URL")` → resolves to `.env` → surelm_0 |
| `SureLM_Business_Context_Contract.md` | Silo 1 pipeline operates against the canonical DB; docker-compose defines it |
| Keycloak config | `KC_DB_URL: jdbc:postgresql://postgres:5432/surelm_0` |

**Conclusion:** Every project configuration file specifies **surelm_0**.

## 2. Actual Runtime Database

**surelm** on port 55432 (user: `postgres`, password: `[REDACTED]`)

| Source | Evidence |
|--------|----------|
| Windows env var `DATABASE_URL` | `postgresql://postgres:[REDACTED]@localhost:55432/surelm?schema=public` |
| `dotenv` behavior | Never overrides existing env vars → runtime uses Windows var |
| `lib/db.ts` | `process.env.DATABASE_URL` → Windows var → surelm |
| Docker container | `surelm-postgres` from `S:\SureLMv2\AiForBharat2SureLM\docker-compose.infra.yml` — a **different project** |

**Conclusion:** The Windows environment variable OVERRIDES all .env files. The application connects to **surelm** (a different project's database).

## 3. surelm vs surelm_0 Comparison

| Table | surelm (55432) | surelm_0 (6432) | Notes |
|-------|----------------|-----------------|-------|
| Brochure | **29** | **0** | Corpus in wrong DB |
| Chunk | **488** | **3** | Corpus in wrong DB |
| Policy | 0 | 0 | Missing in BOTH |
| PolicyVersion | 0 | 0 | Missing in BOTH |
| PolicyBrochure | 0 | 0 | Missing in BOTH |
| RequirementDefinition | 0 | 0 | Missing in BOTH |
| RequirementSnapshot | 0 | 0 | Missing in BOTH |
| PolicyIssuance | 3 | 0 | surelm only |
| PolicyLead | 23 | 0 | surelm only |
| Tables total | 25 | 116 (incl. Keycloak) | |
| `_prisma_migrations` | Yes (9 rows, all applied_steps=0) | No | surelm was db-push-created |

## 4. Qdrant

| Property | Value |
|----------|-------|
| Instance | `surelm_0_qdrant` on port 6334 (correct stack) |
| Collection | `policy_knowledge` |
| Points | 486 |
| Dimensions | 768 (Cosine) |
| Payload keys | `brochure_id`, `chunk_id`, `content`, `page_num`, `category`, `version_num` |
| Brochure IDs | Match **surelm** brochure IDs (e.g., `cmstm9yws00cseohwkqhvcqj2` = TULIP) |
| Policy IDs in payload | None |

**Qdrant ↔ PostgreSQL linkage:**
```
Qdrant payload.brochure_id → surelm.Brochure.id ✓ (exists)
Qdrant payload.brochure_id → surelm_0.Brochure.id ✗ (0 rows — orphaned)
```

## 5. Frozen Requirements

**Source:** `Content/SureLM_Business_Context_Contract.md` + `Content/SureLM_Architecture_Remediation_Plan.md`

### Pipeline (Section 0):
```
ADMIN → Brochure ingestion → PDF storage → Text extraction → Chunking → Embedding
→ Qdrant policy_knowledge → Requirement extraction → RequirementDefinition drafts
→ ADMIN approval → PolicyVersion → RequirementSnapshot
```

### RequirementDefinition Contract (Section 8):
```
policyId, documentType, category, description, isMandatory, displayOrder,
allowReuse (default false), validationRules (maxAttempts=3), onMaxAttemptsMessage,
isDraft, extractedFrom, createdAt, updatedAt
```

### Invariants:
- `allowReuse = false` by default
- `validationRules.maxAttempts = 3`
- LLM output = draft (`isDraft = true`)
- ADMIN approval → `isDraft = false`
- Only approved requirements are versionable
- RequirementSnapshot is immutable (Section 11)
- LLM output ≠ authoritative requirement (Section 9)

### What Phase 2 Does NOT Implement (Section 3):
- recommendation-engine redesign
- chat protocol repair
- retrieval-stack consolidation

### Protected Files (Section 17):
- `lib/ai/generateRecommendations.ts` — PROTECTED
- `lib/ai/retrievePolicies.ts` — PROTECTED
- `app/api/chat/route.ts` — PROTECTED
- `lib/retrieval/*` — PROTECTED
- `lib/vector/*` — PROTECTED

## 6. Model Requirements

| Source | Model |
|--------|-------|
| `.env` | `PRIMARY_MODEL_NAME=qwen2.5-coder:1.5b` |
| `.env.local` | `PRIMARY_MODEL_NAME=qwen2.5:7b` |
| Frozen requirements | "LLM extraction" — no specific model named |

**Conflict:** `.env` and `.env.local` disagree on the primary model.

## 7. Recommender Data Availability

| Dependency | Required | Available | Status |
|------------|----------|-----------|--------|
| Brochure corpus | Yes | 29 in surelm, 0 in surelm_0 | **WRONG DB** |
| Qdrant vectors | Yes | 486 in policy_knowledge | **Keyed to wrong DB** |
| Policy records | Yes | 0 in both DBs | **MISSING** |
| PolicyVersion records | Yes | 0 in both DBs | **MISSING** |
| PolicyBrochure links | Yes | 0 in both DBs | **MISSING** |
| RequirementDefinition | Yes | 0 in both DBs | **MISSING** |
| RequirementSnapshot | Yes | 0 in both DBs | **MISSING** |

## 8. Code Vulnerabilities

| ID | Finding | Severity |
|----|---------|----------|
| V1 | Unsupported policy IDs pass through | P1 |
| V2 | Requirements not deterministically enforced | P1 |
| V3 | No minimum evidence threshold | P2 |
| V4 | LLM fails to abstain on vague queries | P2 |

## 9. What Can Be Fixed Without Changing Data

| Fix | Risk |
|-----|------|
| Remove Windows env var → switch to surelm_0 | **High** — surelm_0 has 0 brochures |
| Merge .env/.env.local config | Low |
| Dead code cleanup | Low |

## 10. What Is Genuinely Blocked

| Blocker | Cannot Fix Without |
|---------|-------------------|
| Frozen Policy/Requirement data missing | Manual ADMIN data entry |
| Brochure corpus in wrong DB | Re-ingestion into surelm_0 |
| Qdrant orphaned | Re-embedding from surelm_0 brochures |
| recommendation-engine redesign | Frozen requirement change |
| Retrieval-stack consolidation | Frozen requirement change |

## 11. Verdict: BLOCKED

The frozen SureLM recommender specification **cannot currently be implemented or validated** because:

1. The runtime database is wrong (surelm instead of surelm_0)
2. The brochure corpus is in the wrong database
3. The Qdrant vectors are orphaned from the canonical database
4. The frozen Policy/Requirement data does not exist in either database
5. The frozen architecture explicitly excludes recommendation-engine redesign

**Truth beats green tests. Provenance beats convenience. No fabricated data. No silent database switching. No model substitution. No destructive commands.**

# Phase 2O — Release Readiness Audit

**Date**: 2026-08-19
**Type**: Read-only audit — no code changes, no DB writes, no commits
**HEAD**: `55dc37a` (main, 8 commits ahead of origin/main)
**Verdict**: **RELEASE-BLOCKED**

---

## 1. Git / Repository Reproducibility

### Status: **FAIL**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **CRITICAL** | `.env` tracked in git with plaintext DB password `REDACTED_DB_PASSWORD` | `git ls-files .env` returns `.env`; added in commit `d630a22` before `.gitignore` rule existed |
| 2 | **CRITICAL** | `.env.local` tracked in git with plaintext credentials (`REDACTED_DB_PASSWORD`, `REDACTED_DEV_PASSWORD`) | `git ls-files .env.local` returns `.env.local`; added in commit `98b5399` before `.gitignore` rule existed |
| 3 | **CRITICAL** | `config/.env` tracked in git with plaintext DB password | `git ls-files config/.env` returns file; contains `admin:REDACTED_DB_PASSWORD` |
| 4 | **CRITICAL** | DB password `REDACTED_DB_PASSWORD` hardcoded in 8 committed source files as fallback | `config/env/base.ts`, `test/SetupKeycloak.ts`, `vitest.config.ts`, `jest.setup.js`, `scripts/bootstrap-keycloak.ts`, `.env*` files |
| 5 | **HIGH** | 244 `.next/` build artifact files tracked in git (added before `.gitignore`) | `git ls-files .next/ | wc -l` = 244 |
| 6 | **HIGH** | Default admin password `"REDACTED_BOOTSTRAP_PASSWORD"` hardcoded in `scripts/bootstrap-keycloak.ts` | Line 28: `const defaultPwd = "REDACTED_BOOTSTRAP_PASSWORD"` |
| 7 | **MEDIUM** | `.gitignore` rules for `.env`, `.env.local`, `.next/` are ineffective — files were committed before ignore rules | `.gitignore` only prevents new untracked files; does not untrack already-tracked files |
| 8 | **MEDIUM** | ~100+ untracked files on disk (scripts, tests, docs, certs, temp dirs) | `git status --short` shows massive `??` output |
| 9 | **LOW** | `prisma/finalize-pdf-storage.sql` untracked — would be lost on clean checkout | Not in `git ls-files` |

**Impact**: A fresh `git clone` will contain tracked `.env`, `.env.local`, `config/.env` with plaintext credentials. The `.next/` build cache adds ~200MB of useless files. The working tree is perpetually dirty.

**Prevents fresh developer from running**: Yes — credentials are exposed in the repo; `.next/` artifacts cause constant merge conflicts and dirty status.

---

## 2. Environment / Configuration

### Status: **FAIL**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **CRITICAL** | `SESSION_SECRET` required by `lib/auth/session.ts` but **not set** in any `.env` file | Throws at runtime if session management is active |
| 2 | **CRITICAL** | `ADMIN_REALM_ROLE` / `AGENT_REALM_ROLE` defined in `.env.example` but **never set** in `.env` or `.env.local` | Guards fall back to `"admin"` / `"agent"` — functional but undocumented deviation |
| 3 | **HIGH** | Two conflicting Keycloak docker-compose files: different ports (18444 vs 18443), versions (23.0 vs 24.0.3), admin passwords (`admin` vs `REDACTED_KC_PASSWORD`), DB configs | `docker-compose.yml` vs `docker-compose.keycloak.yml` |
| 4 | **HIGH** | Client-side Keycloak vars (`KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID`) used in `"use client"` components without `NEXT_PUBLIC_` prefix — resolve to `undefined`, fall back to wrong defaults | `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx` |
| 5 | **HIGH** | `config/.env` specifies wrong models (`qwen2.5-coder:1.5b`, `llama3.2:3b`) and wrong Qdrant port (`6333` vs `6334`) | `config/.env` line 6-7 vs `.env`/`.env.local` |
| 6 | **MEDIUM** | `.env.example` DATABASE_URL points to port 5432 / database `surelm` (legacy), not 6432 / `surelm_0` | `.env.example` line 1 |
| 7 | **MEDIUM** | `start-ollama.bat` sets port 11435 but all runtime configs use 11434 | `start-ollama.bat` line 2 vs `.env`/`.env.local` |
| 8 | **MEDIUM** | `lib/pdf/extract.ts` hardcodes `http://localhost:11434/api/embeddings` instead of reading `OLLAMA_HOST` | Line-level hardcoded URL |

**Required environment variables (42 total)**: See agent audit for full inventory. Critical missing: `SESSION_SECRET`, `ADMIN_REALM_ROLE`, `AGENT_REALM_ROLE`, `KEYCLOAK_ADMIN_USER`, `KEYCLOAK_ADMIN_PWD`.

**Prevents fresh developer from running**: Yes — `SESSION_SECRET` missing causes runtime crash; wrong Keycloak realm defaults cause auth failure.

---

## 3. Database Reproducibility

### Status: **FAIL**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **CRITICAL** | No `prisma migrate deploy` path — DB was created via `prisma db push`, no `_prisma_migrations` table exists | README line 210, `scripts/check-migrations.sql` would fail |
| 2 | **CRITICAL** | 2 partial unique indexes exist only in migration SQL, not in `schema.prisma` — `prisma db push` from schema alone would miss them | `20260807130000_phase3_security/migration.sql`, `20260808140000_phase4a_application/migration.sql` |
| 3 | **HIGH** | Fresh DB cannot be created from repo alone — requires manual migration application by phase tooling | No single-command setup path |
| 4 | **HIGH** | README Developer Quick Start has **no DB schema application step** (`prisma migrate deploy` or `prisma db push`) | README lines 373-392 |
| 5 | **MEDIUM** | `.env.example` points to wrong DB (`surelm@5432` vs `surelm_0@6432`) | `.env.example` line 1 |
| 6 | **MEDIUM** | `finalize-pdf-storage.sql` not integrated — schema/DB will drift on `pdfData` column | Untracked SQL file, not in migration system |
| 7 | **LOW** | Seed script (`prisma/seed.ts`) only covers dev data (leads, agents), not authoritative tables | By design — policies require real LLM extraction |

**Can a fresh DB be created from the repo alone?** **NO.** The migration system is bypassed. `prisma migrate deploy` would fail. `prisma db push` would miss partial unique indexes.

**Prevents fresh developer from running**: Yes — database schema cannot be automatically applied.

---

## 4. Runtime Startup

### Status: **PASS** (with caveats)

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **LOW** | `start-ollama.bat` uses port 11435, mismatching runtime config of 11434 | `start-ollama.bat` line 2 |
| 2 | **INFO** | Fallback LLM models not installed (llama3:latest, llama3.2:3b, llama3.1:8b return 404) | `.env`/`.env.local` fallback values |

**Services required**:

| Service | Port | Startup Method |
|---------|------|----------------|
| PostgreSQL | 6432 | `docker-compose up -d postgres` |
| Qdrant | 6334 | `docker-compose up -d qdrant` |
| Keycloak | 18444 | `docker-compose up -d keycloak` + `npm run bootstrap:keycloak` |
| Ollama | 11434 | Native install, `ollama serve`, pull `qwen2.5:7b` + `nomic-embed-text` |
| Next.js | 3001 | `npm run dev` |
| Document Worker | N/A | `npm run worker:documents` (optional, for doc processing) |

**Correct startup sequence** (after fixing P0 issues):
1. `docker-compose up -d`
2. Start Ollama, pull models
3. `npm install && npx prisma generate`
4. Apply database schema (currently broken — needs fix)
5. `npm run bootstrap:keycloak`
6. `npm run dev`

**Prevents fresh developer from running**: Partially — services are well-documented but DB schema step is missing/broken.

---

## 5. HTTP Integration (API Routes)

### Status: **PASS**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **LOW** | `GET /api/chat` is unprotected (health check — intentional) | `app/api/chat/route.ts` line 165 |
| 2 | **LOW** | 6 files have unused `validateAuth` / `getUserFromToken` imports (dead code) | `leads/route.ts`, `messages/route.ts`, `birthdays/route.ts`, `crm/route.ts`, `reminders/route.ts`, `leads/[id]/route.ts` |
| 3 | **INFO** | No blanket API auth in middleware — each route handles its own auth | `middleware.ts` runs on `/api/:path*` but `isProtectedRoute()` excludes `/api` |

**Coverage**: 52/53 handlers authenticated (98.1%). Auth: Keycloak RS256 JWT + JWKS. Roles: `admin`, `agent` (configurable via env). IDOR protection verified on all agent-facing routes. Rate limiting on ~28/53 handlers.

**Prevents fresh developer from running**: No.

---

## 6. Frontend Integration

### Status: **FAIL**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **CRITICAL** | Dead `KeycloakSession` import in `"use client"` components — imports server-only `next/headers` in client code. **Latent production build failure.** | `app/(dashboard)/dashboard/page.tsx:3`, `app/(dashboard)/crm/page.tsx:4` |
| 2 | **CRITICAL** | `KEYCLOAK_REALM` and `KEYCLOAK_CLIENT_ID` missing `NEXT_PUBLIC_` prefix in client components — fall back to wrong realm (`surelm_realm` vs `surelm_0_realm`) | `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx` |
| 3 | **HIGH** | `/crm` route not protected by middleware — page shell accessible without auth | `middleware.ts` matcher excludes `/crm` |
| 4 | **HIGH** | Root layout metadata says `"SureIm"` instead of `"SureLM"` | `app/layout.tsx` metadata.title |
| 5 | **MEDIUM** | 5 unused shadcn/ui components (dead code) | `components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `avatar.tsx`, `separator.tsx` — never imported |
| 6 | **MEDIUM** | Dead `BrochureManager.tsx` stub component | `components/dashboard/BrochureManager.tsx` — `<div>Hello</div>`, never imported |
| 7 | **MEDIUM** | 3 different sidebar implementations (no shared component) | `Sidebar.tsx` (dashboard), inline sidebar in policies/page.tsx, inline sidebar in crm/page.tsx |
| 8 | **LOW** | No `lib/api.ts` centralized API client — 30+ raw `fetch()` calls with no shared error handling | All components |
| 9 | **LOW** | `window.location.href` used for navigation instead of `next/navigation` `useRouter` | Auth pages — loses SPA benefits |

**Prevents fresh developer from running**: Yes — production build fails due to dead server-only import in client components.

---

## 7. Tests / Build

### Status: **FAIL** (production build blocked)

| Check | Result | Status |
|-------|--------|--------|
| `npx prisma validate` | Schema valid | **PASS** |
| `npx vitest run` | 37 files / 314 tests passing | **PASS** |
| `npx tsc --noEmit` | 3 pre-existing errors only | **PASS** (known) |
| `npx next build` | **Failed to compile** — `eval-baseline-retrieval.mts:39` duplicate property | **FAIL** |

**Pre-existing TypeScript errors (3)**:
1. `scripts/eval-baseline-retrieval.mts:39` — duplicate property in object literal (also blocks `next build`)
2. `scripts/qdrant-integrity-audit.ts:48` — cannot find module `./lib/db`
3. `scripts/qdrant-integrity-audit.ts:121` — `Property 'filter' does not exist on type 'number | never[]'`

**Production build blocker**: Error #1 (`eval-baseline-retrieval.mts:39`) blocks `next build` because the file is under `scripts/` which TypeScript includes during build. The file is untracked but TypeScript still processes it.

**Prevents fresh developer from running**: Yes — `npm run build` fails, blocking production deployment.

---

## 8. Documentation (README vs Reality)

### Status: **FAIL**

| # | Severity | Issue | Evidence |
|---|----------|-------|----------|
| 1 | **HIGH** | README says "300 tests passing" (line 449) — actual count is **314** | `npx vitest run` output: "Tests 314 passed" |
| 2 | **HIGH** | README says "222/230 requirements classified as POLICY_KNOWLEDGE" (line 360) — actual is **224** | Phase 2J audit output |
| 3 | **HIGH** | README says "20 policies issuable" (line 360) — actual is **21** (SmartLife fixed in Phase 2L) | Phase 2N audit output |
| 4 | **HIGH** | README says "2 blocked by extraction artifacts" (line 360/479) — actual is **1** (only Single Invest Plus; SmartLife fixed in Phase 2L) | Phase 2L commit `f51cace` |
| 5 | **HIGH** | README says "3 requirements across 2 policies" are UNCLASSIFIED (line 479) — actual is **1 requirement across 1 policy** (`max_attempts_message` in Single Invest Plus) | Phase 2M audit |
| 6 | **HIGH** | README says "20 policies issuable without customer evidence, 5 need KYC docs, 2 blocked" (line 360) — correct post-Phase 2L is **21/5/1** | Phase 2N audit |
| 7 | **MEDIUM** | README Developer Quick Start has **no DB schema application step** | Lines 373-392 — missing `prisma migrate deploy` or equivalent |
| 8 | **MEDIUM** | README does not mention `/dashboard` (chat), `/crm`, `/sign-in`, `/sign-up` routes | Repository Map section |
| 9 | **MEDIUM** | README says `reactCompiler: true` in next.config.ts but doesn't mention it's React 19 | Canonical Stack table |
| 10 | **LOW** | README mentions Phase 2K recommender validation as "not yet run" (line 478) — it was completed in commit `437ce3d` | Phase 2K report exists in `scripts/PHASE2K-AUTHORITATIVE-RECOMMENDER-E2E.md` |

**Prevents fresh developer from running**: Yes — following README instructions will not produce a working database.

---

## Final Verdict

### **RELEASE-BLOCKED**

| Area | Status | Blocks Release? |
|------|--------|-----------------|
| Git/Repository | **FAIL** — tracked credentials, `.next/` artifacts | **YES** |
| Environment/Config | **FAIL** — missing `SESSION_SECRET`, wrong Keycloak defaults | **YES** |
| Database | **FAIL** — no automated schema setup from repo | **YES** |
| Runtime Startup | **PASS** (with caveats) | No |
| HTTP Integration | **PASS** | No |
| Frontend | **FAIL** — dead server-only imports block production build | **YES** |
| Tests/Build | **FAIL** — `next build` fails on TS error | **YES** |
| Documentation | **FAIL** — stale numbers, missing DB setup steps | **YES** |

---

## Minimum Fixes Required Before Release (Ranked)

### P0 — Release Blockers (must fix before any release)

1. **Untrack `.env`, `.env.local`, `config/.env`** from git and add to `.gitignore` with `git rm --cached`. Create `.env.example` with placeholder values. Credentials persist in git history — rotate DB password and admin password for any non-dev deployment.

2. **Fix production build failure**: Remove or fix the duplicate property in `scripts/eval-baseline-retrieval.mts:39`, or exclude `scripts/` from TypeScript compilation in `tsconfig.json`. This blocks `npm run build`.

3. **Remove dead `KeycloakSession` import** from `app/(dashboard)/dashboard/page.tsx:3` and `app/(dashboard)/crm/page.tsx:4`. These import server-only `next/headers` in `"use client"` components — latent production build failure.

4. **Add `NEXT_PUBLIC_` prefix** to `KEYCLOAK_REALM` and `KEYCLOAK_CLIENT_ID` in `app/(auth)/sign-in/[[...sign-in]]/page.tsx` and `app/(auth)/sign-up/[[...sign-up]]/page.tsx`, or hardcode the correct values (`surelm_0_realm`, `web-app`). Currently auth pages point at wrong Keycloak realm.

5. **Add DB schema application step** to Developer Quick Start in README. Options: (a) `prisma db push` (fast, misses partial indexes), (b) write a canonical init SQL combining schema + partial indexes, or (c) squash/reset migration history so `prisma migrate deploy` works.

6. **Set `SESSION_SECRET`** in `.env.example` with a placeholder, and document it as required. `lib/auth/session.ts` throws if missing.

### P1 — High Priority (should fix before external release)

7. **Untrack 244 `.next/` files** from git: `git rm -r --cached .next/`. Add `.next/` to `.gitignore` (already present but ineffective).

8. **Remove hardcoded credentials** from committed source files: `config/env/base.ts`, `vitest.config.ts`, `jest.setup.js`, `test/SetupKeycloak.ts`, `scripts/bootstrap-keycloak.ts`. Use env vars with fallbacks to placeholders, not real passwords.

9. **Resolve conflicting docker-compose files**: Remove or clearly mark `docker-compose.keycloak.yml` as legacy/alternative. Ensure single source of truth for Keycloak setup.

10. **Fix Keycloak default URL mismatch**: Server defaults to `:18444`, client defaults to `:18443`. Standardize on `:18444` (matches primary `docker-compose.yml`).

11. **Update README stale numbers**: Tests (314 not 300), PK requirements (224 not 222), issuable policies (21 not 20), blocked policies (1 not 2), UNCLASSIFIED requirements (1 not 3).

12. **Add `/crm` to middleware matcher** in `middleware.ts` to protect the CRM page with auth.

13. **Fix root layout metadata**: Change `"SureIm"` to `"SureLM"` in `app/layout.tsx`.

### P2 — Medium Priority (should fix before public launch)

14. **Clean up `config/.env`**: Update models to `qwen2.5:7b` / `llama3.1:8b`, Qdrant port to `6334`, DB URL to `surelm_0@6432`. Or remove it entirely if only root `.env`/`.env.local` are authoritative.

15. **Fix `start-ollama.bat`**: Change port from 11435 to 11434 to match runtime config.

16. **Fix `lib/pdf/extract.ts`**: Read `OLLAMA_HOST` from env instead of hardcoding `http://localhost:11434`.

17. **Remove dead code**: 5 unused shadcn/ui components, `BrochureManager.tsx` stub, unused `KeycloakProvider` / `useKeycloak`, unused auth imports in 6 route files.

18. **Add `ADMIN_REALM_ROLE` / `AGENT_REALM_ROLE`** to `.env.example` (currently only documented in guards.ts code).

19. **Centralize API client**: Create `lib/api.ts` with shared fetch wrapper, error handling, and type safety.

20. **Untrack remaining junk files**: `.phase2h-tmp/`, `_dbinspect.cjs`, `free-11434.bat`, `start-ollama.bat`, `porttest.ps1`, `verify-keycloak-fix.ps1`, 20+ untracked markdown docs.

---

## Appendix: Evidence Files

| File | Purpose |
|------|---------|
| `scripts/phase2n-issuance-readiness-audit.ts` | Reusable live issuance audit script |
| `scripts/PHASE2N-ISSUANCE-READINESS.md` | Phase 2N issuance readiness report |
| `scripts/PHASE2K-AUTHORITATIVE-RECOMMENDER-E2E.md` | Phase 2K recommender E2E validation |
| `scripts/PHASE2J-REQUIREMENT-TAXONOMY.md` | Phase 2J taxonomy reconciliation |
| `scripts/PHASE1-CANONICAL-DATA-REPAIR.md` | Phase 1 canonical data repair |
| `scripts/PHASE0-FORENSIC-FINDINGS.md` | Phase 0 forensic findings |
| `Content/SureLM_Business_Context_Contract.md` | Frozen business contract |
| `docker-compose.yml` | Primary infrastructure orchestration |
| `prisma/schema.prisma` | Authoritative database schema |
| `.gitignore` | Git ignore rules (ineffective for already-tracked files) |

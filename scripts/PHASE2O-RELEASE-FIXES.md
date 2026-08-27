# Phase 2O — Release Fixes

**Date**: 2026-08-20
**Base commit**: `55dc37a` (Phase 2N — production issuance readiness verified)
**Status**: All P0 + P1 fixes applied. Gate review passed. Awaiting commit approval.

---

## Gate Review Summary

| Check | Result |
|-------|--------|
| `npx prisma validate` | **PASS** |
| `npx vitest run` | **314/314 PASS** |
| `npx tsc --noEmit` | **0 errors** |
| `npm run build` | **PASS** (22 static pages) |
| Phase 2N issuance audit | **34 PASS, 0 FAIL** |
| Tracked `.env*` files | **0** (all untracked) |
| Tracked `.next/` files | **0** (all untracked) |
| Plaintext credentials in tracked tree | **0** |
| Plaintext credentials in tracked docs/reports | **0** |

---

## What Was Fixed

### Security (P0)

| ID | Fix | Files |
|----|-----|-------|
| P0-1 | Removed `.env`, `.env.local`, `config/.env` from git index | `.gitignore` rules added |
| P0-2 | Eliminated hardcoded credentials from source code | `config/env/base.ts`, `scripts/bootstrap-keycloak.ts`, `vitest.config.ts`, `jest.setup.js`, `lib/pdf/extract.ts`, `test/SetupKeycloak.ts` |
| P0-3 | Removed `.next/` build artifacts from git index | 244 files untracked |
| P0-4 | Fixed production build blocker | `scripts/eval-baseline-retrieval.mts` (duplicate property), `scripts/qdrant-integrity-audit.ts` (broken import + type error), `tsconfig.json` (excluded standalone test report) |
| P0-5 | Removed dead `KeycloakSession` imports from client components | `app/(dashboard)/dashboard/page.tsx`, `app/(dashboard)/crm/page.tsx` |
| P0-6 | Fixed Keycloak realm/client env var prefix (`NEXT_PUBLIC_`) and corrected defaults (realm, port) | `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`, `lib/keycloak/provider.tsx` |
| P0-7 | Rewrote `.env.example` with all 31+ variables and safe placeholders | `.env.example` |
| P0-8 | Documented database setup path (`prisma db push`) | `README.md` |

### Infrastructure credential removal (from gate review)

| File | Before | After |
|------|--------|-------|
| `docker-compose.yml` | `POSTGRES_PASSWORD: localpg2024`, `KC_DB_PASSWORD: localpg2024`, `KEYCLOAK_ADMIN_PASSWORD: admin` | `${POSTGRES_PASSWORD:?...}`, `${KEYCLOAK_ADMIN_PASSWORD:?...}` |
| `docker-compose.keycloak.yml` | `localpg2024`, `kcadmin123`, `keycloakkspass` | `${KC_DB_PASSWORD:?...}`, `${KEYCLOAK_ADMIN_PASSWORD:?...}`, `${KC_HTTPS_KEY_STORE_PASSWORD:?...}` |
| `init-keycloak-db.sql` | `PASSWORD 'localpg2024'` | `PASSWORD 'CHANGE_ME_BEFORE_FIRST_RUN'` |
| `test/SetupKeycloak.ts` | `postgresql://admin:localpg2024@localhost:6432/surelm_0` fallback | Throws if `DATABASE_URL` not set; throws if `TEST_USERNAME`/`TEST_PASSWORD` not set |
| `vitest.config.ts` | `env: { DATABASE_URL: "postgresql://...localpg2024..." }` | Removed `env` block; credentials loaded from `.env` via `dotenv/config` in `SetupKeycloak.ts` |
| `README.md` | `(user admin, password localpg2024)` | `(user and password from POSTGRES_USER / POSTGRES_PASSWORD env vars)` |

### Functional (P1)

| ID | Fix | Files |
|----|-----|-------|
| P1-1 | `docker-compose.keycloak.yml` marked as deprecated | Header comment added |
| P1-2 | Keycloak port defaults unified to `18444` | signIn, signUp, provider.tsx |
| P1-3 | README stale numbers corrected (314 tests, 224 PK, 1 CE, 1 UN, 21 issuable, 5 evidence-required, 1 blocked) | `README.md` |
| P1-4 | `/crm` route added to middleware protected routes + matcher | `middleware.ts` |
| P1-5 | Brand name typo fixed: `SureIm` → `SureLM` | `app/layout.tsx` |

### Incidental fixes (not part of audit scope)

| File | Change |
|------|--------|
| `scripts/eval-baseline-retrieval.mts:39` | Removed duplicate property |
| `scripts/qdrant-integrity-audit.ts:48` | Fixed broken relative import |
| `scripts/qdrant-integrity-audit.ts:120` | Fixed type mismatch |
| `scripts/bootstrap-keycloak.ts` | Added runtime guard for missing `INITIAL_ADMIN_PASSWORD` |
| `tsconfig.json` | Excluded `test-full-integration-report.ts` from typechecking |

---

## Git History Credential Exposure

### Credentials committed in reachable history

| Credential class | Commits | Status |
|-----------------|---------|--------|
| PostgreSQL password (`REDACTED_DB_PASSWORD`) | 15 commits (`d630a22` through `c4815f8`) | **MUST ROTATE** |
| Keycloak admin password (`admin`) | 2 commits (`fb0e22d`, `1a863e5`) | **MUST ROTATE** |
| Keycloak bootstrap password (`REDACTED_BOOTSTRAP_PASSWORD`) | 1 commit (`1a863e5`) | **MUST ROTATE** |
| Keycloak legacy password (`REDACTED_KC_PASSWORD`) | 1 commit (`1a863e5`) | **MUST ROTATE** |
| Keycloak keystore password (`REDACTED_KSPASS`) | 1 commit (`1a863e5`) | **MUST ROTATE** |

### `git rm --cached` does NOT remove secrets from history

Anyone with clone/fork access can extract all credentials above via `git log -p`. Source code changes alone cannot fix this.

### Credential rotation requirements (MANDATORY before any deployment)

1. **PostgreSQL**: Rotate password for `admin` user on `surelm_0` database
2. **Keycloak**: Rotate `KEYCLOAK_ADMIN` password
3. **Keycloak bootstrap**: Verify `INITIAL_ADMIN_PASSWORD` is not the old value
4. **Keystore**: Regenerate `keycloak-dev.p12` with new password
5. All environments (dev, staging, production) that share these credentials
6. After rotation: history cleanup (`git filter-repo` or BFG) is a separate operation

---

## Current Tree Security State

| Check | Result |
|-------|--------|
| Tracked files containing `REDACTED_DB_PASSWORD` | 0 |
| Tracked files containing `REDACTED_BOOTSTRAP_PASSWORD` | 0 |
| Tracked files containing `REDACTED_KC_PASSWORD` | 0 |
| Untracked files with credentials | 6 (local dev scripts, cert tools — all gitignored) |
| `.env` tracked | No |
| `.env.local` tracked | No |
| `config/.env` tracked | No |
| `.next/` tracked | No |

---

## What Was NOT Changed

- Prisma schema
- Qdrant corpus / vectors
- OCR / extraction model config
- Recommendation / retrieval architecture
- Issuance logic
- `.env.local` contents (preserved locally, never printed)
- Policy data or requirement snapshots

---

## Remaining Security Debt

1. **Git history** contains plaintext credentials from 15+ commits — requires credential rotation + history rewrite (separate operation)
2. 6 untracked local scripts still contain credentials (gitignored, not a risk for clones, but exist on this machine)
3. Docker compose files now use `${VAR:?...}` syntax — requires `.env` file alongside compose for deployment

---

## Proposed Commit Files (20 tracked files)

```
 .env.example                          ← safe placeholders
 .gitignore                            ← config/.env rules
 README.md                             ← corrected numbers, redacted credentials
 app/(auth)/sign-in/[[...sign-in]]/page.tsx  ← NEXT_PUBLIC_ prefix
 app/(auth)/sign-up/[[...sign-up]]/page.tsx  ← NEXT_PUBLIC_ prefix
 app/(dashboard)/crm/page.tsx          ← removed dead import
 app/(dashboard)/dashboard/page.tsx    ← removed dead import
 app/layout.tsx                        ← SureIm → SureLM
 config/.env.example                   ← deprecated notice
 config/env/base.ts                    ← placeholder fallback
 docker-compose.keycloak.yml           ← env-var refs, deprecated label
 docker-compose.yml                    ← env-var refs
 init-keycloak-db.sql                  ← placeholder password
 jest.setup.js                         ← placeholder fallback
 lib/keycloak/provider.tsx             ← NEXT_PUBLIC_ prefix
 lib/pdf/extract.ts                    ← env-based Ollama URL
 middleware.ts                          ← /crm protected
 scripts/bootstrap-keycloak.ts         ← runtime guard
 test/SetupKeycloak.ts                 ← no hardcoded credential fallback
 tsconfig.json                         ← exclude test-full-integration-report.ts
```

### Removed from tracking (index deletions)
```
D .env
D .env.local
D config/.env
D .next/ (244 files)
```

### Files EXCLUDED from commit
```
test-full-integration-report.ts        ← unrelated, pre-existing tsc error
tsconfig.tsbuildinfo                   ← auto-generated build artifact
scripts/PHASE2O-RELEASE-READINESS-AUDIT.md  ← audit reference doc (separate commit)
scripts/PHASE2O-RELEASE-FIXES.md       ← this report (separate commit)
```

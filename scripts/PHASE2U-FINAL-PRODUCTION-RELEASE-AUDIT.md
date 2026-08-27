# PHASE 2U — Final Production Release Audit

**Audit Date:** 2026-08-26
**Branch:** `main` (HEAD: `131d44e8255e16f2a3e25464edf053fef4026d32`)
**Audit Type:** Adversarial Deep-Dive — Zero Trust
**Pre-Audit Fixes Applied:** Phase 2O (268 files), Phase 2S (7 blockers), Phase 2T (10 high-priority)

---

## Verification Summary (All PASS)

| Command | Result |
|---|---|
| `prisma validate` | PASS |
| `vitest run` | 44 test files / 328 tests — all PASS |
| `tsc --noEmit` | 0 errors |
| `npm run build` | Build successful |
| `npm audit` | Moderate/High vulnerabilities — all in dev/transitive dependencies. Fix available via `npm audit fix`. |

---

## Findings Summary

| Severity | Count |
|---|---|
| CRITICAL | 3 |
| HIGH | 13 |
| MEDIUM | 17 |
| LOW | 11 |
| **TOTAL** | **44** |
| **Production Blockers** | **6** |

---

## CRITICAL Findings (3)

### C-01 — Secrets still in Git history (backup branches)
- **File:** backup branches `backup-20260713`, `backup/pre-refactor-2026-07-27`
- **Severity:** CRITICAL
- **Blocks Release:** Yes (compliance)
- **Evidence:** `git show <old-sha>:.env` reveals `POSTGRES_PASSWORD`, `KC_ADMIN_PASSWORD`, `SESSION_SECRET` in backup branch history.
- **Mitigation:** Phase 2Q rewrote `main` branch. Backup branches intentionally preserved per user decision (treated as compromised).
- **Action Required:** User decision to accept residual risk. Remote backup branches are NOT pushed. Local mirror at `S:\BackEndSureLM.mirror-backup` must not be deleted.

### C-02 — `filePath` leaked via `listBrochures` in batchProcess.ts
- **File:** `lib/pdf/batchProcess.ts:518`
- **Severity:** CRITICAL
- **Blocks Release:** Yes
- **Evidence:** `listBrochures` function selects `filePath: true` from Prisma. Any authenticated user calling `GET /api/brochures` (which uses `listBrochures`) can see the server filesystem path of every PDF. Phase 2T H2 only fixed the individual `GET /api/brochures/:id` route, not this listing function.
- **Action Required:** Remove `filePath` from `listBrochures` select before production release.

### C-03 — Keycloak cert password mismatch with generator script
- **File:** `docker-compose.yml:48` vs `keycloak/certs/gen-keystore.sh:3`
- **Severity:** CRITICAL
- **Blocks Release:** Yes (Keycloak HTTPS fails)
- **Evidence:** `docker-compose.yml` defaults `KC_HTTPS_KEY_STORE_PASSWORD` to `keycloak`. The `gen-keystore.sh` and `Dockerfile.genkeystore` generate keystores with password `keycloakkspass`. The `certs/keycloak-dev.p12` file was apparently generated with password `keycloak`. If a new developer runs the documented generator script, they produce a keystore that Keycloak cannot open, causing HTTPS to fail.
- **Action Required:** Reconcile generator script password with docker-compose default, or document the correct process.

---

## HIGH Findings (13)

### H-01 — `ts-node` in build script but only in devDependencies
- **File:** `package.json:8,63`
- **Blocks Release:** Yes
- **Evidence:** `"build": "ts-node scripts/cleanup.ts && prisma generate && next build"`. `ts-node` is in `devDependencies`. If `npm ci --omit=dev` is used, build fails.

### H-02 — `.dockerignore` missing — secrets leak into Docker image layers
- **File:** (missing)
- **Blocks Release:** Yes
- **Evidence:** No `.dockerignore` file. `docker build` copies `.env`, `node_modules/`, `.git/`, `backups/`, `.next/`, `keycloak/certs/`, `certs/` into image. Credentials extractable via `docker history`.
- **Action Required:** Create `.dockerignore` excluding `.env*`, `node_modules`, `.git`, `backups`, `.next`, `test*`, `*.md`, `keycloak/`, `certs/`.

### H-03 — `.env.example` missing 4 required Docker env vars
- **File:** `.env.example`
- **Blocks Release:** Yes
- **Evidence:** `POSTGRES_USER`, `POSTGRES_PASSWORD`, `KEYCLOAK_ADMIN_PASSWORD`, `KC_HTTPS_KEY_STORE_PASSWORD` are required by `docker-compose.yml` (via `:?` mandatory syntax) but not documented in `.env.example`. New deployers will fail.

### H-04 — Keycloak HTTPS cert config fragile in 26.x
- **File:** `docker-compose.yml:40-49`
- **Blocks Release:** Yes
- **Evidence:** Default `.p12` cert may not have `localhost` as SAN. `KC_HOSTNAME_STRICT_HTTPS: false` is set but dev certs rarely include correct SANs. TLS handshake failures would block all OIDC operations.

### H-05 — Keycloak has no Docker health check
- **File:** `docker-compose.yml:30-58`
- **Blocks Release:** No (bootstrap risk)
- **Evidence:** Keycloak depends on postgres with `service_healthy` but has no own health check. The app health route checks postgres + qdrant but not Keycloak. Bootstrap scripts or first requests hitting Keycloak immediately may fail (Keycloak can take 30-60s to start).

### H-06 — `readPdfFromBrochure` reads from DB `filePath` without path validation
- **File:** `lib/pdf/batchProcess.ts`
- **Blocks Release:** No (defense-in-depth)
- **Evidence:** Reads file from path stored in database. If DB is compromised or `filePath` is tampered, could read arbitrary files.

### H-07 — Unbounded `limit`/`offset` on brochure listing
- **File:** API brochure listing route
- **Blocks Release:** No (DoS risk)
- **Evidence:** No cap on `limit` parameter. Large requests could cause OOM.

### H-08 — No size cap on orchestrate `messages` array
- **File:** Chat/orchestrate endpoint
- **Blocks Release:** No (DoS risk)
- **Evidence:** Incoming messages array has no maximum length validation.

### H-09 — `buildPrompt` flattens all roles to uppercase strings
- **File:** `lib/ai/agents/llm.ts`
- **Blocks Release:** No (LLM correctness)
- **Evidence:** All message roles converted to `UPPERCASE` strings, losing distinction between `system`/`user`/`assistant`.

### H-10 — No `Content-Security-Policy` header
- **File:** `next.config.ts`
- **Blocks Release:** No (defense-in-depth)
- **Evidence:** Other security headers added in B4 but CSP is absent. Higher risk of XSS via injected scripts.

### H-11 — `lib/server/shutdown.ts` is dead code
- **File:** `lib/server/shutdown.ts:1-32`
- **Blocks Release:** No (code quality)
- **Evidence:** `registerShutdownHandlers()` never called anywhere. Actual shutdown logic is in `instrumentation.ts`.

### H-12 — `prisma` CLI in `dependencies` (not devDependencies)
- **File:** `package.json:39`
- **Blocks Release:** No (attack surface / image bloat)
- **Evidence:** `prisma` CLI is a build-time tool. Shipping it in production increases attack surface and pulls in `@prisma/dev`/`@prisma/config` which bring `fast-uri` (HIGH vuln) and `deepmerge-ts` (HIGH vuln).

### H-13 — `@prisma/adapter-neon` in dependencies but never imported
- **File:** `package.json:25`
- **Blocks Release:** No (dead weight)
- **Evidence:** `@prisma/adapter-neon` (~5MB) is listed but zero imports exist. Only `@prisma/adapter-pg` is used (`lib/db.ts:2`).

---

## MEDIUM Findings (17)

| # | Finding | File | Evidence |
|---|---|---|---|
| M-01 | Middleware is silent no-op for API routes | `middleware.ts` | API routes pass through without auth enforcement |
| M-02 | `hasRealmRole()`/`hasClientRole()` always return false | `lib/auth/guards.ts` | `extractUser()` doesn't map roles from JWT |
| M-03 | `secure` cookie flag disabled outside production | `lib/auth/session.ts` | `secure: false` when `NODE_ENV !== "production"` |
| M-04 | CSRF not enforced on state-changing endpoints | Various API routes | No CSRF token validation on POST/PUT/DELETE |
| M-05 | No CORS headers configured | `next.config.ts` | No `Access-Control-Allow-Origin` headers |
| M-06 | `POSTGRES_PASSWORD` exposed as env var in Docker | `docker-compose.yml:8` | Visible via `docker inspect` |
| M-07 | Qdrant has no Docker health check | `docker-compose.yml:22-28` | No `healthcheck` block; app starts before Qdrant ready |
| M-08 | `instrumentation.ts` dynamic import hack via `new Function` | `instrumentation.ts:18-19` | Fragile; bundler may inline the `new Function` call |
| M-09 | Backup script `.env` parse breaks on spaces | `scripts/backup-db.sh:16` | `export $(grep -v '^#' .env \| xargs)` fails on quoted values |
| M-10 | Backup script no `POSTGRES_PASSWORD` validation | `scripts/backup-db.sh:30` | Empty password causes confusing auth error |
| M-11 | Chat GET fake health check (always `healthy`) | `app/api/chat/route.ts:165-171` | Unauthenticated; masks real outages |
| M-12 | No `engines` field — Node version unbounded | `package.json` | No constraint; could run on incompatible Node |
| M-13 | `process.env.OLLAMA_HOST` read without URL validation | `lib/ai/agents/llm.ts` | SSRF risk if env is poisoned |
| M-14 | `sameSite: "lax"` doesn't protect POST form submissions | `lib/auth/session.ts` | Cross-origin POST forms not blocked |
| M-15 | `dotenv.config()` at module level in production lib code | `lib/db.ts:3-5`, `lib/ai/embeddings.ts:1-3`, `lib/config.ts:4-6` | Tries to read `.env` file in Docker (fails silently or reads stale file) |
| M-16 | `pdf-parse` in devDependencies but never imported | `package.json:60` | Dead dependency; likely replaced by `pdfjs-dist` |
| M-17 | Triple dead duplicate loggers with `__dirname` ESM bug | `config/logging.ts`, `lib/logging/index.ts`, `Conan/logger/winston.ts` | None imported; would crash in ESM due to bare `__dirname` |

---

## LOW Findings (11)

| # | Finding | File | Evidence |
|---|---|---|---|
| L-01 | `@types/winston` in dependencies | `package.json:28` | Type packages belong in devDependencies |
| L-02 | `isShuttingDown` guard on register() unnecessary | `instrumentation.ts:1,4` | register() called once by Next.js |
| L-03 | `PGPASSWORD` visible in process listing | `scripts/backup-db.sh:30` | Standard pg_dump limitation |
| L-04 | `writePdfToDisk` lacks explicit hash safety check | `lib/pdf/batchProcess.ts` | Relies on caller to validate |
| L-05 | `BrochureLog` missing `onDelete: Cascade` | `prisma/schema.prisma:304` | Defaults to `Restrict`; intentional audit preservation |
| L-06 | `Chunk.brochure` missing `onDelete: Cascade` | `prisma/schema.prisma:317` | Defaults to `Restrict` |
| L-07 | `cleanup.ts` runs in every prod build | `package.json:8` | Wasteful in CI/CD; no temp files exist |
| L-08 | Docker secrets as env vars (accepted for single-node) | `docker-compose.yml` | Standard Docker Compose pattern |
| L-09 | No `Content-Type` validation on some POST routes | Various | Zod schemas now cover main routes |
| L-10 | `console.log` in production shutdown handler could leak stack traces | `instrumentation.ts:11,23` | Error objects may contain connection strings |
| L-11 | `KC_HOSTNAME_STRICT_HTTPS: false` in production | `docker-compose.yml:43` | Disables strict HTTPS hostname verification |

---

## Production Verdict

### 🟡 CONDITIONAL RELEASE

**Production blockers (6):**
1. **C-02** — `filePath` leak via `listBrochures` (security)
2. **C-03** — Keycloak cert password mismatch (Keycloak HTTPS failure)
3. **H-01** — `ts-node` build dependency (build failure)
4. **H-02** — Missing `.dockerignore` (credential leakage)
5. **H-03** — Missing `.env.example` vars (deployability)
6. **H-04** — Keycloak TLS cert config (OIDC failure)

**Acceptable risk (with documented decisions):**
- **C-01** — Secrets in backup branch history (user-decided; backup branches not pushed)
- **H-10** — No CSP header (defense-in-depth; can add post-launch)
- **H-11** — Dead shutdown code (cleanup, not blocking)
- **H-13** — Dead adapter dependency (cleanup, not blocking)

**Can be addressed post-launch:**
- All MEDIUM and LOW findings
- H-05, H-06, H-07 (DoS hardening)
- H-08, H-09 (LLM correctness)
- H-12, H-13 (dependency cleanup)

---

## Recommended Pre-Release Fixes (6)

Before deploying to production, fix these 6 blockers:

1. **C-02**: Remove `filePath` from `listBrochures` select in `lib/pdf/batchProcess.ts:518`
2. **C-03**: Reconcile Keycloak cert generator password with `docker-compose.yml` default
3. **H-01**: Move `ts-node` to `dependencies` OR change build script to use `npx ts-node`
4. **H-02**: Create `.dockerignore` file
5. **H-03**: Add missing vars to `.env.example`
6. **H-04**: Generate proper self-signed cert for Keycloak with correct SANs

---

## Audit Methodology

- 4 parallel adversarial sub-agents covering:
  - Area 1: Auth, Session, JWT, Keycloak
  - Areas 2,3: API Auth, IDOR, Validation, SQL Injection
  - Areas 4,5,6: File Upload, Filesystem, SSRF, MIME, SQL
  - Areas 7,8,10,11: RAG, LLM Prompt Injection, Secrets, Headers, CORS
  - Areas 9,12,13,14,15: Docker, Runtime, Shutdown, Backup, Dependencies, Build Config
- Each sub-agent read production source code and checked for real vulnerabilities
- Verification: `prisma validate`, `vitest run`, `tsc --noEmit`, `npm run build`, `npm audit`
- Zero trust approach: assumed all code is vulnerable until verified

---

*Generated by Phase 2U adversarial audit. Do not start Phase 2V. Do not fix, commit, or push.*

# Phase 2R — Post-Security Production Hardening Audit

**Date:** 2026-08-26
**Status:** READ-ONLY AUDIT — no changes made
**Branch audited:** `origin/main` @ `131d44e`

---

## RELEASE BLOCKERS

These MUST be fixed before any production deployment.

### B1 — `@prisma/adapter-pg` in devDependencies (production crash)

| | |
|---|---|
| **Severity** | P0 |
| **File** | `lib/db.ts:2` (import) + `package.json:49` (devDeps) |
| **Evidence** | `import { PrismaPg } from "@prisma/adapter-pg";` — but `@prisma/adapter-pg` is listed in `devDependencies`, not `dependencies` |
| **Impact** | `npm install --omit=dev` or `npm ci --production` will not install `@prisma/adapter-pg`. The application crashes immediately on boot with `MODULE_NOT_FOUND`. Zero database connectivity. |
| **Fix** | Move `@prisma/adapter-pg` from `devDependencies` to `dependencies` |
| **Blocks prod** | **YES — total application failure** |

### B2 — `SESSION_SECRET` missing from `.env`

| | |
|---|---|
| **Severity** | P1 |
| **File** | `lib/auth/session.ts:245-248` + `.env` (absent) + `.env.example:41` |
| **Evidence** | `const secret = process.env.SESSION_SECRET;` — not set in `.env` or `.env.local`. The `KeycloakSession.get()` method throws `"SESSION_SECRET is not configured"` when this is absent. `.env.example` has `SESSION_SECRET=CHANGEME`. |
| **Impact** | `GET /api/auth/me` returns 500. Any route using `KeycloakSession.get()` crashes. The cookie-based auth path is completely non-functional. |
| **Fix** | Add `SESSION_SECRET=<256-bit-random>` to `.env`. Ensure production deployment always sets this. |
| **Blocks prod** | **YES — auth/session system non-functional** |

### B3 — Keycloak running in `start-dev` mode

| | |
|---|---|
| **Severity** | P1 |
| **File** | `docker-compose.yml:39` |
| **Evidence** | `command: start-dev` — Keycloak development mode disables HTTPS enforcement, enables dev features, exposes admin console over HTTP, disables production caching |
| **Impact** | Admin console accessible over unencrypted HTTP on port 8081. Dev features active. Production caching disabled (performance + security). |
| **Fix** | Switch to `command: start` with proper TLS certificate configuration for production |
| **Blocks prod** | **YES — security features disabled** |

### B4 — Zero security headers

| | |
|---|---|
| **Severity** | P1 |
| **File** | `next.config.ts:1-8` |
| **Evidence** | Empty config: `const nextConfig: NextConfig = { reactCompiler: true };` — no `headers()` config at all. No CSP, X-Frame-Options, X-Content-Type-Options, HSTS, Referrer-Policy, or Permissions-Policy. |
| **Impact** | Clickjacking (no X-Frame-Options), MIME sniffing (no X-Content-Type-Options), no XSS defense-in-depth (no CSP), no transport security hint (no HSTS). Compliance violation for any regulated deployment. |
| **Fix** | Add `headers()` with security headers for all routes |
| **Blocks prod** | **YES — security compliance violation** |

### B5 — Batch brochure upload: arbitrary filesystem path

| | |
|---|---|
| **Severity** | P1 |
| **File** | `app/api/brochures/batch/route.ts:14-16` |
| **Evidence** | `const body = await request.json() as { folderPath?: string; ... }; const folderPath = body.folderPath \|\| FOLDER_PATH;` — user-supplied `folderPath` passed directly to `scanPdfFolder()` which calls `readdir()` |
| **Impact** | Admin can pass `folderPath: "/etc"` or `"C:\\Windows\\System32"` to read any directory listing. Error messages at line 102 also leak `(error as Error).message` containing OS-level paths. Combined with admin-only access, a compromised admin account = full server directory enumeration. |
| **Fix** | Reject user-supplied `folderPath`; only use server-configured `FOLDER_PATH` env var. Validate with path canonicalization and allowlist. |
| **Blocks prod** | **YES — arbitrary filesystem read** |

### B6 — Brochure upload lacks magic-byte MIME verification

| | |
|---|---|
| **Severity** | P1 |
| **File** | `app/api/brochures/route.ts:43` |
| **Evidence** | `if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))` — only checks client-declared MIME type and filename extension. The document upload route (`documents/route.ts:65`) correctly uses `detectMimeType()` magic-byte checking, but the brochure route does not. |
| **Impact** | Polyglot file (e.g., HTML served as PDF) can pass this check and be ingested into the RAG knowledge base. A poisoned brochure taints all downstream LLM recommendations. |
| **Fix** | Import `detectMimeType` from `lib/documents/storage.ts` and validate magic bytes before processing |
| **Blocks prod** | **YES — knowledge base poisoning vector** |

### B7 — `.env.example` has `SESSION_SECRET=CHANGEME`

| | |
|---|---|
| **Severity** | P1 |
| **File** | `.env.example:41` |
| **Evidence** | `SESSION_SECRET=CHANGEME` — if deployed without changing, attacker can forge arbitrary HMAC-signed session cookies |
| **Impact** | Session forgery → user impersonation via `/api/auth/me` endpoint |
| **Fix** | Change to `SESSION_SECRET=  # REQUIRED: generate with openssl rand -hex 32` |
| **Blocks prod** | **YES — session forgery** |

---

## HIGH PRIORITY

Fix shortly after launch, before any real user data flows through the system.

### H1 — Error messages leaked to clients (8+ routes)

| | |
|---|---|
| **Severity** | P2 |
| **Files** | `app/api/orchestrate/query/route.ts:40`, `app/api/orchestrate/query-stream/route.ts:49`, `app/api/brochures/batch/route.ts:101`, `app/api/brochures/[id]/process/route.ts:49`, `app/api/policies/[id]/versions/route.ts:64`, `app/api/policies/[id]/requirements/route.ts:66`, `app/api/policies/[id]/requirements/[requirementId]/route.ts:61,91`, `app/api/policies/[id]/requirements/[requirementId]/approve/route.ts:44`, `app/api/recommendations/route.ts:56` |
| **Evidence** | Pattern: `(error as Error).message` returned directly in JSON response body |
| **Impact** | Internal error messages contain DB constraint names, file system paths, Prisma model names, Ollama connection errors. Information disclosure aids attacker reconnaissance. |
| **Fix** | Return generic error strings to clients. Log full details server-side with Winston. |

### H2 — Brochure GET exposes server `filePath`

| | |
|---|---|
| **Severity** | P2 |
| **File** | `app/api/brochures/[id]/route.ts:23` |
| **Evidence** | `filePath: true` in `select` — returns absolute server path (e.g., `/data/pdfs/abc123.pdf`) to any `requireAuth` user |
| **Impact** | Any authenticated user (not just admin) sees the server's filesystem layout. Aids path traversal attacks. |
| **Fix** | Remove `filePath` from the select, or gate behind `requireAdmin` |

### H3 — No `/api/health` endpoint (misleading health check)

| | |
|---|---|
| **Severity** | P2 |
| **File** | `app/api/chat/route.ts:165-171` (fake health check) + `lib/db/health.ts` (real health check exists but is NOT exposed) |
| **Evidence** | `GET /api/chat` returns `{ status: "healthy" }` without checking DB or Qdrant. Real `checkAllHealth()` in `lib/db/health.ts` is never exposed via any API route. No `/api/health` or `/api/healthz` route exists. |
| **Impact** | Load balancers, Docker health checks, and monitoring tools cannot verify actual service health. The fake health endpoint will report "healthy" even when the database is completely down. |
| **Fix** | Create `/api/health/route.ts` that calls `checkAllHealth()` from `lib/db/health.ts` |

### H4 — LLM prompt injection via user chat messages

| | |
|---|---|
| **Severity** | P2 |
| **File** | `lib/ai/orchestrator.ts:141,155,213,232,350,374` + `app/api/chat/route.ts:39-40` |
| **Evidence** | User messages are passed unsanitized to LLM prompts. `chat/route.ts:40` passes `role: "system"` through from user input. The orchestrator filters system messages at line 141 (`input.messages.filter((m) => m.role !== "system")`), but: (a) defense is in the wrong layer, (b) user-role messages are still sent verbatim to Ollama |
| **Impact** | Prompt injection: `"Ignore all previous instructions..."` overrides LLM behavior. In insurance domain, this could fabricate policy terms, leak retrieved context, or bypass safety instructions. |
| **Fix** | (a) Never allow user-supplied "system" role in `normalizeRequest`. (b) Sanitize user inputs before LLM. (c) Add XML delimiters around retrieved context with instructions not to treat as commands. |

### H5 — `NODE_ENV` not set — session cookies insecure

| | |
|---|---|
| **Severity** | P2 |
| **File** | `lib/auth/session.ts:75,108` + `.env` (absent) |
| **Evidence** | `secure: process.env.NODE_ENV === "production"` — without `NODE_ENV=production`, session cookies are sent over HTTP without `Secure` flag. Also affects Prisma singleton behavior and Next.js optimizations. |
| **Impact** | Session cookies transmitted in cleartext. Session hijacking via network sniffing. |
| **Fix** | Set `NODE_ENV=production` in deployment environment |

### H6 — No input validation on most POST endpoints

| | |
|---|---|
| **Severity** | P2 |
| **Files** | `app/api/leads/route.ts:44`, `app/api/messages/route.ts:50`, `app/api/reminders/route.ts:16`, `app/api/crm/route.ts:103` |
| **Evidence** | All accept `req.json()` with ad-hoc field checks. No Zod schemas (despite Zod being a dependency). CRM PATCH uses `const { leadId, ...updates } = body` then spreads arbitrary fields — though Prisma rejects unknown fields, the intent is unclear. Messages `role` field is not validated against the `MessageRole` enum. |
| **Impact** | Unbounded input lengths (DoS via storage). Potential field injection in CRM. Invalid enum values stored in messages. |
| **Fix** | Add Zod schemas for all request bodies. Validate `role` against enum before write. |

### H7 — No rate limiting on brochure upload

| | |
|---|---|
| **Severity** | P2 |
| **File** | `app/api/brochures/route.ts:28` |
| **Evidence** | POST handler uses `requireAdmin` but has no `checkRateLimit` call. `RateLimitAction` type doesn't include a `brochures:upload` action. |
| **Impact** | Admin account can flood server with 50MB brochure uploads without throttling |
| **Fix** | Add `brochures:upload` rate limit action |

### H8 — No graceful shutdown handling

| | |
|---|---|
| **Severity** | P2 |
| **File** | N/A — no shutdown handlers exist anywhere |
| **Evidence** | Zero matches for `SIGTERM`, `SIGINT`, `shutdown`, or `graceful` in application code |
| **Impact** | On container restart, in-flight requests, document processing jobs, and DB connections are terminated abruptly. Orphaned job states, data inconsistency. |
| **Fix** | Add `process.on('SIGTERM', ...)` handler that drains connections and completes in-flight work |

### H9 — No database backup strategy

| | |
|---|---|
| **Severity** | P2 |
| **File** | `backup/BACKUP_INSTRUCTIONS.md` (only covers source code) |
| **Evidence** | Backup docs only describe git branch/ZIP backup. No `pg_dump` script, no Qdrant snapshot, no cron job, no backup tooling for actual data. |
| **Impact** | Complete data loss on DB corruption or server failure. No recovery path for customer data, policy knowledge, or audit logs. |
| **Fix** | Implement automated PostgreSQL backups (pg_dump/WAL archiving), Qdrant snapshots, documented recovery procedure |

### H10 — Keycloak image 23.0 (Nov 2023) has known CVEs

| | |
|---|---|
| **Severity** | P2 |
| **File** | `docker-compose.yml:31` |
| **Evidence** | `image: quay.io/keycloak/keycloak:23.0` — released Nov 2023, multiple known CVEs in versions before 24.x |
| **Impact** | Known vulnerabilities in the auth server itself |
| **Fix** | Upgrade to latest stable (26.x+) |

---

## MEDIUM/LOW

Important for robustness but not blocking initial deployment.

### M1 — In-memory rate limiter resets on restart

| | |
|---|---|
| **Severity** | P2 |
| **File** | `lib/security/rateLimiter.ts:86` |
| **Evidence** | `const buckets = new Map<string, Bucket>();` — in-memory sliding window |
| **Impact** | Restart resets all counters. Multiple instances have independent counters. Attacker can trigger restart to bypass limits. |
| **Fix** | Document limitation. Migrate to Redis for production. |

### M2 — Brochure upload MD5 deduplication (weak hash)

| | |
|---|---|
| **Severity** | P3 |
| **File** | `lib/pdf/batchProcess.ts:42` |
| **Evidence** | `crypto.createHash("md5")` for brochure version dedup. Document uploads correctly use SHA-256. |
| **Impact** | MD5 collisions trivially producible. Attacker could craft PDF colliding with legitimate brochure hash, causing processing to be skipped. |
| **Fix** | Switch to SHA-256 |

### M3 — No chat message length limit

| | |
|---|---|
| **Severity** | P3 |
| **File** | `app/api/chat/route.ts:36-71` |
| **Evidence** | No maximum length on `body.message` or `body.messages[].content` |
| **Impact** | Multi-MB messages cause excessive Ollama token usage and slow responses. DoS vector. |
| **Fix** | Add `MAX_MESSAGE_LENGTH` check (e.g., 10,000 chars) |

### M4 — No pagination on CRM leads

| | |
|---|---|
| **Severity** | P3 |
| **File** | `app/api/crm/route.ts:34-41` |
| **Evidence** | `db.policyLead.findMany(...)` with no `take` limit — returns ALL leads for an agent |
| **Impact** | Agent with thousands of leads causes slow DB queries and large response payloads |
| **Fix** | Add pagination with reasonable default cap |

### M5 — `protectRoute` drops authenticated user

| | |
|---|---|
| **Severity** | P3 |
| **File** | `lib/auth/keycloak.ts:140-153` |
| **Evidence** | `protectRoute` validates token but discards JWT payload — handler receives only `req`, not user identity |
| **Impact** | Currently unused by API routes (they use `requireAuth/requireAgent/requireAdmin`), but dangerous exported API. Any new code using it gets authentication without authorization context. |
| **Fix** | Change signature to pass user payload to handler, or deprecate |

### M6 — `console.error` instead of Winston logger in API routes

| | |
|---|---|
| **Severity** | P3 |
| **File** | All 56+ `console.error`/`console.log` calls in `app/api/` |
| **Evidence** | Winston logger exists at `lib/logging/index.ts` but is NOT imported by any API route |
| **Impact** | Unstructured logs, no file-based persistence, stack traces in stdout |
| **Fix** | Replace `console.*` with `logger.*` in all API routes |

### M7 — `prisma` CLI in `dependencies`

| | |
|---|---|
| **Severity** | P3 |
| **File** | `package.json:38` |
| **Evidence** | `prisma` (CLI tool) is in `dependencies` — should be in `devDependencies` |
| **Impact** | Unnecessary package in production image. Minor. |
| **Fix** | Move to `devDependencies` |

### M8 — No `productionBrowserSourceMaps: false`

| | |
|---|---|
| **Severity** | P3 |
| **File** | `next.config.ts` |
| **Evidence** | Source maps not explicitly disabled |
| **Impact** | Next.js may generate source maps in production, exposing minified code structure |
| **Fix** | Add `productionBrowserSourceMaps: false` |

### M9 — Brochure listing accessible to all auth users

| | |
|---|---|
| **Severity** | P3 |
| **File** | `app/api/brochures/route.ts:5` (GET uses `requireAuth`) |
| **Evidence** | Any authenticated agent can list all brochures. DELETE correctly uses `requireAdmin`. |
| **Impact** | Low — brochure names and metadata are not highly sensitive, but information disclosure about knowledge base structure |
| **Fix** | Consider `requireAdmin` for GET if catalog is admin-only |

---

## VERIFIED CLEAN

These areas were audited and found to be properly implemented:

| Area | Status | Evidence |
|------|--------|----------|
| **SQL injection** | CLEAN | All production `$queryRaw` uses Prisma tagged templates (`Prisma.sql\`\``). Zero string concatenation in SQL. |
| **SSRF** | CLEAN | All `fetch()` targets come from env vars (`OLLAMA_HOST`, `QDRANT_URL`, `KEYCLOAK_URL`), never from user input. |
| **IDOR on documents** | CLEAN | `documents/ownership.ts` enforces full chain: auth → userInDb → application.leadId → lead.agentId === userInDb.id |
| **IDOR on applications** | CLEAN | `loadOwnedApplication` in `lib/applications/lifecycle.ts:72-109` with `ApplicationOwnershipError` |
| **Document upload security** | CLEAN | Magic-byte MIME detection, polyglot rejection, SHA-256 content addressing, path traversal guards (`assertSafeKey` + `abs.startsWith(root)`) |
| **JWT verification** | CLEAN | `jose` library with RS256 + issuer + audience validation |
| **Session HMAC** | CLEAN | Uses `timingSafeEqual` — no timing attacks on session cookies |
| **Rate limiting (writes)** | CLEAN | 21 action types with per-user sliding windows on all mutation endpoints |
| **Audit logging** | CLEAN | Append-only with PII masking (`lib/documents/pii.ts`) applied before persistence |
| **Application approval** | CLEAN | `FOR UPDATE` row locking with re-evaluation in transaction to prevent race conditions |
| **Job claiming** | CLEAN | `FOR UPDATE SKIP LOCKED` pattern for concurrent workers |
| **`.env` gitignored** | CLEAN | Verified: `.env`, `.env.local`, `config/.env` all excluded from git tracking |
| **Git history (main)** | CLEAN | Phase 2Q rewrite complete. All 6 credential strings absent from current tree snapshots. |

---

## RECOMMENDED EXECUTION ORDER

### Phase 2S — Critical Production Blockers (B1-B7)

| Order | Issue | Effort |
|-------|-------|--------|
| 1 | B1: Move `@prisma/adapter-pg` to dependencies | 5 min |
| 2 | B2: Add `SESSION_SECRET` to `.env` | 5 min |
| 3 | B7: Fix `.env.example` SESSION_SECRET placeholder | 2 min |
| 4 | B4: Add security headers to `next.config.ts` | 15 min |
| 5 | B5: Remove user-controlled `folderPath` from batch route | 10 min |
| 6 | B6: Add magic-byte MIME check to brochure upload | 15 min |
| 7 | B3: Document Keycloak `start` mode requirement (full TLS setup is larger scope) | 15 min |

### Phase 2T — High Priority (H1-H10)

| Order | Issue | Effort |
|-------|-------|--------|
| 1 | H1: Replace error.message leaks with generic responses (8+ routes) | 30 min |
| 2 | H2: Remove `filePath` from brochure GET response | 5 min |
| 3 | H3: Create `/api/health` endpoint | 15 min |
| 4 | H5: Set `NODE_ENV=production` in deployment | 2 min |
| 5 | H6: Add Zod validation to POST endpoints | 1 hr |
| 6 | H7: Add brochure upload rate limit | 10 min |
| 7 | H4: Harden LLM prompt injection defenses | 2 hr |
| 8 | H10: Upgrade Keycloak image | 30 min |
| 9 | H8: Add graceful shutdown handler | 30 min |
| 10 | H9: Implement DB backup strategy | 2 hr |

### Phase 2U — Medium/Low (M1-M9)

| Order | Issue | Effort |
|-------|-------|--------|
| 1 | M1: Document rate limiter limitations | 5 min |
| 2 | M2: Switch brochure dedup to SHA-256 | 10 min |
| 3 | M3: Add chat message length limit | 5 min |
| 4 | M4: Add CRM pagination | 15 min |
| 5 | M5: Fix or deprecate `protectRoute` | 10 min |
| 6 | M6: Replace console.* with Winston | 1 hr |
| 7 | M7-M9: Package/config cleanup | 15 min |

---

## SEVERITY SUMMARY

| Severity | Count | Blocking? |
|----------|:-----:|-----------|
| P0 (Critical) | 1 | Yes — app crash on boot |
| P1 (High) | 6 | Yes — security/functional |
| P2 (Medium) | 10 | No — fix soon after launch |
| P3 (Low) | 9 | No — track and fix |
| **Total** | **26** | **7 must-fix before prod** |

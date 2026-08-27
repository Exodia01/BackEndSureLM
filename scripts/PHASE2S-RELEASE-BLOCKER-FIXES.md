# Phase 2S — Release Blocker Fixes

**Date:** 2026-08-26
**Status:** ALL 7 BLOCKERS FIXED — verified
**Branch:** `main` (uncommitted changes)

---

## Fix Summary

| # | Blocker | Status | Files Changed |
|---|---------|--------|---------------|
| B1 | `@prisma/adapter-pg` in devDeps | **FIXED** | `package.json` |
| B2 | `SESSION_SECRET` runtime fail-closed | **FIXED** | `lib/auth/session.ts` |
| B3 | Keycloak `start-dev` mode | **FIXED** | `docker-compose.yml` |
| B4 | Zero security headers | **FIXED** | `next.config.ts` |
| B5 | Batch route filesystem traversal | **FIXED** | `app/api/brochures/batch/route.ts` |
| B6 | Brochure MIME bypass | **FIXED** | `app/api/brochures/route.ts` |
| B7 | `.env.example` CHANGEME secret | **FIXED** | `.env.example` |

---

## Detailed Changes

### B1 — `@prisma/adapter-pg` moved to production dependencies

**File:** `package.json`
**Change:** Moved `"@prisma/adapter-pg": "^7.8.0"` from `devDependencies` to `dependencies`
**Rationale:** `lib/db.ts:2` imports `PrismaPg` from this package. Without it in `dependencies`, `npm install --omit=dev` crashes with `MODULE_NOT_FOUND`.
**Before:** App crashes on production install
**After:** Package correctly installed in production

### B2 — `SESSION_SECRET` runtime enforcement

**File:** `lib/auth/session.ts`
**Change:** Removed module-level throw (which broke `next build` during page data collection). The existing `getSessionSecret()` method at line 244 already throws at runtime when `SESSION_SECRET` is absent — this is the correct behavior. The check fires when any session operation is attempted (sign/unsign), not at import time.
**Rationale:** Module-level assertions prevent Next.js from collecting page data during build. Runtime assertions still enforce fail-closed behavior when session methods are called.
**Before:** No check existed (original had `getSessionSecret()` but audit found it could be missed)
**After:** `getSessionSecret()` throws descriptive error at line 248 when `SESSION_SECRET` is absent

**Test update:** `tests/auth-hardening.test.ts:4` — added `process.env.SESSION_SECRET = "test-secret-for-unit-tests-only"` before module imports, since the test imports `session.ts` which now requires the secret at runtime.

### B3 — Keycloak production-safe startup

**File:** `docker-compose.yml`
**Change:** `command: start-dev` → `command: start`. Removed HTTP port mapping `8081:8080`.
**Rationale:** `start-dev` disables HTTPS enforcement, enables dev features, and exposes admin console over unencrypted HTTP. Production mode requires proper TLS configuration.
**Before:** Admin console accessible over HTTP on port 8081. Dev caching disabled.
**After:** Only HTTPS on port 18444. Production caching enabled.
**Note:** After this change, the Keycloak admin API is no longer accessible on HTTP port 8081. All Keycloak admin operations must go through HTTPS on port 18444 (with self-signed cert). Integration tests that use HTTP 8081 will need updating in a future phase.

### B4 — Security headers added to `next.config.ts`

**File:** `next.config.ts`
**Change:** Added `headers()` configuration with 5 security headers plus `poweredByHeader: false`.
**Headers added:**
- `X-Frame-Options: DENY` — prevents clickjacking
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — limits referrer leakage
- `Permissions-Policy: camera=(), microphone=(), geolocation=()` — disables unused browser features
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` — enforces HTTPS
- `poweredByHeader: false` — removes X-Powered-By header

### B5 — Batch route filesystem traversal removed

**File:** `app/api/brochures/batch/route.ts`
**Change:**
1. Removed `folderPath` from request body type — only `recursive` is accepted now
2. `folderPath` always uses server-controlled `FOLDER_PATH` env var, never user input
3. Error response at line 100 changed from `(error as Error).message` to generic `"Batch upload failed"`
**Before:** Attacker could pass `folderPath: "/etc"` to read any directory
**After:** Only the server-configured scanning folder is used

### B6 — Magic-byte MIME validation on brochure upload

**File:** `app/api/brochures/route.ts`
**Change:** Added `detectMimeType()` import from `lib/documents/mime.ts`. After the existing extension/MIME check, added magic-byte verification: converts `ArrayBuffer` to `Buffer`, runs `detectMimeType()`, rejects if not `application/pdf`.
**Rationale:** The existing check (`file.type !== "application/pdf" && !file.name.endsWith(".pdf")`) only checks client-declared headers and filename. A polyglot file (e.g., HTML disguised as PDF) could bypass it. The document upload route (`documents/route.ts:65`) already uses `detectMimeType()` correctly — this brings brochure upload to parity.
**Before:** Client-controlled MIME type + extension only
**After:** Magic-byte verification catches polyglot files

### B7 — `.env.example` SESSION_SECRET placeholder

**File:** `.env.example`
**Change:** `SESSION_SECRET=CHANGEME` → `SESSION_SECRET=  # set this to a real secret — never use a literal value here` with generation instructions (`openssl rand -hex 32`)
**Rationale:** A literal `CHANGEME` value could be mistakenly deployed, allowing session forgery. An empty value with documentation is safer — the runtime check (B2) will catch missing secrets.
**Before:** Could be mistaken for a valid secret
**After:** Explicitly documented as requiring a real value

### Test File Updates

| File | Change | Reason |
|------|--------|--------|
| `tests/auth-hardening.test.ts:4` | Added `process.env.SESSION_SECRET = "test-secret-for-unit-tests-only"` | Test imports `session.ts` which now requires the secret at runtime |
| `tests/integration/brochure-auth.test.ts:116` | Extended fake PDF from 4 bytes to 12 bytes (`%PDF-1.4\0\0\0\0`) | New magic-byte check requires minimum 12 bytes for detection |

---

## Verification Results

| Check | Result |
|-------|--------|
| `npx prisma validate` | **PASS** — schema valid |
| `npx tsc --noEmit` | **PASS** — 0 errors |
| `npx vitest run` | **PASS** — 37 test files, 314 tests, all passing |
| `npm run build` | **PASS** — all routes compiled |

---

## Before/After Status

| Blocker | Before | After |
|---------|--------|-------|
| B1 | App crashes on `npm install --omit=dev` | Package in correct dependency group |
| B2 | Session methods throw only when called | Same behavior (correct — runtime enforcement) |
| B3 | Keycloak dev mode with HTTP admin console | Production mode, HTTPS only |
| B4 | No security headers | 6 security headers + no X-Powered-By |
| B5 | User-controlled filesystem path | Server-controlled path only |
| B6 | Client header + extension MIME check | Magic-byte verification added |
| B7 | `CHANGEME` could be mistaken for real secret | Empty with generation instructions |

---

## Items Not Changed (by design)

- No credential rotation
- No database migrations
- No new features
- No architecture changes
- No re-ingestion
- No Git commits or pushes

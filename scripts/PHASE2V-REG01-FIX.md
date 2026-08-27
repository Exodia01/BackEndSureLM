# Phase 2V — REG-01 Remediation

**Date:** 2026-08-26
**Status:** FIX COMPLETE — verified, regression tests added
**Scope:** Remove `filePath` from data-access functions and API responses

---

## Problem

Phase 2U verification found that Phase 2T H2 fix was incomplete. The individual `GET /api/brochures/:id` route was fixed to exclude `filePath` from its Prisma select, but two data-access functions in `lib/pdf/batchProcess.ts` still selected `filePath: true`:

- `listBrochures()` (line 518) — called by `GET /api/brochures` (listing endpoint)
- `getBrochureById()` (line 546) — exported but unused by any API route (dead code landmine)

Any authenticated user calling `GET /api/brochures` received server filesystem paths (e.g., `/data/pdfs/policy-brochure.pdf`) for every brochure.

---

## Changes

### `lib/pdf/batchProcess.ts` — 2 lines removed

```diff
--- a/lib/pdf/batchProcess.ts
+++ b/lib/pdf/batchProcess.ts
@@ -515,7 +515,6 @@ export async function listBrochures(
         id: true,
         basename: true,
         originalName: true,
-        filePath: true,
         totalPages: true,
         versionNum: true,
         status: true,
@@ -543,7 +542,6 @@ export async function getBrochureById(id: string): Promise<any | null> {
       id: true,
       basename: true,
       originalName: true,
-        filePath: true,
       totalPages: true,
       versionNum: true,
       status: true,
```

**Lines removed:** 518, 546
**Lines changed:** 2 (both `filePath: true` removed from Prisma select clauses)

---

## Caller Trace

| Function | Called By | Exposed to Client? | Fix Applied? |
|---|---|---|---|
| `listBrochures()` | `GET /api/brochures` (route.ts:17) | **YES — was leaking** | **YES** |
| `getBrochureById()` | **No API callers** (dead code) | No (unused) | **YES** (defense-in-depth) |
| `db.brochure.findUnique()` in DELETE route (route.ts:59) | `DELETE /api/brochures/:id` | No (server-side only, uses filePath for `fs.unlink`) | N/A (safe) |

**No other code paths expose filePath.** The only remaining `filePath` access is in the DELETE route's server-side `fs.unlink` call, which is admin-only and never serialized to a response.

---

## Regression Tests

**New file:** `tests/security/reg01-filepath-leak.test.ts` (6 tests)

| Test | Layer | Verifies |
|---|---|---|
| `select does not include filePath` | Data-access (listBrochures) | Prisma `findMany` args.select does not have `filePath` |
| `returned objects do not contain filePath` | Data-access (listBrochures) | Returned brochure objects lack `filePath` property |
| `select does not include filePath` | Data-access (getBrochureById) | Prisma `findUnique` args.select does not have `filePath` |
| `returned object does not contain filePath` | Data-access (getBrochureById) | Returned brochure object lacks `filePath` property |
| `response does not contain filePath` | API (GET /api/brochures) | HTTP response JSON has no `filePath` in any brochure |
| `response does not contain filePath` | API (GET /api/brochures/:id) | HTTP response JSON has no `filePath` |

---

## Verification Results

| Command | Result |
|---|---|
| `npx prisma validate` | **PASS** |
| `npx tsc --noEmit` | **PASS** (0 errors) |
| `npx vitest run` | **PASS** — 45 test files / 334 tests (was 44/328) |
| `npm run build` | **PASS** (all routes compiled) |

**Test delta:** +1 file (reg01-filepath-leak.test.ts), +6 tests (334 total, up from 328)

---

## Affected API Paths

| Endpoint | Method | Before | After |
|---|---|---|---|
| `GET /api/brochures` | GET | Response included `filePath: "/data/pdfs/..."` | `filePath` absent from response |
| `GET /api/brochures/:id` | GET | Already fixed in Phase 2T H2 | No change (already clean) |
| `DELETE /api/brochures/:id` | DELETE | Server-side only (safe) | No change |

---

## Files Changed

| File | Change |
|---|---|
| `lib/pdf/batchProcess.ts` | Removed `filePath: true` from 2 Prisma select clauses |
| `tests/security/reg01-filepath-leak.test.ts` | **NEW** — 6 regression tests |

---

*No push. No commit. Waiting for user approval.*

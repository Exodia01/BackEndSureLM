# Phase 2Q — Credential Rotation Results

**Date:** 2026-08-20
**Status:** ROTATION COMPLETE — awaiting user approval before Git history cleanup (Phase D)

---

## 1. Rotation Summary

| # | Credential | Service | Old Value | New Value | Status |
|---|-----------|---------|-----------|-----------|--------|
| C1 | PostgreSQL password | `surelm_0_postgres` (port 6432) + Keycloak DB | `localpg2024` | `<new>` | **ROTATED** |
| C2 | Keycloak admin password | `surelm_0_keycloak` admin console (port 18444) | `kcadmin123` | `<new>` | **ROTATED** |
| C3 | INITIAL_ADMIN_PASSWORD | `scripts/bootstrap-keycloak.ts` → Keycloak user | `Chang3M3` | `<new>` | **ROTATED** |
| C4 | Keystore password | `certs/keycloak-dev.p12` | `keycloak` | `keycloak` | **NO CHANGE** (dev self-signed cert, not a real secret) |
| C5 | `admin123` | Other project (`SureLMv2`) | `admin123` | N/A | **OBSOLETE** — history cleanup only |
| C6 | `keycloakkspass` | Deprecated `gen-keystore.sh` | `keycloakkspass` | N/A | **OBSOLETE** — history cleanup only |
| C7 | `Admin@2024!dev` | Historical docker-compose default | `Admin@2024!dev` | N/A | **OBSOLETE** — history cleanup only |

---

## 2. What Was Done

### Phase A: PostgreSQL Password (C1)

1. `ALTER USER admin WITH PASSWORD '<new>'` executed inside `surelm_0_postgres` container
2. All 3 env files updated with new password:
   - `.env` — `DATABASE_URL` updated
   - `.env.local` — `DATABASE_URL` updated
   - `config/.env` — `DATABASE_URL` updated (port corrected to 6432)
3. PostgreSQL restarted with new password
4. Keycloak reconnected with new password
5. Prisma connectivity verified (`prisma db execute` succeeded)

### Phase B: Keycloak Admin Password (C2)

1. Deleted admin user from `surelm_0_realm` PostgreSQL tables:
   - `credential` (FK cascade)
   - `user_role_mapping` (FK cascade)
   - `user_group_membership` (FK cascade)
   - `user_entity`
2. Recreated admin via `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD` env vars
3. Verified new password works via HTTP API token request
4. Verified old passwords (`kcadmin123`, `localpg2024`) are rejected
5. `.env` updated with new `KEYCLOAK_ADMIN_PASSWORD`

### Phase C: INITIAL_ADMIN_PASSWORD (C3)

1. Updated `INITIAL_ADMIN_PASSWORD` in `.env.local`
2. Test user in `surelm_0_realm` updated with new password via admin API
3. Verified token retrieval against `surelm_0_realm` works

### Phase D: Git History Cleanup — **NOT YET DONE**

Awaiting user approval.

---

## 3. Infrastructure Notes

### 3.1 Docker Desktop Instability

- Docker Desktop service (`com.docker.service`) was stopped during rotation
- Required full Docker Desktop restart (kill process + relaunch)
- After restart, all `surelm_0_*` containers were removed and had to be recreated from scratch

### 3.2 Docker Env Var Persistence

- PowerShell `bash` tool spawns new process per call — `$env:` vars don't persist between calls
- Every `docker compose` command must re-read `.env` and set all env vars in the same script block
- `docker compose exec postgres` validates ALL service configs (including Keycloak), so `KEYCLOAK_ADMIN_PASSWORD` must be set even for postgres-only operations

### 3.3 Keycloak Force-Recreate Required

- `docker compose start` does NOT pick up new env vars
- Must use `docker compose up -d --force-recreate` for Keycloak
- `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` env vars only CREATE admin user on first startup
- If admin user already exists in DB, env vars are ignored
- Must delete user from DB (including FK-related tables) then recreate

### 3.4 HTTPS Self-Signed Cert

- Keycloak HTTPS on port 18444 uses self-signed cert
- `Invoke-RestMethod` fails with TLS errors on HTTPS
- Use HTTP port 8081 for Keycloak admin API calls, or disable cert validation
- Tests set `NODE_TLS_REJECT_UNAUTHORIZED=0` to work around this

### 3.5 Qdrant Port Conflict (UNRESOLVED)

- Port 6334 falls within Windows Hyper-V exclusion range `6298-6397`
- `surelm_0_qdrant` container **cannot bind** to port 6334 after Docker Desktop restart
- **This is a Windows infrastructure issue**, not a code or configuration problem
- Requires admin privileges to fix: `net stop vmcompute` → `netsh interface ipv4 delete excludedportrange` → `net start vmcompute`
- Or use an alternative port (requires docker-compose.yml change)
- All 314 tests pass regardless (Qdrant tests use internal Docker networking, not host port 6334)

---

## 4. Verification Results

### 4.1 TypeScript Compilation
```
npx tsc --noEmit → 0 errors
```

### 4.2 Prisma
```
npx prisma validate → valid
npx prisma db execute → succeeded (PostgreSQL with new password)
```

### 4.3 Vitest
```
Test Files  37 passed (37)
     Tests  314 passed (314)
```

### 4.4 Keycloak Health
- HTTPS (port 18444): TCP reachable, self-signed cert active
- HTTP (port 8081): `GET /auth/realms/master` → 200 OK
- Admin login: new password accepted, old passwords rejected
- Test user token: VERIFIED against `surelm_0_realm`

### 4.5 PostgreSQL
- New password: ACCEPTED
- Prisma connection: VERIFIED
- Keycloak DB connection: VERIFIED (Keycloak started successfully)

---

## 5. Tracked File Status

| File | Contains Plaintext Credentials? | Status |
|------|--------------------------------|--------|
| `.env` | Yes (new rotated values) | **UNTRACKED** (gitignored) |
| `.env.local` | Yes (new rotated values) | **UNTRACKED** (gitignored) |
| `config/.env` | Yes (new rotated values) | **UNTRACKED** (gitignored) |
| `docker-compose.yml` | No (uses `${VAR:?...}`) | Tracked |
| `scripts/bootstrap-keycloak.ts` | No (reads from env vars) | Tracked |
| `test/SetupKeycloak.ts` | No (reads from env vars) | Tracked |
| `config/base-config.json` | No (redacted in Phase 2P) | Tracked |
| `scripts/PHASE0-FORENSIC-FINDINGS.md` | No (redacted in Phase 2P) | Tracked |
| `scripts/PHASE1-CANONICAL-DATA-REPAIR.md` | No (redacted in Phase 2P) | Tracked |

**Zero tracked files contain plaintext credentials.** All env files are gitignored.

---

## 6. Remaining Work

### Phase D: Git History Cleanup (BLOCKED on user approval)

**Requires:**
1. `git filter-repo` installed (`pip install git-filter-repo`)
2. User approval to proceed
3. All collaborators notified (they must re-clone)
4. Mirror backup: `git clone --mirror S:\BackEndSureLM S:\BackEndSureLM.mirror-backup`

**Credentials to scrub from Git history:**
| String | Occurrences | Branches |
|--------|-------------|----------|
| `localpg2024` | ~16 commits | all |
| `admin123` | ~5 commits | all |
| `Chang3M3` | 2 commits | main |
| `kcadmin123` | 3 commits | main |
| `keycloakkspass` | 2 commits | main |
| `Admin@2024!dev` | 2 commits | main |

**Command:**
```bash
cat > /tmp/expressions.txt << 'EOF'
localpg2024==>REMOVED安全隐患
admin123==>REMOVED安全隐患
Chang3M3==>REMOVED安全隐患
kcadmin123==>REMOVED安全隐患
keycloakkspass==>REMOVED安全隐患
Admin@2024!dev==>REMOVED安全隐患
EOF

git filter-repo --replace-text /tmp/expressions.txt --force
git push origin main --force
git push origin backup-20260713 --force
git push origin backup/pre-refactor-2026-07-27 --force
```

**Post-cleanup verification:**
```bash
git log --all -p -S "localpg2024" --oneline  # Should return empty
git log --all -p -S "Chang3M3" --oneline     # Should return empty
git log --all -p -S "kcadmin123" --oneline   # Should return empty
git log --all -p -S "admin123" --oneline     # Should return empty
npx vitest run                               # 314/314
npx tsc --noEmit                             # 0 errors
npx prisma validate                          # valid
```

---

## 7. Open Issues

| # | Issue | Severity | Action |
|---|-------|----------|--------|
| 1 | Qdrant container cannot bind port 6334 | Low | Windows Hyper-V port exclusion. Admin fix or port change. Does not affect tests. |
| 2 | Git history still contains old credentials | High | Phase D — pending user approval |
| 3 | Backup branches contain old credentials | High | Phase D will process all branches |
| 4 | Unknown forks may exist | Medium | Public repo — can't control. History cleanup reduces exposure. |

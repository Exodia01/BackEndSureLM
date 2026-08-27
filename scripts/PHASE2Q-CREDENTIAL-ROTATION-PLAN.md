# Phase 2Q — Credential Rotation Plan

**Date:** 2026-08-20
**Status:** READ-ONLY — no changes made. For approval before execution.
**Prerequisite:** Phase 2P committed (`913d29a`). Phase 2O committed (`23dcab7`).

---

## 1. Credential Inventory

### ACTIVE Credentials Requiring Rotation

| # | Credential | Type | Service | Tracked Tree | Git History |
|---|-----------|------|---------|-------------|-------------|
| C1 | `localpg2024` | PostgreSQL password | `surelm_0_postgres` (port 6432) + Keycloak DB | ZERO | 16+ commits, all branches |
| C2 | `kcadmin123` | Keycloak admin password | `surelm_0_keycloak` admin console (port 18444) | ZERO | 3 commits |
| C3 | `Chang3M3` | Keycloak bootstrap/initial user password | `scripts/bootstrap-keycloak.ts` → creates initial admin user in Keycloak | ZERO | 2 commits |

### ACTIVE Credential — No Rotation Needed

| # | Credential | Type | Service | Reason |
|---|-----------|------|---------|--------|
| C4 | `keycloak` (default) | Keycloak keystore password | `certs/keycloak-dev.p12` | Used by docker-compose.yml default (`${KC_HTTPS_KEY_STORE_PASSWORD:-keycloak}`). Not exposed in Git history as a secret. See §3.4 for details. |

### OBSOLETE Credentials — History Cleanup Only

| # | Credential | Type | Status | Action |
|---|-----------|------|--------|--------|
| C5 | `admin123` | PostgreSQL password (different project: `S:\SureLMv2\AiForBharat2SureLM`) | OBSOLETE for this repo | Rotate on other project if still active. History cleanup in this repo. |
| C6 | `keycloakkspass` | Keystore password (deprecated `gen-keystore.sh`, `Dockerfile.genkeystore`) | OBSOLETE — superseded by C4 default | History cleanup only. |
| C7 | `Admin@2024!dev` | Alternate Keycloak initial password (historical docker-compose default) | OBSOLETE — removed Phase 2O | History cleanup only. |

---

## 2. Service Mapping

### 2.1 Primary Stack (`docker-compose.yml`)

```
┌─────────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  surelm_0_postgres (port 6432)                                   │
│  ├─ POSTGRES_DB: surelm_0                                        │
│  ├─ POSTGRES_USER: ${POSTGRES_USER:-surelm_dev_user}            │
│  ├─ POSTGRES_PASSWORD: ${POSTGRES_PASSWORD} ←── C1 (localpg2024)│
│  └─ Healthcheck: pg_isready -U ${POSTGRES_USER} -d surelm_0     │
│                                                                  │
│  surelm_0_qdrant (port 6334)                                     │
│  └─ No credentials (HTTP only, localhost)                        │
│                                                                  │
│  surelm_0_keycloak (port 18444)                                  │
│  ├─ KEYCLOAK_ADMIN: ${KEYCLOAK_ADMIN:-admin}                    │
│  ├─ KEYCLOAK_ADMIN_PASSWORD: ${KEYCLOAK_ADMIN_PASSWORD} ←── C2 │
│  ├─ KC_DB: postgres                                              │
│  ├─ KC_DB_URL: jdbc:postgresql://postgres:5432/surelm_0         │
│  ├─ KC_DB_USERNAME: ${POSTGRES_USER:-surelm_dev_user}           │
│  ├─ KC_DB_PASSWORD: ${POSTGRES_PASSWORD} ←── C1 (shared)        │
│  ├─ KC_HTTPS_KEY_STORE_FILE: /opt/keycloak/conf/keycloak-dev.p12│
│  ├─ KC_HTTPS_KEY_STORE_PASSWORD: ${KC_HTTPS_KEY_STORE_PASSWORD:-keycloak} │
│  ├─ Volumes: ./certs:/opt/keycloak/conf:ro                      │
│  └─ Depends on: postgres (healthy)                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Application (`.env` / `.env.local`)

```
┌─────────────────────────────────────────────────────────────────┐
│  .env                                                            │
│  ├─ DATABASE_URL: postgresql://admin:***@localhost:6432/surelm_0 │
│  │   (contains C1: localpg2024)                                  │
│  ├─ TEST_USERNAME: ***                                           │
│  └─ TEST_PASSWORD: ***                                           │
│                                                                  │
│  .env.local                                                      │
│  ├─ DATABASE_URL: postgresql://admin:***@localhost:6432/surelm_0 │
│  │   (contains C1: localpg2024)                                  │
│  ├─ INITIAL_ADMIN_PASSWORD: ***                                  │
│  │   (contains C3: Chang3M3)                                     │
│  └─ INITIAL_ADMIN_USERNAME: admin-user                           │
│                                                                  │
│  config/.env                                                     │
│  └─ DATABASE_URL: postgresql://admin:***@localhost:6432/surelm_0 │
│      (contains C1: localpg2024)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Bootstrap Script (`scripts/bootstrap-keycloak.ts`)

```
Required env vars (read at runtime, no hardcoded defaults):
  KEYCLOAK_URL         → Keycloak base URL
  KEYCLOAK_ADMIN_USER  → admin username (default: "admin")
  KEYCLOAK_ADMIN_PWD   → admin password ←── C2 (kcadmin123)
  KEYCLOAK_REALM       → realm name (default: "surelm_0_realm")
  INITIAL_ADMIN_USERNAME → initial user username
  INITIAL_ADMIN_EMAIL    → initial user email
  INITIAL_ADMIN_PASSWORD → initial user password ←── C3 (Chang3M3)
```

---

## 3. Rotation Procedures

### 3.1 C1: PostgreSQL Password (`localpg2024` → new value)

**Impact:** PostgreSQL restart required. Keycloak will lose DB connection temporarily. Application will fail to connect during rotation.

**Procedure:**

1. **Stop Keycloak first** (to prevent connection errors):
   ```bash
   docker compose stop keycloak
   ```

2. **Change PostgreSQL password inside the running container:**
   ```bash
   docker compose exec postgres psql -U surelm_dev_user -d surelm_0 -c "ALTER USER surelm_dev_user WITH PASSWORD 'NEW_PASSWORD';"
   ```
   Note: The `POSTGRES_USER` default is `surelm_dev_user`, but the actual value depends on what was set in `.env` at first run. The password change is independent of the username.

3. **Update `.env`** — set `POSTGRES_PASSWORD=new_value` and update `DATABASE_URL` to use the new password.

4. **Update `.env.local`** — update `DATABASE_URL` to use the new password.

5. **Update `config/.env`** — update `DATABASE_URL` to use the new password.

6. **Restart PostgreSQL:**
   ```bash
   docker compose restart postgres
   ```

7. **Restart Keycloak** (it will reconnect with new password via `KC_DB_PASSWORD` env var):
   ```bash
   docker compose start keycloak
   ```

**Downtime:** ~10 seconds (PostgreSQL restart). Keycloak and app unavailable during step 6-7.

**Rollback:** Revert `.env`/`.env.local`/`config/.env` to old password, restart postgres, restart keycloak.

### 3.2 C2: Keycloak Admin Password (`kcadmin123` → new value)

**Impact:** No service restart required. Admin console password change only.

**Procedure:**

1. **Update Keycloak admin password via admin API** (while Keycloak is running):
   ```bash
   # Get admin token
   TOKEN=$(curl -s -X POST "http://localhost:18444/auth/realms/master/protocol/openid-connect/token" \
     -d "client_id=admin-cli" -d "username=admin" -d "password=OLD_PASSWORD" \
     -d "grant_type=password" | jq -r '.access_token')

   # Update admin user password
   ADMIN_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
     "http://localhost:18444/auth/admin/realms/master/users?username=admin" | jq -r '.[0].id')

   curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "http://localhost:18444/auth/admin/realms/master/users/$ADMIN_ID" \
     -d '{"credentials":[{"type":"password","value":"NEW_PASSWORD","temporary":false}]}'
   ```

2. **Update `.env`** — set `KEYCLOAK_ADMIN_PASSWORD=new_value` (Note: currently not in `.env`; the docker-compose default is used).

3. **Update `docker-compose.yml`** — if the env var is not in `.env`, the default `admin` user and password are baked into the compose file via `${KEYCLOAK_ADMIN_PASSWORD:?...}`. The password must be set as an environment variable or in `.env`.

4. **Update bootstrap script env** — `KEYCLOAK_ADMIN_PWD` must match the new password.

5. **Update test config** — `TEST_USERNAME` and `TEST_PASSWORD` in `.env` must match the new credentials.

**Downtime:** None. Admin console access changes immediately.

**Rollback:** Revert `.env`, re-run step 1 with old password.

### 3.3 C3: Keycloak Bootstrap/Initial User Password (`Chang3M3` → new value)

**Impact:** Only affects new installations. Existing initial admin user password is stored in Keycloak's database, not in a file.

**Procedure:**

1. **Update `.env.local`** — change `INITIAL_ADMIN_PASSWORD=new_value`.

2. **Update `.env.example`** — change `INITIAL_ADMIN_PASSWORD=CHANGEME` (already a placeholder, no action needed).

3. **If the initial admin user already exists in Keycloak** and you want to change their password, use the admin API:
   ```bash
   # Get initial admin user ID
   USER_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
     "http://localhost:18444/auth/admin/realms/surelm_0_realm/users?username=admin-user" | jq -r '.[0].id')

   # Update password
   curl -s -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     "http://localhost:18444/auth/admin/realms/surelm_0_realm/users/$USER_ID" \
     -d '{"credentials":[{"type":"password","value":"NEW_PASSWORD","temporary":false}]}'
   ```

4. **Update test config** — if `TEST_USERNAME`/`TEST_PASSWORD` in `.env` reference this user.

**Downtime:** None.

**Rollback:** Revert `.env.local`.

### 3.4 C4: Keycloak Keystore (`keycloak` default — NO rotation needed)

**Current state:**
- `certs/keycloak-dev.p12` (2748 bytes, created 2026-08-07)
- `docker-compose.yml`: `KC_HTTPS_KEY_STORE_PASSWORD: ${KC_HTTPS_KEY_STORE_PASSWORD:-keycloak}`
- No `KC_HTTPS_KEY_STORE_PASSWORD` is set in any `.env` file → the default `keycloak` is used
- The deprecated `gen-keystore.sh` and `Dockerfile.genkeystore` use `keycloakkspass` (C6) but are NOT used by the primary compose
- The keystore is a self-signed dev cert (CN=localhost, 10-year validity)

**Conclusion:** The keystore password `keycloak` is not a high-value secret. It protects a self-signed dev certificate that only works on localhost. No rotation is required for development. For production, a proper TLS certificate should be used instead.

**If rotation is desired:**
```bash
# Regenerate keystore with new password
openssl req -x509 -newkey rsa:2048 -keyout keycloak.key -out keycloak.crt -days 3650 -nodes -subj "/CN=localhost/OU=SureLM/O=SureLM/C=US"
openssl pkcs12 -export -inkey keycloak.key -in keycloak.crt -out certs/keycloak-dev.p12 -name keycloak -password pass:NEW_PASSWORD
# Update docker-compose.yml or set KC_HTTPS_KEY_STORE_PASSWORD in .env
```

---

## 4. Rotation Order

```
Phase A: PostgreSQL password (C1)
  └─ Step 1: Stop Keycloak
  └─ Step 2: ALTER USER password in PostgreSQL
  └─ Step 3: Update .env, .env.local, config/.env
  └─ Step 4: Restart PostgreSQL
  └─ Step 5: Start Keycloak (reconnects with new password)

Phase B: Keycloak admin password (C2)
  └─ Step 6: Update via admin API
  └─ Step 7: Update .env KEYCLOAK_ADMIN_PASSWORD
  └─ Step 8: Update bootstrap script env

Phase C: Initial admin user password (C3)
  └─ Step 9: Update .env.local INITIAL_ADMIN_PASSWORD
  └─ Step 10: Update existing user via admin API (if needed)
  └─ Step 11: Update TEST_USERNAME/TEST_PASSWORD in .env

Phase D: Git history cleanup (after all rotations)
  └─ Step 12: git filter-repo --replace-text
  └─ Step 13: Force push all branches
  └─ Step 14: Notify collaborators
```

**Rationale for order:**
- C1 (PostgreSQL) must come first because Keycloak depends on it
- C2 (admin) must come before C3 (initial user) because C2 is needed to update C3
- C3 depends on C2 being current
- Phase D (history cleanup) must be LAST — only after all credentials are rotated

---

## 5. Prerequisites

### Before Rotation
- [ ] Docker Desktop is running and responsive
- [ ] PostgreSQL container is healthy (`docker compose ps`)
- [ ] Keycloak container is running and admin API is accessible
- [ ] `.env`, `.env.local`, `config/.env` are all present and readable
- [ ] Backup of `.env`, `.env.local`, `config/.env` created
- [ ] New passwords generated (minimum 16 chars, mixed case, numbers, symbols)
- [ ] New passwords stored in a secure password manager (NOT in any file yet)

### Before Git History Cleanup
- [ ] All credential rotations (Phase A-C) are complete
- [ ] All new credentials are working in the running system
- [ ] Full backup: `git clone --mirror S:\BackEndSureLM S:\BackEndSureLM.mirror-backup`
- [ ] All collaborators notified (Harsh Srivastava, Saksham, any forks)
- [ ] `git filter-repo` is installed (`pip install git-filter-repo`)
- [ ] Replacement expressions file prepared with redacted markers

---

## 6. Post-Rotation Verification

### After Phase A (PostgreSQL)
```bash
# Verify PostgreSQL is accessible with new password
docker compose exec postgres psql -U surelm_dev_user -d surelm_0 -c "SELECT 1;"

# Verify Keycloak can connect
docker compose logs keycloak --tail=20 | grep -i "connected\|database"

# Verify application can connect
npx prisma db execute --stdin <<< "SELECT 1;" --schema prisma/schema.prisma
```

### After Phase B (Keycloak Admin)
```bash
# Verify admin login works
curl -s -X POST "http://localhost:18444/auth/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "username=admin" -d "password=NEW_PASSWORD" \
  -d "grant_type=password" | jq '.access_token' | head -c 20
```

### After Phase C (Initial User)
```bash
# Verify initial user can authenticate
npx tsx scripts/bootstrap-keycloak.ts  # Should succeed or report "user already exists"
```

### After Phase D (History Cleanup)
```bash
# Verify no credentials in history
git log --all -p -S "localpg2024" --oneline  # Should return empty
git log --all -p -S "Chang3M3" --oneline     # Should return empty
git log --all -p -S "kcadmin123" --oneline   # Should return empty
git log --all -p -S "admin123" --oneline     # Should return empty

# Verify application still works
npx prisma validate
npx vitest run
npx tsc --noEmit
npm run build
```

---

## 7. Rollback Procedures

### PostgreSQL Password Rollback
1. Revert `.env`, `.env.local`, `config/.env` to old `DATABASE_URL`
2. `docker compose restart postgres`
3. `docker compose restart keycloak`
4. Verify: `docker compose logs postgres --tail=5`

### Keycloak Admin Password Rollback
1. If old password still works, use admin API to revert
2. If not, use `docker compose exec keycloak /opt/keycloak/bin/kcadm.sh` to reset:
   ```bash
   docker compose exec keycloak /opt/keycloak/bin/kcadm.sh set-credentials \
     -r master --username admin --password OLD_PASSWORD
   ```
3. Revert `.env` KEYCLOAK_ADMIN_PASSWORD

### Git History Rollback
- The mirror backup (`S:\BackEndSureLM.mirror-backup`) contains the pre-rewrite history
- To restore: `git push origin main --force` from the backup clone

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PostgreSQL password change causes data loss | Very Low | High | Password change does not affect data. Backup `postgres_data_0` volume anyway. |
| Keycloak loses DB connection during rotation | Medium | Low | Stop Keycloak before changing PostgreSQL password. Brief downtime (~10s). |
| Application cannot connect after rotation | Low | Medium | Update all 3 .env files. Verify with `npx prisma db execute`. |
| Git history rewrite breaks collaborator repos | High | Medium | Notify all collaborators. They must re-clone. |
| New credentials are weak | Low | High | Generate 16+ char passwords with mixed complexity. Use password manager. |
| Docker Desktop unresponsive during rotation | Medium | High | Wait for Docker to be healthy before starting. Check with `docker compose ps`. |
| Backup branches still have credentials after rewrite | Low | Medium | Ensure `git filter-repo` processes ALL branches. Verify after rewrite. |

---

## 9. Files Requiring Updates

| File | Credential(s) | Change Type |
|------|--------------|-------------|
| `.env` | C1 (DATABASE_URL), C2 (KEYCLOAK_ADMIN_PASSWORD) | Update password in connection string and env var |
| `.env.local` | C1 (DATABASE_URL), C3 (INITIAL_ADMIN_PASSWORD) | Update password in connection string and env var |
| `config/.env` | C1 (DATABASE_URL) | Update password in connection string |
| `docker-compose.yml` | C2, C3 (via env vars) | No file change needed — reads from `.env` |
| `test/SetupKeycloak.ts` | C2 (TEST_USERNAME/TEST_PASSWORD) | No file change — reads from `.env` |
| `scripts/bootstrap-keycloak.ts` | C2, C3 | No file change — reads from env vars |

**Note:** After credential rotation, the `.env` files will contain the new credentials. These files are gitignored and will NOT be committed.

---

## 10. Git History Cleanup (Phase D — Separate Operation)

### Credentials to replace in history
| String | Replacement | Commits affected |
|--------|-------------|-----------------|
| `localpg2024` | `REMOVED安全隐患` | ~16 commits across all branches |
| `admin123` | `REMOVED安全隐患` | ~5 commits |
| `Chang3M3` | `REMOVED安全隐患` | 2 commits |
| `kcadmin123` | `REMOVED安全隐患` | 3 commits |
| `keycloakkspass` | `REMOVED安全隐患` | 2 commits |
| `Admin@2024!dev` | `REMOVED安全隐患` | 2 commits |

### Command
```bash
# Prepare expressions file
cat > /tmp/expressions.txt << 'EOF'
localpg2024==>REMOVED安全隐患
admin123==>REMOVED安全隐患
Chang3M3==>REMOVED安全隐患
kcadmin123==>REMOVED安全隐患
keycloakkspass==>REMOVED安全隐患
Admin@2024!dev==>REMOVED安全隐患
EOF

# Run filter-repo (rewrites ALL branches)
cd S:\BackEndSureLM
git filter-repo --replace-text /tmp/expressions.txt --force
```

### Post-cleanup
```bash
# Force push all branches
git push origin main --force
git push origin backup-20260713 --force
git push origin backup/pre-refactor-2026-07-27 --force

# Verify
git log --all -p -S "localpg2024" --oneline  # Should be empty
```

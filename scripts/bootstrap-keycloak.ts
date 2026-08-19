#!/usr/bin/env tsx

/**
 * Keycloak Bootstrap Script for SureLM
 * ====================================
 * Creates application roles and initial admin user.
 *
 * Usage: npx tsx scripts/bootstrap-keycloak.ts
 *
 * Required Environment Variables:
 *   KEYCLOAK_URL         - Base URL (e.g., https://localhost:18444/auth)
 *   KEYCLOAK_ADMIN_USER  - Keycloak admin username (default: admin)
 *   KEYCLOAK_ADMIN_PWD   - Keycloak admin password
 *   KEYCLOAK_REALM       - Realm name (default: surelm_0_realm)
 *
 * Optional Environment Variables:
 *   INITIAL_ADMIN_USERNAME - Initial user username (default: initial-admin)
 *   INITIAL_ADMIN_EMAIL    - Initial user email (default: admin@surelm.com)
 *   INITIAL_ADMIN_PASSWORD - Initial user password (NOT SET = warn in prod)
 *   KEYCLOAK_CLIENT_ID     - Client ID for app (default: web-app)
 */

import "dotenv/config";

const CONFIG = {
  keycloakUrl: process.env.KEYCLOAK_URL,
  adminUser: process.env.KEYCLOAK_ADMIN_USER || "admin",
  adminPassword: process.env.KEYCLOAK_ADMIN_PWD,
  realmName: process.env.KEYCLOAK_REALM || "surelm_0_realm",
  clientId: process.env.KEYCLOAK_CLIENT_ID || "web-app",
  initialAdminUsername: process.env.INITIAL_ADMIN_USERNAME,
  initialAdminEmail: process.env.INITIAL_ADMIN_EMAIL,
  initialAdminPassword: process.env.INITIAL_ADMIN_PASSWORD,
};

function requireEnv(name: string, description?: string): string {
  const value = CONFIG[name as keyof typeof CONFIG] as string;
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    if (description) console.error(`   Description: ${description}`);
    process.exit(1);
  }
  return value;
}

function validateConfig() {
  const isLocalhost = CONFIG.keycloakUrl?.includes("localhost") ||
                    CONFIG.keycloakUrl?.includes("127.0.0.1");

  if (!isLocalhost && !CONFIG.initialAdminPassword) {
    console.warn("⚠️  Production deployment detected but INITIAL_ADMIN_PASSWORD not set!");
    console.warn("   Set INITIAL_ADMIN_PASSWORD to a secure value (min 12 chars, mixed case, numbers)");
  }
}

validateConfig();

const KEYCLOAK_URL = requireEnv("keycloakUrl", "Keycloak base URL");
const ADMIN_USER = CONFIG.adminUser;
const ADMIN_PASSWORD = requireEnv("adminPassword", "Keycloak admin password");
const REALM_NAME = CONFIG.realmName;

const INITIAL_USERNAME = CONFIG.initialAdminUsername || "initial-admin";
const INITIAL_EMAIL = CONFIG.initialAdminEmail || "admin@surelm.com";
const INITIAL_PASSWORD: string = (() => {
  if (!CONFIG.initialAdminPassword) {
    console.error("❌ Missing required environment variable: INITIAL_ADMIN_PASSWORD");
    console.error("   Set INITIAL_ADMIN_PASSWORD in your .env.local file.");
    process.exit(1);
  }
  return CONFIG.initialAdminPassword;
})();

console.log("🔐 Starting Keycloak Bootstrap:");
console.log(`   Realm:     ${REALM_NAME}`);
console.log(`   URL:       ${KEYCLOAK_URL}`);

async function waitForKeycloak(maxRetries = 30, delayMs = 2000): Promise<boolean> {
  console.log("⏳ Waiting for Keycloak...");

  for (let i = 1; i <= maxRetries; i++) {
    try {
      const response = await fetch(`${KEYCLOAK_URL}/realms/${REALM_NAME}`, {
        method: "HEAD", signal: AbortSignal.timeout(5000)
      });

      if (response.ok || response.status === 401) {
        console.log("✅ Keycloak is ready");
        return true;
      }
    } catch (error) {}

    if (i < maxRetries) {
      process.stdout.write(`   Attempt ${i}/${maxRetries}... `);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      console.log("retrying");
    }
  }

  console.error("❌ Keycloak not available after multiple attempts");
  return false;
}

async function getAdminAccessToken(): Promise<string> {
  const response = await fetch(`${KEYCLOAK_URL}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "password",
      client_id: "admin-cli",
      username: ADMIN_USER,
      password: ADMIN_PASSWORD,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function createRoleIfNotExists(token: string, roleName: string, description?: string): Promise<void> {
  const existing = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles/${roleName}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  if (existing.status === 200) {
    console.log(`   Role '${roleName}' already exists`);
    return;
  }

  await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/roles`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: roleName,
      description: description || `${roleName} role for SureLM`,
      composite: false,
      clientRole: false,
    }),
  });

  console.log(`   ✅ Created role: ${roleName}`);
}

async function getUserIdByUsername(token: string, username: string): Promise<string | null> {
  const response = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users?username=${username}`,
    { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
  );

  if (!response.ok) return null;

  const users = await response.json();
  return users.length > 0 ? users[0].id : null;
}

async function createUser(token: string, username: string, email: string, password: string, roles: string[]): Promise<void> {
  const userId = await getUserIdByUsername(token, username);

  if (userId) {
    console.log(`   User '${username}' already exists`);
    return;
  }

  const response = await fetch(`${KEYCLOAK_URL}/admin/realms/${REALM_NAME}/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email,
      firstName: "Initial",
      lastName: "Admin",
      enabled: true,
      credentials: [{ type: "password", value: password, temporary: false }],
      realmRoles: roles,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`User creation failed: ${response.status} - ${errorBody}`);
  }

  console.log(`   ✅ Created user: ${username}`);
}

async function bootstrap() {
  try {
    if (!await waitForKeycloak()) process.exit(1);

    console.log("\n🔑 Getting admin token...");
    const token = await getAdminAccessToken();

    const ROLES = [
      { name: "admin", description: "Full system administrator" },
      { name: "agent", description: "Insurance agent - dashboard access" },
    ];

    console.log("\n📋 Creating application roles...");
    for (const role of ROLES) {
      await createRoleIfNotExists(token, role.name, role.description);
    }

    console.log(`\n👤 Creating initial admin user (${INITIAL_USERNAME})...`);
    await createUser(token, INITIAL_USERNAME, INITIAL_EMAIL, INITIAL_PASSWORD, ["admin"]);

    console.log("\n✅ Bootstrap complete!");
    console.log("\n🚀 Login with:");
    console.log(`   URL:       ${KEYCLOAK_URL}/realms/${REALM_NAME}`);
    console.log(`   Username:  ${INITIAL_USERNAME}`);
  } catch (error) {
    console.error("\n❌ Bootstrap failed:", error);
    process.exit(1);
  }
}

bootstrap();
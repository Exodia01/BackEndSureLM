import 'dotenv/config';

export const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'https://localhost:18444/auth';
export const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM || 'surelm_0_realm';
export const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'web-app';
export const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
export const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://admin:[REDACTED-CREDENTIAL]@localhost:6432/surelm_0';

// The local Keycloak used by the integration suite serves a self-signed cert.
// Trust it for loopback hosts only so the live smoke tests can actually connect
// (the cert would otherwise be rejected by Node's fetch). This is test
// infrastructure for the dev Keycloak — not production auth.
if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(KEYCLOAK_URL)) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export async function verifyKeycloakHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export async function getTestAccessToken(username?: string, password?: string): Promise<string | null> {
  try {
    const client_id = KEYCLOAK_CLIENT_ID;
    const user = username || process.env.TEST_USERNAME || 'admin';
    const pass = password || process.env.TEST_PASSWORD || 'admin';

    const params = new URLSearchParams({
      grant_type: 'password',
      client_id,
      username: user,
      password: pass
    });

    const response = await fetch(`${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error(`Keycloak token request failed: ${response.status}`);
    }

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('Error getting test access token:', error);
    return null;
  }
}

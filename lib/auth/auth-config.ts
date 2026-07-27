export const KEYCLOAK_URL = process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL;
export const REALM = process.env.KEYCLOAK_REALM || "surelm_realm";
export const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || "web-app";
export const REDIRECT_URI = process.env.KEYCLOAK_REDIRECT_URI || "http://localhost:3000/callback";

export const KEYCLOAK_CONFIG = {
  url: KEYCLOAK_URL,
  realm: REALM,
  clientId: CLIENT_ID,
  redirectUri: REDIRECT_URI,
};

export const authConfig = {
  loginUrl: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth`,
  tokenUrl: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
  logoutUrl: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout`,
  userinfoUrl: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/userinfo`,
  jwksUri: `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/certs`,
};

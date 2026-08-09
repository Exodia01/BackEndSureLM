import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, JWTPayload } from "jose";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

interface KeycloakConfig {
  issuer: string;
  clientId: string;
  realm: string;
}

const KEYCLOAK_CONFIG: KeycloakConfig = {
  issuer: process.env.KEYCLOAK_URL || "https://localhost:18444/auth/realms/surelm_0_realm",
  clientId: process.env.KEYCLOAK_CLIENT_ID || "web-app",
  realm: process.env.KEYCLOAK_REALM || "surelm_0_realm",
};

const JWKS_URL = `${KEYCLOAK_CONFIG.issuer}/protocol/openid-connect/certs`;

const remoteJWKS = createRemoteJWKSet(new URL(JWKS_URL));

interface KeycloakJWTPayload extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}

function deriveRealmRole(realmRoles: string[], clientRoles: string[]): "ADMIN" | "AGENT" | null {
  const allRoles = [...realmRoles, ...clientRoles];
  if (allRoles.includes("admin")) return "ADMIN";
  if (allRoles.includes("agent")) return "AGENT";
  // No default - only admin/agent get a realmRole. Authorization uses Keycloak roles.
  return null;
}

/**
 * Ensure a user record exists in the database for the authenticated Keycloak user.
 * The DB realmRole is ONLY set for users with verified admin/agent Keycloak roles.
 * Authorization is enforced by requireAuth/requireAgent/requireAdmin guards.
 */
export async function ensureUserInDb(payload: KeycloakJWTPayload): Promise<{
  id: string;
  keycloakId: string;
  email: string | null;
  name: string;
  realmRole: "ADMIN" | "AGENT" | null;
}> {
  const userInfo = getUserFromToken(payload);
  const realmRole = deriveRealmRole(userInfo.realmRoles || [], userInfo.clientRoles || []);

  const user = await db.user.upsert({
    where: { keycloakId: userInfo.sub },
    update: {
      email: userInfo.email ?? "",
      name: userInfo.name ?? "User",
      realmRole,
    },
    create: {
      keycloakId: userInfo.sub,
      email: userInfo.email ?? "",
      name: userInfo.name ?? "User",
      realmRole,
    },
  });

  return {
    id: user.id,
    keycloakId: user.keycloakId,
    email: user.email,
    name: user.name,
    realmRole: user.realmRole,
  };
}

/**
 * Verify Keycloak token using cryptographic signature verification
 */
async function verifyToken(token: string): Promise<KeycloakJWTPayload | null> {
  try {
    const { payload } = await jwtVerify<KeycloakJWTPayload>(token, remoteJWKS, {
      issuer: KEYCLOAK_CONFIG.issuer,
      audience: KEYCLOAK_CONFIG.clientId,
      algorithms: ["RS256"],
      clockTolerance: 30,
    });

    return payload;
  } catch (error) {
    console.error("[Keycloak Verify] Token verification failed:", error);
    return null;
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7).trim();
}

/**
 * Validate Keycloak authentication for a request
 */
export async function validateAuth(req: NextRequest): Promise<{
  valid: boolean;
  payload: KeycloakJWTPayload;
  error?: string;
} | {
  valid: false;
  payload?: never;
  error: string;
}> {
  const token = extractBearerToken(req);

  if (!token) {
    return { valid: false, error: "No authorization header" };
  }

  const payload = await verifyToken(token);

  if (!payload) {
    return { valid: false, error: "Invalid or expired token" };
  }

  return { valid: true, payload };
}

/**
 * Create protected API route handler with Keycloak auth
 */
export function protectRoute(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { valid, error } = await validateAuth(req);

    if (!valid) {
      return NextResponse.json(
        { success: false, error: error || "Unauthorized" },
        { status: 401 }
      );
    }

    return handler(req);
  };
}

/**
 * Extract user information from Keycloak token
 */
export function getUserFromToken(payload: KeycloakJWTPayload): {
  sub: string;
  email?: string;
  name?: string;
  preferredUsername?: string;
  realmRoles?: string[];
  clientRoles?: string[];
} {
  const clientAccess = payload.resource_access?.[KEYCLOAK_CONFIG.clientId];
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    preferredUsername: payload.preferred_username,
    realmRoles: payload.realm_access?.roles || [],
    clientRoles: clientAccess?.roles || [],
  };
}
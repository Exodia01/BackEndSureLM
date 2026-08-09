import { NextRequest, NextResponse } from "next/server";
import { validateAuth } from "@/lib/auth/keycloak";

export interface AuthUser {
  sub: string;
  email?: string;
  name?: string;
  preferredUsername?: string;
  realmRoles: string[];
  clientRoles: string[];
}

export type AuthResult =
  | { ok: true; user: AuthUser; response?: undefined }
  | { ok: false; response: NextResponse };

function getAdminRole(): string {
  return process.env.ADMIN_REALM_ROLE || "admin";
}

function getAgentRole(): string {
  return process.env.AGENT_REALM_ROLE || "agent";
}

function toAuthUser(payload: {
  sub: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles: string[] };
  resource_access?: Record<string, { roles: string[] }>;
}): AuthUser {
  const clientAccess = payload.resource_access?.[process.env.KEYCLOAK_CLIENT_ID || "web-app"];
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    preferredUsername: payload.preferred_username,
    realmRoles: payload.realm_access?.roles || [],
    clientRoles: clientAccess?.roles || [],
  };
}

function unauthorized(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

function hasRole(user: AuthUser, role: string): boolean {
  return user.realmRoles.includes(role) || user.clientRoles.includes(role);
}

/**
 * Require a valid Keycloak session (any authenticated user).
 * Returns { ok: true, user } or a 401 NextResponse.
 */
export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const { valid, payload, error } = await validateAuth(req);

  if (!valid) {
    return { ok: false, response: unauthorized(error || "Unauthorized") };
  }

  return {
    ok: true,
    user: toAuthUser(payload as any),
  };
}

/**
 * Require a valid Keycloak session AND the admin realm role.
 * Defense-in-depth: no token -> 401, authenticated non-admin -> 403.
 */
export async function requireAdmin(req: NextRequest): Promise<AuthResult> {
  const { valid, payload, error } = await validateAuth(req);

  if (!valid) {
    return { ok: false, response: unauthorized(error || "Unauthorized") };
  }

  const user = toAuthUser(payload as any);

  if (!hasRole(user, getAdminRole())) {
    return { ok: false, response: forbidden("Admin access required") };
  }

  return { ok: true, user };
}

/**
 * Require a valid Keycloak session AND the agent realm role (or admin).
 * Defense-in-depth: no token -> 401, authenticated non-agent -> 403.
 */
export async function requireAgent(req: NextRequest): Promise<AuthResult> {
  const { valid, payload, error } = await validateAuth(req);

  if (!valid) {
    return { ok: false, response: unauthorized(error || "Unauthorized") };
  }

  const user = toAuthUser(payload as any);

  if (!hasRole(user, getAgentRole()) && !hasRole(user, getAdminRole())) {
    return { ok: false, response: forbidden("Agent access required") };
  }

  return { ok: true, user };
}

/**
 * Wrap a route handler with admin-only enforcement.
 */
export function withAdmin(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await requireAdmin(req);
    if (!auth.ok) return auth.response;
    return handler(req, auth.user);
  };
}

/**
 * Wrap a route handler with agent enforcement.
 */
export function withAgent(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await requireAgent(req);
    if (!auth.ok) return auth.response;
    return handler(req, auth.user);
  };
}

/**
 * Wrap a route handler with any-authenticated-user enforcement.
 */
export function withAuth(
  handler: (req: NextRequest, user: AuthUser) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    return handler(req, auth.user);
  };
}

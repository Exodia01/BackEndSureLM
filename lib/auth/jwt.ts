import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";

const JWKS_CACHE = {
  keys: null as any,
  lastFetched: 0,
  CACHE_TTL: 3600000, 
};

async function fetchJWKS() {
  const now = Date.now();
  
  if (JWKS_CACHE.keys && (now - JWKS_CACHE.lastFetched) < JWKS_CACHE.CACHE_TTL) {
    return JWKS_CACHE.keys;
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL}/realms/${
        process.env.KEYCLOAK_REALM || "surelm_realm"
      }/protocol/openid-connect/certs`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch JWKS");
    }

    const jwks = await response.json();
    
    JWKS_CACHE.keys = jwks;
    JWKS_CACHE.lastFetched = now;

    return jwks;
  } catch (error) {
    console.error("Error fetching JWKS:", error);
    throw error;
  }
}

export async function verifyJWT(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
  try {
    const jwks = await fetchJWKS();
    
    const { payload } = await jwtVerify(token, jwks);
    
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: "Token expired" };
    }
    
    if (payload.nbf && payload.nbf > now) {
      return { valid: false, error: "Token not yet valid" };
    }

    const clientId = process.env.KEYCLOAK_CLIENT_ID || "web-app";
    if (payload.aud && !Array.isArray(payload.aud)) {
      if (payload.aud !== clientId) {
        return { valid: false, error: "Invalid audience" };
      }
    } else if (payload.aud && Array.isArray(payload.aud)) {
      if (!payload.aud.includes(clientId)) {
        return { valid: false, error: "Invalid audience" };
      }
    }

    const realm = process.env.KEYCLOAK_REALM || "surelm_realm";
    const expectedIssuer = `${process.env.NEXT_PUBLIC_KEYCLOAK_URL || process.env.KEYCLOAK_URL}/realms/${realm}`;
    if (payload.iss && payload.iss !== expectedIssuer) {
      return { valid: false, error: "Invalid issuer" };
    }

    return { valid: true, payload };
  } catch (error: any) {
    console.error("JWT verification failed:", error);
    return { valid: false, error: error.message || "Token verification failed" };
  }
}

export async function validateRequest(req: NextRequest): Promise<{
  user?: any;
  authenticated: boolean;
}> {
  const token = req.cookies.get("keycloak_access_token")?.value;

  if (!token) {
    return { authenticated: false };
  }

  const result = await verifyJWT(token);

  if (!result.valid || !result.payload) {
    return { authenticated: false };
  }

  return {
    authenticated: true,
    user: {
      id: result.payload.sub,
      keycloakId: result.payload.preferred_username || result.payload.sub,
      email: result.payload.email || "",
      name: result.payload.name || "",
      role: (result.payload.role as "AGENT" | "ADMIN") || "AGENT",
    },
  };
}

import { NextRequest, NextResponse } from "next/server";
import { KEYCLOAK_URL, REALM, CLIENT_ID } from "@/lib/auth/auth-config";
import { verifyJWT } from "@/lib/auth/jwt";
import * as SessionModule from "@/lib/auth/session";

const RATE_LIMIT_STORE = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 60000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = RATE_LIMIT_STORE.get(ip);
  
  if (!record || now > record.resetTime) {
    RATE_LIMIT_STORE.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

function hashValue(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  return crypto.subtle.digest("SHA-256", data).then((hashBuffer) => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return btoa(String.fromCharCode(...hashArray))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  });
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";

    if (!checkRateLimit(ip)) {
      console.error(`RATE_LIMIT_EXCEEDED - IP: ${ip}`, { ip });
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    const body = await req.json();
    const { code, state: returnedState } = body;

    if (!code) {
      console.error(`PKCE_VALIDATION_FAILED - Missing code - IP: ${ip}`, { ip });
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    const storedState = req.cookies.get("pkce_state")?.value;
    const storedVerifier = req.cookies.get("pkce_verifier")?.value;

    if (!storedState || !storedVerifier) {
      console.error(`PKCE_VALIDATION_FAILED - Missing PKCE cookies - IP: ${ip}`, { ip });
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    if (returnedState !== storedState) {
      const expectedHash = await hashValue(storedState);
      const receivedHash = await hashValue(returnedState);
      
      console.error(
        `PKCE_VALIDATION_FAILED - State mismatch - IP: ${ip}`,
        { ip, reason: "State parameter mismatch", details: { expectedHash, receivedHash } }
      );
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/callback`,
      code_verifier: storedVerifier,
    });

    const response = await fetch(
      `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error(`TOKEN_EXCHANGE_FAILED - IP: ${ip}`, { 
        ip, 
        reason: errorData.error_description || "Token exchange failed",
        status: response.status 
      });
      
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    const data = await response.json();

    const jwtResult = await verifyJWT(data.access_token);
    
    if (!jwtResult.valid || !jwtResult.payload) {
      console.error(`PKCE_VALIDATION_FAILED - Invalid token - IP: ${ip}`, { ip });
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    try {
      await SessionModule.createSessionWithPKCE(
        jwtResult.payload.sub,
        jwtResult.payload.preferred_username || jwtResult.payload.sub,
        data.access_token,
        data.refresh_token,
        new Date(jwtResult.payload.exp * 1000),
        storedVerifier,
        storedState
      );
      
      console.log(`LOGIN_SUCCESS - IP: ${ip}`, { 
        ip, 
        userId: jwtResult.payload.sub 
      });
    } catch (dbError) {
      console.error("LOGIN_FAILED - Database error", { ip, userId: jwtResult.payload.sub, error: dbError });
      return NextResponse.redirect(
        new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
        { status: 302 }
      );
    }

    const clearOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    };

    const responseWithToken = NextResponse.redirect(
      new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`),
      { status: 302 }
    );
    
    if (data.access_token) {
      responseWithToken.cookies.set("keycloak_access_token", data.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: data.expires_in * 60,
        sameSite: "lax" as const,
        path: "/",
      });
    }
    
    if (data.refresh_token) {
      responseWithToken.cookies.set("keycloak_refresh_token", data.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax" as const,
        path: "/",
      });
    }
    
    responseWithToken.cookies.set("pkce_state", "", clearOptions);
    responseWithToken.cookies.set("pkce_verifier", "", clearOptions);
    
    return responseWithToken;
  } catch (error) {
    console.error(`TOKEN_EXCHANGE_FAILED - IP: ${req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown"}`, { 
      ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown",
      error: error instanceof Error ? error.message : String(error)
    });
    return NextResponse.redirect(
      new URL(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login?error=auth_failed`),
      { status: 302 }
    );
  }
}

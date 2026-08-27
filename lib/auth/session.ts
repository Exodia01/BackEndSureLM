import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { validateAuth } from "@/lib/auth/keycloak";

interface Session {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  user?: any;
}

interface VerifiedToken {
  sub?: string;
  email?: string;
  name?: string;
  preferred_username?: string;
  exp?: number;
}

export class KeycloakSession {
  private static SESSION_COOKIE = "keycloak_session";
  private static ACCESS_TOKEN_KEY = "access_token";
  private static REFRESH_TOKEN_KEY = "refresh_token";
  private static EXPIRES_AT_KEY = "expires_at";
  private static USER_KEY = "user";

  /**
   * Get current session from cookies
   */
  static async get(): Promise<Session | null> {
    const cookieStore = await cookies();
    const sessionData = cookieStore.get(this.SESSION_COOKIE);

    if (!sessionData) return null;

    const data = this.unsignSession(sessionData.value);
    if (!data) return null;

    // Check if token is expired
    if (data.expiresAt && Date.now() > data.expiresAt) {
      if (data.refreshToken) {
        // Auto-refresh token
        await this.refresh(data.refreshToken);
        return this.get();
      }
      return null;
    }

    return data;
  }

  /**
   * Create new session with tokens
   */
  static async set(accessToken: string, refreshToken?: string): Promise<void> {
    const payload = await this.verifyAccessToken(accessToken);
    if (!payload) throw new Error("Invalid access token");

    // Calculate expiration (subtract 5 minutes as buffer)
    const expiresAt = (payload.exp || 0) * 1000 - 5 * 60 * 1000;

    const sessionData: Session = {
      accessToken,
      refreshToken,
      expiresAt,
      user: this.extractUser(payload),
    };

    const cookieStore = await cookies();
    cookieStore.set({
      name: this.SESSION_COOKIE,
      value: this.signSession(sessionData),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: expiresAt - Date.now(),
      path: "/",
    });
  }

  /**
   * Update session with new access token
   */
  static async update(accessToken: string): Promise<void> {
    const prevSession = await this.get();

    if (!prevSession) {
      throw new Error("No existing session to update");
    }

    const payload = await this.verifyAccessToken(accessToken);
    if (!payload) throw new Error("Invalid access token");
    const expiresAt = (payload.exp || 0) * 1000 - 5 * 60 * 1000;

    const updated: Session = {
      ...prevSession,
      accessToken,
      expiresAt,
      user: this.extractUser(payload),
    };

    const cookieStore = await cookies();
    cookieStore.set({
      name: this.SESSION_COOKIE,
      value: this.signSession(updated),
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: expiresAt - Date.now(),
      path: "/",
    });
  }

  /**
   * Refresh session with new tokens
   */
  static async refresh(refreshToken: string): Promise<void> {
    const tokenUrl = `${process.env.KEYCLOAK_URL}/protocol/openid-connect/token`;

    try {
      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.KEYCLOAK_CLIENT_ID!,
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) throw new Error("Token refresh failed");

      const data = await response.json();

      await this.set(data.access_token, data.refresh_token);
    } catch (error) {
      console.error("[Keycloak Session] Refresh failed:", error);
      await this.clear();
      throw error;
    }
  }

  /**
   * Clear session cookies
   */
  static async clear(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(this.SESSION_COOKIE);
  }

  /**
   * Check if user has specific realm role
   */
  static async hasRealmRole(role: string): Promise<boolean> {
    const session = await this.get();
    return session?.user?.realmRoles?.includes(role) ?? false;
  }

  /**
   * Check if user has specific client role
   */
  static async hasClientRole(role: string): Promise<boolean> {
    const session = await this.get();
    return session?.user?.clientRoles?.includes(role) ?? false;
  }

  /**
   * Extract user info from token payload
   */
  private static extractUser(payload: any): {
    id: string;
    email?: string;
    name?: string;
    username?: string;
  } {
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      username: payload.preferred_username,
    };
  }

  /**
   * Cryptographically verify an access token using the canonical Keycloak verifier
   */
  private static async verifyAccessToken(accessToken: string): Promise<VerifiedToken | null> {
    const req = new NextRequest("http://localhost", {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const result = await validateAuth(req);
    return result.valid ? result.payload : null;
  }

  /**
   * HMAC-SHA256 sign the serialized session using the server secret.
   * Fails closed when SESSION_SECRET is not configured.
   */
  private static signSession(session: Session): string {
    const secret = this.getSessionSecret();
    const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
    const mac = createHmac("sha256", secret).update(payload).digest("base64url");
    return `${payload}.${mac}`;
  }

  /**
   * Verify the HMAC signature before trusting any session cookie contents.
   * Returns null for missing, tampered, or malformed cookies.
   */
  private static unsignSession(value: string): Session | null {
    const secret = this.getSessionSecret();

    const lastDot = value.lastIndexOf(".");
    if (lastDot === -1) return null;

    const payload = value.slice(0, lastDot);
    const mac = value.slice(lastDot + 1);

    const expected = createHmac("sha256", secret).update(payload).digest("base64url");

    const received = Buffer.from(mac);
    const expectedBuf = Buffer.from(expected);

    if (received.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(received, expectedBuf)) return null;

    try {
      const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
      if (!session || typeof session.expiresAt !== "number") return null;
      return session;
    } catch {
      return null;
    }
  }

  /**
   * Stable, environment-provided secret for HMAC signing.
   * Fails closed (throws) in all environments when absent.
   */
  private static getSessionSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (!secret) {
      const msg = process.env.NODE_ENV === "production"
        ? "[Keycloak Session] SESSION_SECRET must be set in production. " +
          "Set SESSION_SECRET to a high-entropy secret (e.g. openssl rand -hex 32)."
        : "[Keycloak Session] SESSION_SECRET is not configured. Set SESSION_SECRET to a stable, high-entropy secret before starting the server.";
      throw new Error(msg);
    }
    return secret;
  }
}

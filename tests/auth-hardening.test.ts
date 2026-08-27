import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

process.env.SESSION_SECRET = "test-secret-for-unit-tests-only";

const mockSetCookie = vi.fn();
const mockDeleteCookie = vi.fn();
const mockGetCookie = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mockGetCookie,
    set: mockSetCookie,
    delete: mockDeleteCookie,
  }),
}));

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: mockValidateAuth,
}));

const { KeycloakSession } = await import("@/lib/auth/session");
const { default: middleware } = await import("@/middleware");

const PAYLOAD = {
  sub: "user-123",
  email: "a@b.co",
  name: "Alice",
  preferred_username: "alice",
  exp: Math.floor(Date.now() / 1000) + 3600,
};

describe("lib/auth/session.ts hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SESSION_SECRET = "test-secret-stable-value";
    mockGetCookie.mockReset();
    mockSetCookie.mockReset();
    mockDeleteCookie.mockReset();
  });

  it("set() rejects an invalid (unverifiable) access token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "Invalid or expired token" });
    await expect(KeycloakSession.set("not-a-valid-token")).rejects.toThrow("Invalid access token");
    expect(mockSetCookie).not.toHaveBeenCalled();
  });

  it("set() stores a signed cookie for a verified token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await KeycloakSession.set("valid.token.here", "refresh-1");
    expect(mockSetCookie).toHaveBeenCalledTimes(1);
    const call = mockSetCookie.mock.calls[0][0];
    expect(call.name).toBe("keycloak_session");
    expect(call.value).toContain(".");
    expect(call.httpOnly).toBe(true);
    expect(call.sameSite).toBe("strict");
  });

  it("get() returns session for a validly signed cookie", async () => {
    // Build a signed cookie through set(), then read it back.
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await KeycloakSession.set("valid.token.here");
    const cookieValue = mockSetCookie.mock.calls[0][0].value;
    mockGetCookie.mockReturnValue({ value: cookieValue });
    const session = await KeycloakSession.get();
    expect(session?.user?.id).toBe("user-123");
    expect(session?.accessToken).toBe("valid.token.here");
  });

  it("get() rejects a cookie with a tampered payload", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await KeycloakSession.set("valid.token.here");
    const cookieValue = mockSetCookie.mock.calls[0][0].value;
    const lastDot = cookieValue.lastIndexOf(".");
    const tampered = `eyJmb28iOiJiYXIifQ${cookieValue.slice(lastDot)}`;
    mockGetCookie.mockReturnValue({ value: tampered });
    expect(await KeycloakSession.get()).toBeNull();
  });

  it("get() rejects a cookie with a modified signature", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await KeycloakSession.set("valid.token.here");
    const cookieValue = mockSetCookie.mock.calls[0][0].value;
    const lastDot = cookieValue.lastIndexOf(".");
    const corrupted = cookieValue.slice(0, lastDot + 1) + "AAAA" + cookieValue.slice(lastDot + 5);
    mockGetCookie.mockReturnValue({ value: corrupted });
    expect(await KeycloakSession.get()).toBeNull();
  });

  it("get() rejects malformed cookies", async () => {
    mockGetCookie.mockReturnValue({ value: "no-dot-separator-here" });
    expect(await KeycloakSession.get()).toBeNull();
    mockGetCookie.mockReturnValue({ value: "" });
    expect(await KeycloakSession.get()).toBeNull();
  });

  it("get() returns null when cookie is absent", async () => {
    mockGetCookie.mockReturnValue(undefined);
    expect(await KeycloakSession.get()).toBeNull();
  });

  it("stable secret semantics: signed cookie readable with same secret, rejected with different secret", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await KeycloakSession.set("valid.token.here");
    const cookieValue = mockSetCookie.mock.calls[0][0].value;

    mockGetCookie.mockReturnValue({ value: cookieValue });
    expect(await KeycloakSession.get()).not.toBeNull();

    process.env.SESSION_SECRET = "different-secret";
    expect(await KeycloakSession.get()).toBeNull();
  });

  it("fails closed (throws config error) when SESSION_SECRET is absent", async () => {
    delete process.env.SESSION_SECRET;
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    await expect(KeycloakSession.set("valid.token.here")).rejects.toThrow(/SESSION_SECRET/);
    mockGetCookie.mockReturnValue({ value: "abc.def" });
    await expect(KeycloakSession.get()).rejects.toThrow(/SESSION_SECRET/);
  });

  it("refresh() still depends only on the supplied refresh token, not stored accessToken", async () => {
    const spy = vi.spyOn(KeycloakSession, "set").mockResolvedValue(undefined);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "new-access", refresh_token: "new-refresh" }),
    } as Response);
    await KeycloakSession.refresh("old-refresh");
    expect(spy).toHaveBeenCalledWith("new-access", "new-refresh");
    spy.mockRestore();
  });
});

describe("middleware.ts hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function req(url: string, authHeader?: string): NextRequest {
    const headers: Record<string, string> = {};
    if (authHeader) headers.authorization = authHeader;
    return new NextRequest(url, { headers });
  }

  it("redirects /dashboard to /sign-in when token is missing", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await middleware(req("http://localhost:3000/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("redirects /dashboard to /sign-in when token is invalid", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "Invalid or expired token" });
    const res = await middleware(req("http://localhost:3000/dashboard", "Bearer malformed"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/sign-in");
  });

  it("allows /dashboard when token is valid", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: PAYLOAD });
    const res = await middleware(req("http://localhost:3000/dashboard", "Bearer valid.token"));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("passes through non-protected routes", async () => {
    const res = await middleware(req("http://localhost:3000/sign-in"));
    expect(res.status).toBe(200);
    expect(mockValidateAuth).not.toHaveBeenCalled();
  });

  it("passes through API routes without invoking auth (API routes enforce auth themselves)", async () => {
    const res = await middleware(req("http://localhost:3000/api/leads"));
    expect(res.status).toBe(200);
    expect(mockValidateAuth).not.toHaveBeenCalled();
  });
});

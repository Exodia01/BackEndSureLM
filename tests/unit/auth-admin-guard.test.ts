import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const { requireAuth, requireAdmin } = await import("@/lib/auth/guards");

const ADMIN_PAYLOAD = {
  sub: "admin-1",
  email: "admin@x.co",
  preferred_username: "admin",
  realm_access: { roles: ["admin"] },
};

const AGENT_PAYLOAD = {
  sub: "agent-1",
  email: "agent@x.co",
  preferred_username: "agent",
  realm_access: { roles: ["agent"] },
};

function req(url = "http://localhost:3000/api/x"): NextRequest {
  return new NextRequest(url, { headers: { authorization: "Bearer token" } });
}

describe("auth guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ADMIN_REALM_ROLE;
  });

  it("requireAuth returns 401 when no valid token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "Invalid or expired token" });
    const result = await requireAuth(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(401);
  });

  it("requireAuth returns user for a valid token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_PAYLOAD });
    const result = await requireAuth(req());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.sub).toBe("agent-1");
      expect(result.user.realmRoles).toContain("agent");
    }
  });

  it("requireAdmin returns 401 for a missing/invalid token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const result = await requireAdmin(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(401);
  });

  it("requireAdmin returns 403 for an authenticated AGENT", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_PAYLOAD });
    const result = await requireAdmin(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(403);
  });

  it("requireAdmin allows an authenticated ADMIN", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN_PAYLOAD });
    const result = await requireAdmin(req());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.realmRoles).toContain("admin");
    }
  });

  it("requireAdmin honors ADMIN_REALM_ROLE env override", async () => {
    process.env.ADMIN_REALM_ROLE = "superadmin";
    const payload = { ...AGENT_PAYLOAD, realm_access: { roles: ["superadmin"] } };
    mockValidateAuth.mockResolvedValue({ valid: true, payload });
    const result = await requireAdmin(req());
    expect(result.ok).toBe(true);
  });

  it("requireAdmin recognizes the admin role via client roles", async () => {
    const payload = {
      sub: "a",
      resource_access: { "web-app": { roles: ["admin"] } },
    };
    mockValidateAuth.mockResolvedValue({ valid: true, payload });
    const result = await requireAdmin(req());
    expect(result.ok).toBe(true);
  });
});

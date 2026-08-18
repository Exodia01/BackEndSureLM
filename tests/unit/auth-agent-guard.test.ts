import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const { requireAuth, requireAgent } = await import("@/lib/auth/guards");

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

const USER_PAYLOAD = {
  sub: "user-1",
  email: "user@x.co",
  preferred_username: "user",
  realm_access: { roles: ["user"] },
};

function req(url = "http://localhost:3000/api/x"): NextRequest {
  return new NextRequest(url, { headers: { authorization: "Bearer token" } });
}

describe("requireAgent guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AGENT_REALM_ROLE;
    delete process.env.ADMIN_REALM_ROLE;
  });

  it("requireAgent returns 401 when no valid token", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "Invalid or expired token" });
    const result = await requireAgent(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(401);
  });

  it("requireAgent returns 403 for a USER role (not agent)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: USER_PAYLOAD });
    const result = await requireAgent(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(403);
  });

  it("requireAgent returns 403 for an authenticated user with no realm roles", async () => {
    mockValidateAuth.mockResolvedValue({
      valid: true,
      payload: { sub: "no-role", realm_access: { roles: [] } },
    });
    const result = await requireAgent(req());
    expect(result.ok).toBe(false);
    expect((result as any).response.status).toBe(403);
  });

  it("requireAgent allows an authenticated AGENT", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT_PAYLOAD });
    const result = await requireAgent(req());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.realmRoles).toContain("agent");
    }
  });

  it("requireAgent allows an authenticated ADMIN (admin remains authorized)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN_PAYLOAD });
    const result = await requireAgent(req());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.realmRoles).toContain("admin");
    }
  });

  it("requireAgent honors AGENT_REALM_ROLE env override", async () => {
    process.env.AGENT_REALM_ROLE = "field-agent";
    const payload = { ...USER_PAYLOAD, realm_access: { roles: ["field-agent"] } };
    mockValidateAuth.mockResolvedValue({ valid: true, payload });
    const result = await requireAgent(req());
    expect(result.ok).toBe(true);
  });

  it("requireAgent recognizes the agent role via client roles", async () => {
    const payload = {
      sub: "a",
      resource_access: { "web-app": { roles: ["agent"] } },
    };
    mockValidateAuth.mockResolvedValue({ valid: true, payload });
    const result = await requireAgent(req());
    expect(result.ok).toBe(true);
  });
});
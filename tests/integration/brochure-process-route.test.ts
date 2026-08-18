import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/auth/guards", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const dbMock = {
  brochure: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const mockProcessBrochure = vi.fn();
vi.mock("@/lib/pdf/batchProcess", () => ({
  processBrochure: (...args: unknown[]) => mockProcessBrochure(...args),
}));

const { POST } = await import("@/app/api/brochures/[id]/process/route");

const ADMIN = { sub: "admin-1", realm_access: { roles: ["admin"] } };

function req(): NextRequest {
  return new NextRequest("http://localhost:3000/api/brochures/b1/process", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/brochures/[id]/process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdmin.mockResolvedValue({ ok: true, user: ADMIN });
  });

  it("returns 401 when unauthenticated", async () => {
    mockRequireAdmin.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
    });

    const res = await POST(req(), { params: Promise.resolve({ id: "b1" }) } as any);
    expect(res.status).toBe(401);
    expect(mockProcessBrochure).not.toHaveBeenCalled();
  });

  it("returns 404 when brochure not found", async () => {
    dbMock.brochure.findUnique.mockResolvedValue(null);

    const res = await POST(req(), { params: Promise.resolve({ id: "missing" }) } as any);
    expect(res.status).toBe(404);
    expect(mockProcessBrochure).not.toHaveBeenCalled();
  });

  it("returns 200 without processing when brochure is already READY", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "READY" });

    const res = await POST(req(), { params: Promise.resolve({ id: "b1" }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("already processed");
    expect(mockProcessBrochure).not.toHaveBeenCalled();
  });

  it("calls processBrochure and returns result for a non-ready brochure", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "PROCESSING" });
    mockProcessBrochure.mockResolvedValue({ chunksCreated: 5, totalPages: 12 });

    const res = await POST(req(), { params: Promise.resolve({ id: "b1" }) } as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.chunksCreated).toBe(5);
    expect(body.totalPages).toBe(12);
    expect(mockProcessBrochure).toHaveBeenCalledWith("b1");
  });

  it("returns 500 when processing fails", async () => {
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", status: "PROCESSING" });
    mockProcessBrochure.mockRejectedValue(new Error("PDF parse failed"));

    const res = await POST(req(), { params: Promise.resolve({ id: "b1" }) } as any);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to process brochure");
  });
});

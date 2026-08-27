import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockValidateAuth = vi.fn();
vi.mock("@/lib/auth/keycloak", () => ({
  validateAuth: (...args: unknown[]) => mockValidateAuth(...args),
}));

const dbMock = {
  brochure: {
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  chunk: {
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  policyBrochure: {
    deleteMany: vi.fn(),
  },
  requirementDefinition: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: {},
  getDocument: vi.fn(),
}));

vi.mock("@/lib/pdf/batchProcess", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    uploadBrochure: vi.fn(),
    listBrochures: vi.fn(),
    deleteBrochureQdrantChunks: vi.fn(),
  };
});

vi.mock("fs/promises", () => ({ unlink: vi.fn().mockResolvedValue(undefined) }));

const { GET, POST } = await import("@/app/api/brochures/route");
const { DELETE: deleteBrochure } = await import("@/app/api/brochures/[id]/route");

const ADMIN = {
  sub: "admin-1",
  realm_access: { roles: ["admin"] },
};
const AGENT = {
  sub: "agent-1",
  realm_access: { roles: ["agent"] },
};

function req(url: string, opts: RequestInit = {}): NextRequest {
  return new NextRequest(url, opts as never);
}

describe("brochure API auth + pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET requires a valid token (401 when absent)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: false, error: "No authorization header" });
    const res = await GET(req("http://localhost:3000/api/brochures"));
    expect(res.status).toBe(401);
    expect(dbMock.brochure.findMany).not.toHaveBeenCalled();
  });

  it("GET lists brochures for an authenticated user", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const { listBrochures } = await import("@/lib/pdf/batchProcess");
    (listBrochures as ReturnType<typeof vi.fn>).mockResolvedValue({
      brochures: [],
      totalCount: 0,
    });

    const res = await GET(req("http://localhost:3000/api/brochures"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCount).toBe(0);
  });

  it("POST rejects an AGENT (403)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const form = new FormData();
    form.append("file", new File([new Uint8Array([1, 2, 3])], "a.pdf", { type: "application/pdf" }));
    const res = await POST(req("http://localhost:3000/api/brochures", { method: "POST", body: form }));
    expect(res.status).toBe(403);
  });

  it("POST rejects missing file even for admin (400)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    const form = new FormData();
    const res = await POST(req("http://localhost:3000/api/brochures", { method: "POST", body: form }));
    expect(res.status).toBe(400);
  });

  it("POST uploads a brochure for an ADMIN", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    const { uploadBrochure } = await import("@/lib/pdf/batchProcess");
    (uploadBrochure as ReturnType<typeof vi.fn>).mockResolvedValue({
      brochureId: "b1",
      status: "NEW",
    });
    const form = new FormData();
    form.append("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x00, 0x00, 0x00, 0x00])], "a.pdf", { type: "application/pdf" }));
    const res = await POST(req("http://localhost:3000/api/brochures", { method: "POST", body: form }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brochureId).toBe("b1");
  });

  it("DELETE rejects an AGENT (403)", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: AGENT });
    const res = await deleteBrochure(req("http://localhost:3000/api/brochures/b1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "b1" }),
    } as any);
    expect(res.status).toBe(403);
  });

  it("DELETE removes chunks, links, requirements, and the brochure for an ADMIN", async () => {
    mockValidateAuth.mockResolvedValue({ valid: true, payload: ADMIN });
    dbMock.brochure.findUnique.mockResolvedValue({ id: "b1", filePath: "/data/pdfs/h1.pdf" });
    dbMock.$transaction.mockResolvedValue([]);

    const res = await deleteBrochure(req("http://localhost:3000/api/brochures/b1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "b1" }),
    } as any);
    expect(res.status).toBe(200);
    expect(dbMock.chunk.deleteMany).toHaveBeenCalledWith({ where: { brochureId: "b1" } });
    expect(dbMock.brochure.delete).toHaveBeenCalledWith({ where: { id: "b1" } });
  });
});

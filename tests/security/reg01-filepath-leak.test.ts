import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * REG-01 regression: filePath must never escape to external API responses.
 *
 * Phase 2U found that listBrochures() and getBrochureById() in
 * lib/pdf/batchProcess.ts still selected filePath: true even after
 * Phase 2T H2 fixed the individual GET route. This test ensures
 * filePath is excluded at the data-access layer AND at the API layer.
 */

const FAKE_BROCHURE = {
  id: "b1",
  basename: "policy-brochure",
  originalName: "Policy Brochure.pdf",
  filePath: "/data/pdfs/policy-brochure.pdf",
  totalPages: 12,
  versionNum: 1,
  status: "READY",
  metadata: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-02"),
  _count: { chunks: 5, Log: 2 },
};

function simulateSelect(row: any, select?: Record<string, boolean>): any {
  if (!select) return row;
  const result: any = {};
  for (const [key, enabled] of Object.entries(select)) {
    if (enabled && key in row) result[key] = row[key];
  }
  return result;
}

let findManyArgs: any = null;
let findUniqueArgs: any = null;

beforeEach(() => {
  findManyArgs = null;
  findUniqueArgs = null;
});

vi.mock("@/lib/db", () => ({
  db: {
    brochure: {
      findMany: vi.fn().mockImplementation((args: any) => {
        findManyArgs = args;
        return Promise.resolve([simulateSelect(FAKE_BROCHURE, args.select)]);
      }),
      findUnique: vi.fn().mockImplementation((args: any) => {
        findUniqueArgs = args;
        return Promise.resolve(simulateSelect(FAKE_BROCHURE, args.select));
      }),
      count: vi.fn().mockResolvedValue(1),
    },
    chunk: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    policyBrochure: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    requirementDefinition: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    $transaction: vi.fn().mockImplementation((ops: any[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/auth/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "u1", realmRoles: [], clientRoles: [] },
  }),
  requireAdmin: vi.fn().mockResolvedValue({
    ok: true,
    user: { sub: "admin1", realmRoles: ["admin"], clientRoles: [] },
  }),
}));

vi.mock("@/lib/documents/mime", () => ({
  detectMimeType: vi.fn().mockReturnValue("application/pdf"),
}));

vi.mock("@/lib/security/rateLimiter", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, retryAfterSeconds: 0 }),
  rateLimitExceeded: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  default: { unlink: vi.fn().mockResolvedValue(undefined) },
}));

describe("REG-01 — filePath never leaks to external responses", () => {
  describe("data-access layer (listBrochures)", () => {
    it("select does not include filePath", async () => {
      const { listBrochures } = await import("@/lib/pdf/batchProcess");
      const result = await listBrochures(20, 0);

      expect(findManyArgs).not.toBeNull();
      expect(findManyArgs.select).toBeDefined();
      expect(findManyArgs.select.filePath).toBeFalsy();
    });

    it("returned objects do not contain filePath", async () => {
      const { listBrochures } = await import("@/lib/pdf/batchProcess");
      const result = await listBrochures(20, 0);

      expect(result.brochures).toHaveLength(1);
      expect(result.brochures[0]).not.toHaveProperty("filePath");
      expect(result.brochures[0].id).toBe("b1");
      expect(result.brochures[0].basename).toBe("policy-brochure");
    });
  });

  describe("data-access layer (getBrochureById)", () => {
    it("select does not include filePath", async () => {
      const { getBrochureById } = await import("@/lib/pdf/batchProcess");
      const result = await getBrochureById("b1");

      expect(findUniqueArgs).not.toBeNull();
      expect(findUniqueArgs.select).toBeDefined();
      expect(findUniqueArgs.select.filePath).toBeFalsy();
    });

    it("returned object does not contain filePath", async () => {
      const { getBrochureById } = await import("@/lib/pdf/batchProcess");
      const result = await getBrochureById("b1");

      expect(result).not.toHaveProperty("filePath");
      expect(result.id).toBe("b1");
    });
  });

  describe("API layer — GET /api/brochures (listing)", () => {
    it("response does not contain filePath", async () => {
      const { NextRequest } = await import("next/server");
      const { GET } = await import("@/app/api/brochures/route");
      const req = new NextRequest("http://localhost/api/brochures?limit=20&offset=0");
      const res = await GET(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.brochures).toBeDefined();
      expect(body.brochures.length).toBeGreaterThan(0);

      for (const b of body.brochures) {
        expect(b).not.toHaveProperty("filePath");
      }
    });
  });

  describe("API layer — GET /api/brochures/:id (individual)", () => {
    it("response does not contain filePath", async () => {
      const { NextRequest } = await import("next/server");
      const { GET } = await import("@/app/api/brochures/[id]/route");
      const req = new NextRequest("http://localhost/api/brochures/b1");
      const res = await GET(req, { params: Promise.resolve({ id: "b1" }) });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).not.toHaveProperty("filePath");
      expect(body.id).toBe("b1");
    });
  });
});

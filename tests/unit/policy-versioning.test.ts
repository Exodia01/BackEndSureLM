import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  policy: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  policyVersion: {
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  requirementSnapshot: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

const { publishPolicyVersion, listPolicyVersions } = await import(
  "@/lib/ai/services/policyVersioning"
);

const APPROVED = [
  {
    id: "r1",
    ruleKey: "min_age",
    label: "Min Age",
    description: "18",
    documentType: "BROCHURE",
    category: "eligibility",
    isMandatory: true,
    displayOrder: 0,
    onMaxAttemptsMessage: "Age could not be verified.",
    confidence: 0.9,
    extractionMode: "EXPLICIT",
    validationRules: { minEntryAge: 18 },
    sourceChunkIds: ["c1"],
  },
];

describe("policy versioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes a version with an immutable snapshot of approved requirements", async () => {
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [{ versionNum: 1 }],
      requirements: APPROVED,
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));
    dbMock.policyVersion.create.mockResolvedValue({ id: "v2", versionNum: 2 });
    dbMock.requirementSnapshot.create.mockResolvedValue({ id: "s2" });

    const { version, snapshot } = await publishPolicyVersion({
      policyId: "p1",
      publishedBy: "admin-1",
    });

    expect(dbMock.policyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ versionNum: 2, policyId: "p1" }),
      })
    );
    expect(dbMock.requirementSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ policyVersionId: "v2" }),
      })
    );
    expect(dbMock.policy.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: { currentVersionId: "v2" },
    });
    expect(version.versionNum).toBe(2);
    expect(snapshot.id).toBe("s2");
  });

  it("requests ONLY approved (isDraft=false) definitions from the DB", async () => {
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [],
      requirements: APPROVED, // what the isDraft=false query returns
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));
    dbMock.policyVersion.create.mockResolvedValue({ id: "v1", versionNum: 1 });
    dbMock.requirementSnapshot.create.mockResolvedValue({ id: "s1" });

    await publishPolicyVersion({ policyId: "p1" });

    // The approved-only guarantee is enforced in the Prisma query itself.
    expect(dbMock.policy.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          requirements: expect.objectContaining({
            where: { isDraft: false },
          }),
        }),
      })
    );
    const snapshotData = dbMock.requirementSnapshot.create.mock.calls[0][0].data;
    expect(snapshotData.requirements).toHaveLength(APPROVED.length);
    expect(snapshotData.requirements[0]).toMatchObject({
      ruleKey: "min_age",
      documentType: "BROCHURE",
      category: "eligibility",
      isMandatory: true,
      displayOrder: 0,
      onMaxAttemptsMessage: "Age could not be verified.",
    });
  });

  it("rejects publishing when there are no approved requirements", async () => {
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [],
      requirements: [],
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));

    await expect(publishPolicyVersion({ policyId: "p1" })).rejects.toThrow(
      "no approved requirements"
    );
    expect(dbMock.policyVersion.create).not.toHaveBeenCalled();
  });

  it("increments version numbers sequentially", async () => {
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [{ versionNum: 3 }],
      requirements: APPROVED,
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));
    dbMock.policyVersion.create.mockResolvedValue({ id: "v4", versionNum: 4 });
    dbMock.requirementSnapshot.create.mockResolvedValue({ id: "s4" });

    await publishPolicyVersion({ policyId: "p1" });
    expect(dbMock.policyVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ versionNum: 4 }) })
    );
  });

  it("throws when policy does not exist", async () => {
    dbMock.policy.findUnique.mockResolvedValue(null);
    await expect(publishPolicyVersion({ policyId: "missing" })).rejects.toThrow(
      "Policy not found"
    );
  });

  it("retries then throws a clean conflict error when the DB rejects a concurrent publish (P2002)", async () => {
    // Simulates a lost publish race: the unique constraints (versionNum, and
    // the partial single-current index) reject the write. The service must
    // re-read fresh state and retry, then surface a clean conflict error once
    // attempts are exhausted instead of leaking a raw Prisma error.
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [{ versionNum: 1 }],
      requirements: APPROVED,
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));
    dbMock.policyVersion.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    );

    await expect(publishPolicyVersion({ policyId: "p1" })).rejects.toThrow(
      "Concurrent version publish conflict: please retry"
    );
    // Must have retried with a fresh read each attempt (3 total).
    expect(dbMock.policy.findUnique).toHaveBeenCalledTimes(3);
  });

  it("succeeds on retry after a transient unique-constraint conflict", async () => {
    // First attempt loses the race (P2002), second attempt wins.
    dbMock.policy.findUnique.mockResolvedValue({
      id: "p1",
      versions: [{ versionNum: 1 }],
      requirements: APPROVED,
    });
    dbMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(dbMock));
    dbMock.policyVersion.create
      .mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      )
      .mockResolvedValueOnce({ id: "v2", versionNum: 2 });
    dbMock.requirementSnapshot.create.mockResolvedValue({ id: "s2" });

    const { version } = await publishPolicyVersion({ policyId: "p1", publishedBy: "admin-1" });
    expect(version.versionNum).toBe(2);
  });

  it("listPolicyVersions returns versions ordered newest-first with snapshots", async () => {
    dbMock.policyVersion.findMany.mockResolvedValue([
      { id: "v2", versionNum: 2, snapshot: { id: "s2" } },
      { id: "v1", versionNum: 1, snapshot: { id: "s1" } },
    ]);
    const result = await listPolicyVersions("p1");
    expect(dbMock.policyVersion.findMany).toHaveBeenCalledWith({
      where: { policyId: "p1" },
      orderBy: { versionNum: "desc" },
      include: { snapshot: true },
    });
    expect(result[0].versionNum).toBe(2);
  });
});

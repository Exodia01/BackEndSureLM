import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { publishPolicyVersion } from "@/lib/ai/services/policyVersioning";

/**
 * E1 — Concurrent version publishing regression test.
 *
 * Uses the REAL Postgres database (no mocks) to exercise the actual
 * database-level single-current-version guarantee:
 *   UNIQUE INDEX "PolicyVersion_policyId_current_key" ON "PolicyVersion"("policyId") WHERE "isCurrent"
 * plus the UNIQUE("policyId","versionNum") constraint and the service's
 * bounded P2002 retry handling.
 */
describe("concurrent policy-version publishing (real DB)", () => {
  const suffix = `e1_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let policyId: string;
  let brochureId: string;
  let requirementId: string;

  beforeAll(async () => {
    const policy = await db.policy.create({
      data: {
        name: `Concurrent Test Policy ${suffix}`,
        provider: "Test",
      },
    });
    policyId = policy.id;

    const brochure = await db.brochure.create({
      data: {
        basename: `concurrent_${suffix}`,
        originalName: `concurrent_${suffix}.pdf`,
        totalPages: 5,
        status: "READY",
      },
    });
    brochureId = brochure.id;

    await db.policyBrochure.create({
      data: { policyId, brochureId },
    });

    const req = await db.requirementDefinition.create({
      data: {
        policyId,
        brochureId,
        isDraft: false,
        ruleKey: "min_age",
        label: "Minimum Age",
        description: "18",
        confidence: 0.99,
        extractionMode: "EXPLICIT",
        sourceChunkIds: ["c1"],
      },
    });
    requirementId = req.id;
  });

  afterAll(async () => {
    // Cleanup: cascades remove PolicyVersion, RequirementSnapshot,
    // RequirementDefinition, and PolicyBrochure rows for this policy.
    if (policyId) {
      await db.policy.delete({ where: { id: policyId } }).catch(() => undefined);
    }
    if (brochureId) {
      await db.brochure.delete({ where: { id: brochureId } }).catch(() => undefined);
    }
  });

  it("leaves exactly ONE current version after concurrent publishes", async () => {
    const results = await Promise.allSettled([
      publishPolicyVersion({ policyId, label: "concurrent-a", publishedBy: "admin-a" }),
      publishPolicyVersion({ policyId, label: "concurrent-b", publishedBy: "admin-b" }),
      publishPolicyVersion({ policyId, label: "concurrent-c", publishedBy: "admin-c" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // The losing transactions must be handled cleanly: either they succeed on
    // retry, or they reject with the explicit concurrent-conflict error.
    for (const r of rejected) {
      const err = (r as PromiseRejectedResult).reason as Error;
      expect(err.message).toMatch(/Concurrent version publish conflict/);
    }

    // At least one publish must have succeeded.
    expect(fulfilled.length).toBeGreaterThan(0);

    // DB-level invariant: exactly one isCurrent=true row for this policy.
    const currentVersions = await db.policyVersion.findMany({
      where: { policyId, isCurrent: true },
    });
    expect(currentVersions).toHaveLength(1);

    // The policy's currentVersionId must point at that single current version.
    const policy = await db.policy.findUnique({
      where: { id: policyId },
      select: { currentVersionId: true },
    });
    expect(policy?.currentVersionId).toBe(currentVersions[0].id);

    // Every successful publish must have produced a distinct version number.
    const allVersions = await db.policyVersion.findMany({
      where: { policyId },
      orderBy: { versionNum: "asc" },
      select: { versionNum: true },
    });
    const nums = allVersions.map((v) => v.versionNum);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("preserves immutable snapshots for every published version", async () => {
    const versions = await db.policyVersion.findMany({
      where: { policyId },
      include: { snapshot: true },
    });
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(v.snapshot).not.toBeNull();
      // Snapshot must contain the approved requirement.
      const reqs = (v.snapshot?.requirements as { id?: string; ruleKey?: string }[]) ?? [];
      expect(reqs.some((r) => r.ruleKey === "min_age")).toBe(true);
    }
  });

  it("the approved requirement used for publishing still exists", async () => {
    const req = await db.requirementDefinition.findUnique({
      where: { id: requirementId },
    });
    expect(req).not.toBeNull();
    expect(req?.isDraft).toBe(false);
  });
});

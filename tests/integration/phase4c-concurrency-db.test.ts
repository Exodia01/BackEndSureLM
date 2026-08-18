import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { reviewDocument } from "@/app/api/documents/[id]/review/route";
import { approveApplication, ApplicationError } from "@/lib/applications/lifecycle";

/**
 * REAL-POSTGRES concurrency suite (environment-only).
 *
 * These tests exercise the actual CAS transactions against the local Postgres
 * that vitest connects to (see vitest.config.ts env.DATABASE_URL). They mock
 * NOTHING. If the database is unreachable the whole suite is skipped and the
 * guarantee is verified by the mocked suites instead (document-review /
 * issuance-flow). Run explicitly with the local Postgres up to prove the
 * lock-level races:
 *
 *   npx vitest run tests/integration/phase4c-concurrency-db.test.ts
 */

const REQUIREMENTS = [
  {
    id: "req-kyc-pan",
    ruleKey: "kyc_pan",
    label: "Valid PAN",
    description: "A valid PAN card on file",
    confidence: 0.99,
    extractionMode: "ocr",
    validationRules: null,
    sourceChunkIds: [],
  },
];

async function canConnect(): Promise<boolean> {
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("db probe timeout")), 5000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

const DB_AVAILABLE = await canConnect();

describe.skipIf(!DB_AVAILABLE)("phase 4C concurrency against real Postgres", () => {
  const suffix = `c${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  let user: { id: string };
  let lead: { id: string };
  let policy: { id: string };
  let version: { id: string };
  let app: { id: string };
  let docA: { id: string }; // VALIDATED PASS PAN (approve paths)
  let docR: { id: string }; // REVIEW_REQUIRED PAN (review paths)

  beforeAll(async () => {
    user = await db.user.create({
      data: { keycloakId: `kc-${suffix}`, email: `${suffix}@test.local`, name: "Concurrency Agent" },
      select: { id: true },
    });
    lead = await db.policyLead.create({
      data: { agentId: user.id, householdName: "Concurrency Household", phone: `+91${suffix}` },
      select: { id: true },
    });
    policy = await db.policy.create({ data: { name: `Concurrency Policy ${suffix}` }, select: { id: true } });
    version = await db.policyVersion.create({
      data: { policyId: policy.id, versionNum: 1, isCurrent: true },
      select: { id: true },
    });
    await db.policy.update({ where: { id: policy.id }, data: { currentVersionId: version.id } });
    await db.requirementSnapshot.create({
      data: {
        policyVersionId: version.id,
        policyId: policy.id,
        requirements: REQUIREMENTS as unknown as Prisma.InputJsonValue,
      },
    });
    app = await db.application.create({
      data: { leadId: lead.id, policyId: policy.id, policyVersionId: version.id, status: "SUBMITTED" },
      select: { id: true },
    });
    docA = await db.customerDocument.create({
      data: {
        applicationId: app.id,
        docType: "PAN",
        status: "VALIDATED",
        originalFilename: "pan-a.png",
        originalHash: `sha-a-${suffix}`,
        mimeType: "image/png",
        sizeBytes: 123,
        storageKey: `test/pan-a-${suffix}.png`,
        requirementRuleKey: "kyc_pan",
        uploadedById: user.id,
      },
      select: { id: true },
    });
    await db.documentValidationReport.create({
      data: {
        documentId: docA.id,
        status: "PASS",
        deterministicPass: true,
        ruleResults: {},
        discrepancies: {},
      },
    });
    docR = await db.customerDocument.create({
      data: {
        applicationId: app.id,
        docType: "PAN",
        status: "REVIEW_REQUIRED",
        originalFilename: "pan-r.png",
        originalHash: `sha-r-${suffix}`,
        mimeType: "image/png",
        sizeBytes: 124,
        storageKey: `test/pan-r-${suffix}.png`,
        requirementRuleKey: "kyc_pan",
        uploadedById: user.id,
      },
      select: { id: true },
    });
    await db.documentValidationReport.create({
      data: {
        documentId: docR.id,
        status: "REVIEW_REQUIRED",
        deterministicPass: null,
        ruleResults: {},
        discrepancies: {},
      },
    });
  });

  beforeEach(async () => {
    await db.application.update({ where: { id: app.id }, data: { status: "SUBMITTED" } });
    await db.customerDocument.update({ where: { id: docA.id }, data: { status: "VALIDATED" } });
    await db.documentValidationReport.update({
      where: { documentId: docA.id },
      data: { status: "PASS", reviewedById: null, reviewedAt: null, reviewNotes: null },
    });
    await db.customerDocument.update({ where: { id: docR.id }, data: { status: "REVIEW_REQUIRED" } });
    await db.documentValidationReport.update({
      where: { documentId: docR.id },
      data: { status: "REVIEW_REQUIRED", reviewedById: null, reviewedAt: null, reviewNotes: null },
    });
  });

  afterAll(async () => {
    await db.auditEvent.deleteMany({ where: { actorId: user.id } });
    await db.documentValidationReport.deleteMany({
      where: { documentId: { in: [docA.id, docR.id] } },
    });
    await db.customerDocument.deleteMany({ where: { applicationId: app.id } });
    await db.policyLead.delete({ where: { id: lead.id } }).catch(() => {});
    await db.policy.delete({ where: { id: policy.id } }).catch(() => {});
    await db.user.delete({ where: { id: user.id } }).catch(() => {});
  });

  it("two concurrent reviews of the same REVIEW_REQUIRED document: exactly one wins", async () => {
    const results = await Promise.allSettled([
      reviewDocument({ userId: user.id, documentId: docR.id, verdict: "approve" }),
      reviewDocument({ userId: user.id, documentId: docR.id, verdict: "approve" }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((fulfilled[0] as PromiseFulfilledResult<string>).value).toBe("VALIDATED");
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/already decided/);

    const doc = await db.customerDocument.findUnique({ where: { id: docR.id } });
    const report = await db.documentValidationReport.findUnique({ where: { documentId: docR.id } });
    expect(doc?.status).toBe("VALIDATED");
    expect(report?.status).toBe("PASS");
  });

  it("approve cannot race a concurrent review: doc flipped to REJECTED mid-flight → 409, application stays SUBMITTED", async () => {
    // Hold the document row lock so approveApplication blocks inside its
    // transaction after the pre-read, then flip the verdict before releasing.
    let lockedResolve: () => void;
    const locked = new Promise<void>((r) => { lockedResolve = r; });
    let release: () => void;
    const gate = new Promise<void>((r) => { release = r; });

    const holding = db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "CustomerDocument" WHERE "id" = ${docA.id} FOR UPDATE`);
      lockedResolve!();
      await gate;
      await tx.customerDocument.update({ where: { id: docA.id }, data: { status: "REJECTED" } });
      await tx.documentValidationReport.update({ where: { documentId: docA.id }, data: { status: "FAIL" } });
    });

    await locked;

    const approvePromise = approveApplication({ applicationId: app.id, agentId: user.id })
      .then((v) => ({ ok: true as const, value: v }))
      .catch((e) => ({ ok: false as const, error: e as Error }));

    release!();
    await holding;

    const approveRes = await approvePromise;
    if (approveRes.ok) {
      throw new Error("approve should have been blocked by the concurrent review");
    }
    expect((approveRes.error as ApplicationError).statusCode).toBe(409);

    const appNow = await db.application.findUnique({ where: { id: app.id }, select: { status: true } });
    expect(appNow?.status).toBe("SUBMITTED");
  });

  it("two concurrent approvals of the same application: exactly one performs the transition", async () => {
    // Clear the review state so the checklist is fully satisfiable, otherwise
    // any REVIEW_REQUIRED document correctly blocks both approvals (409).
    const reviewStatus = await reviewDocument({ userId: user.id, documentId: docR.id, verdict: "approve" });
    expect(reviewStatus).toBe("VALIDATED");

    const results = await Promise.allSettled([
      approveApplication({ applicationId: app.id, agentId: user.id }),
      approveApplication({ applicationId: app.id, agentId: user.id }),
    ]);

    const winners = results.filter(
      (r) => r.status === "fulfilled" && (r.value as { alreadyApproved: boolean }).alreadyApproved === false
    );
    expect(winners).toHaveLength(1);

    const appNow = await db.application.findUnique({ where: { id: app.id }, select: { status: true } });
    expect(appNow?.status).toBe("APPROVED");
  });

  it("review then approve end-to-end on the real database", async () => {
    const status = await reviewDocument({ userId: user.id, documentId: docR.id, verdict: "approve" });
    expect(status).toBe("VALIDATED");

    const result = await approveApplication({ applicationId: app.id, agentId: user.id });
    expect(result.alreadyApproved).toBe(false);
    expect(result.application.status).toBe("APPROVED");

    const appNow = await db.application.findUnique({ where: { id: app.id }, select: { status: true } });
    expect(appNow?.status).toBe("APPROVED");
  });
});

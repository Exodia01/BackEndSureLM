/**
 * Application lifecycle (Phase 4C).
 *
 * Server-side, deterministic status transitions, all of which are audited:
 *
 *   DRAFT → SUBMITTED                     (submit; sets submittedAt)
 *   SUBMITTED/UNDERWRITING/DOCUMENTS_REQUIRED → APPROVED  (approve; gated by
 *     the frozen-snapshot checklist — REVIEW_REQUIRED / failed documents /
 *     unsatisfied requirements block it)
 *   SUBMITTED/UNDERWRITING/DOCUMENTS_REQUIRED → REJECTED  (agent decision)
 *   APPROVED → ISSUED                     (performed by the issuance service)
 *
 * The status machine is enforced here, not in route handlers. The LLM
 * recommendation engine is never consulted for suitability — eligibility is
 * deterministic and evidence-based, evaluated against the application's frozen
 * RequirementSnapshot.
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAuditEvent } from "@/lib/audit";
import {
  evaluateChecklist,
  type ChecklistEvaluation,
  type EvidenceDocumentView,
  type FrozenRequirement,
} from "@/lib/applications/checklist";

export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 409,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export class ApplicationOwnershipError extends ApplicationError {
  constructor() {
    super("Forbidden", 403);
    this.name = "ApplicationOwnershipError";
  }
}

const SUBMITTABLE_STATES = ["SUBMITTED", "UNDERWRITING", "DOCUMENTS_REQUIRED"] as const;
type DecisionState = (typeof SUBMITTABLE_STATES)[number];

export interface ApplicationWithEvidence {
  id: string;
  leadId: string;
  policyId: string;
  policyVersionId: string;
  status: string;
  submittedAt: Date | null;
  lead: { agentId: string };
  policy: { name: string; provider: string | null; isActive: boolean };
  policyVersion: {
    id: string;
    versionNum: number;
    snapshot: { requirements: unknown } | null;
  };
  documents: Array<{
    id: string;
    docType: string;
    status: string;
    requirementRuleKey: string | null;
    validationReport: { status: string; deterministicPass: boolean | null } | null;
  }>;
}

async function loadOwnedApplication(
  agentId: string,
  applicationId: string,
  client: Prisma.TransactionClient | typeof db = db
): Promise<ApplicationWithEvidence> {
  const application = await client.application.findFirst({
    where: { id: applicationId },
    select: {
      id: true,
      leadId: true,
      policyId: true,
      policyVersionId: true,
      status: true,
      submittedAt: true,
      lead: { select: { agentId: true } },
      policy: { select: { name: true, provider: true, isActive: true } },
      policyVersion: {
        select: { id: true, versionNum: true, snapshot: { select: { requirements: true } } },
      },
      documents: {
        select: {
          id: true,
          docType: true,
          status: true,
          requirementRuleKey: true,
          validationReport: { select: { status: true, deterministicPass: true } },
        },
      },
    },
  });
  if (!application) {
    throw new ApplicationError("Application not found", 404);
  }
  if (application.lead.agentId !== agentId) {
    throw new ApplicationOwnershipError();
  }
  return application as unknown as ApplicationWithEvidence;
}

/** Build the deterministic checklist for a loaded application (frozen snapshot). */
export function getChecklistEvaluation(application: ApplicationWithEvidence): ChecklistEvaluation {
  const snapshot = application.policyVersion.snapshot;
  const requirements: FrozenRequirement[] = Array.isArray(snapshot?.requirements)
    ? (snapshot.requirements as FrozenRequirement[])
    : [];
  const documents: EvidenceDocumentView[] = application.documents.map((d) => ({
    id: d.id,
    docType: d.docType,
    status: d.status,
    requirementRuleKey: d.requirementRuleKey,
    validationStatus: d.validationReport?.status ?? null,
    deterministicPass: d.validationReport?.deterministicPass ?? null,
  }));
  return evaluateChecklist(requirements, documents);
}

export interface ApplicationChecklistView {
  application: { id: string; status: string };
  evaluation: ChecklistEvaluation;
  documents: Array<{
    id: string;
    docType: string;
    status: string;
    requirementRuleKey: string | null;
  }>;
}

/**
 * Read-only view of the frozen-snapshot checklist for a lead's owned
 * application, used by the checklist UI. Derived only — nothing is persisted
 * and the current/latest policy requirements are never consulted: the
 * application's RequirementSnapshot is authoritative. Document entries carry
 * no PII (no ocrData/extractedData/originalFilename are ever selected).
 */
export async function getApplicationChecklist(
  agentId: string,
  applicationId: string
): Promise<ApplicationChecklistView> {
  const application = await loadOwnedApplication(agentId, applicationId);
  return {
    application: { id: application.id, status: application.status },
    evaluation: getChecklistEvaluation(application),
    documents: application.documents.map((d) => ({
      id: d.id,
      docType: d.docType,
      status: d.status,
      requirementRuleKey: d.requirementRuleKey,
    })),
  };
}

export interface CreateApplicationInput {
  agentId: string;
  leadId: string;
  policyName?: string;
  policyId?: string;
}

/**
 * Create a DRAFT application, resolving ONLY an existing, active policy with a
 * current published version and a requirement snapshot. Policy catalog records
 * are NEVER manufactured from customer/chat input (P1).
 */
export async function createApplication(
  input: CreateApplicationInput
): Promise<{ id: string; leadId: string; policyId: string; policyVersionId: string; status: string; policyName: string }> {
  const { agentId, leadId, policyName, policyId } = input;
  if (!policyName && !policyId) {
    throw new ApplicationError("policyId or policyName is required", 400);
  }

  const lead = await db.policyLead.findFirst({ where: { id: leadId, agentId } });
  if (!lead) {
    throw new ApplicationError("Lead not found", 404);
  }

  const policy = policyId
    ? await db.policy.findUnique({ where: { id: policyId } })
    : await db.policy.findFirst({ where: { name: policyName } });

  if (!policy) {
    throw new ApplicationError("Policy not found. Applications require an existing, published policy.", 404);
  }
  if (!policy.isActive) {
    throw new ApplicationError(`Policy "${policy.name}" is not active and cannot be applied for`, 409);
  }

  const version = policy.currentVersionId
    ? await db.policyVersion.findUnique({ where: { id: policy.currentVersionId } })
    : null;
  if (!version) {
    throw new ApplicationError(`Policy "${policy.name}" has no current published version`, 409);
  }

  const snapshot = await db.requirementSnapshot.findUnique({ where: { policyVersionId: version.id } });
  if (!snapshot) {
    throw new ApplicationError(`Policy "${policy.name}" version v${version.versionNum} has no requirement snapshot`, 409);
  }

  // Reuse the single active application for (lead, policy, version), if any
  // (enforced by the partial unique index on non-terminal applications).
  const existing = await db.application.findFirst({
    where: {
      leadId,
      policyId: policy.id,
      policyVersionId: version.id,
      status: { notIn: ["ISSUED", "REJECTED", "WITHDRAWN"] },
    },
  });
  if (existing) {
    return {
      id: existing.id,
      leadId,
      policyId: policy.id,
      policyVersionId: version.id,
      status: existing.status,
      policyName: policy.name,
    };
  }

  try {
    const application = await db.application.create({
      data: { leadId, policyId: policy.id, policyVersionId: version.id, status: "DRAFT" },
    });

    return {
      id: application.id,
      leadId,
      policyId: policy.id,
      policyVersionId: version.id,
      status: application.status,
      policyName: policy.name,
    };
  } catch (error) {
    // Two concurrent requests can both pass the reuse check above; the partial
    // unique index rejects the second create. Fall back to the winning active
    // application instead of surfacing a 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const winner = await db.application.findFirst({
        where: {
          leadId,
          policyId: policy.id,
          policyVersionId: version.id,
          status: { notIn: ["ISSUED", "REJECTED", "WITHDRAWN"] },
        },
      });
      if (winner) {
        return {
          id: winner.id,
          leadId,
          policyId: policy.id,
          policyVersionId: version.id,
          status: winner.status,
          policyName: policy.name,
        };
      }
    }
    throw error;
  }
}

/** DRAFT → SUBMITTED. Idempotent when already submitted. */
export async function submitApplication(input: { applicationId: string; agentId: string }) {
  const { applicationId, agentId } = input;
  const application = await loadOwnedApplication(agentId, applicationId);

  if (application.status === "SUBMITTED" || application.status === "UNDERWRITING" || application.status === "DOCUMENTS_REQUIRED") {
    return { application: { id: application.id, status: application.status }, submitted: false };
  }
  if (application.status !== "DRAFT") {
    throw new ApplicationError(`Application cannot be submitted from state ${application.status}`, 409);
  }

  const updated = await db.application.updateMany({
    where: { id: application.id, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  if (updated.count === 0) {
    throw new ApplicationError("Application state changed concurrently; retry", 409);
  }

  await writeAuditEvent({
    actorId: agentId,
    actorRole: "agent",
    action: "application.submitted",
    entityType: "Application",
    entityId: application.id,
    metadata: { policyId: application.policyId, policyVersionId: application.policyVersionId },
  });

  return { application: { id: application.id, status: "SUBMITTED" }, submitted: true };
}

/**
 * Deterministic approval gate. Runs the frozen-snapshot checklist; if every
 * requirement is satisfied and nothing is blocked, transitions to APPROVED.
 * REVIEW_REQUIRED documents and unsatisfied requirements block automatic
 * approval.
 */
export async function approveApplication(input: { applicationId: string; agentId: string }) {
  const { applicationId, agentId } = input;
  const application = await loadOwnedApplication(agentId, applicationId);

  if (application.status === "APPROVED") {
    return { application: { id: application.id, status: "APPROVED" }, evaluation: getChecklistEvaluation(application), alreadyApproved: true };
  }
  if (application.status === "ISSUED") {
    throw new ApplicationError("Application is already issued", 409);
  }
  if (!SUBMITTABLE_STATES.includes(application.status as DecisionState)) {
    throw new ApplicationError(`Application cannot be approved from state ${application.status}; submit it first`, 409);
  }

  const evaluation = getChecklistEvaluation(application);
  if (!evaluation.canApprove) {
    await writeAuditEvent({
      actorId: agentId,
      actorRole: "agent",
      action: "application.approval_blocked",
      entityType: "Application",
      entityId: application.id,
      metadata: { blockers: evaluation.blockers.slice(0, 20) },
    });
    throw new ApplicationError(
      `Application cannot be approved: ${evaluation.blockers.join("; ") || "checklist not satisfied"}`,
      409,
      { blockers: evaluation.blockers, checklist: evaluation.requirements }
    );
  }

  // Transition inside a transaction so the decision cannot race a concurrent
  // document review or approval: lock the application's document rows, re-read
  // the application + evidence inside the transaction, and re-run the frozen
  // checklist. A concurrent review that changed a document's verdict (or a
  // concurrent approval) is therefore visible to this transaction.
  const result = await db.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "CustomerDocument" WHERE "applicationId" = ${applicationId} FOR UPDATE`
    );

    const fresh = await loadOwnedApplication(agentId, applicationId, tx);
    const freshEvaluation = getChecklistEvaluation(fresh);
    if (!freshEvaluation.canApprove) {
      await writeAuditEvent({
        actorId: agentId,
        actorRole: "agent",
        action: "application.approval_blocked",
        entityType: "Application",
        entityId: fresh.id,
        metadata: { blockers: freshEvaluation.blockers.slice(0, 20) },
      });
      throw new ApplicationError(
        `Application cannot be approved: ${freshEvaluation.blockers.join("; ") || "checklist not satisfied"}`,
        409,
        { blockers: freshEvaluation.blockers, checklist: freshEvaluation.requirements }
      );
    }

    const updated = await tx.application.updateMany({
      where: { id: fresh.id, status: { in: [...SUBMITTABLE_STATES] } },
      data: { status: "APPROVED" },
    });
    return { count: updated.count, evaluation: freshEvaluation };
  });

  if (result.count === 0) {
    throw new ApplicationError("Application state changed concurrently; retry", 409);
  }

  await writeAuditEvent({
    actorId: agentId,
    actorRole: "agent",
    action: "application.approved",
    entityType: "Application",
    entityId: application.id,
    metadata: {
      policyId: application.policyId,
      policyVersionId: application.policyVersionId,
      requirementsSatisfied: result.evaluation.requirements.filter((r) => r.satisfied).length,
      requirementsTotal: result.evaluation.requirements.length,
    },
  });

  return { application: { id: application.id, status: "APPROVED" }, evaluation: result.evaluation, alreadyApproved: false };
}

/** Explicit suitability rejection. */
export async function rejectApplication(input: { applicationId: string; agentId: string; reason?: string }) {
  const { applicationId, agentId, reason } = input;
  const application = await loadOwnedApplication(agentId, applicationId);

  if (application.status === "REJECTED") {
    return { application: { id: application.id, status: "REJECTED" }, rejected: false };
  }
  if (application.status === "ISSUED") {
    throw new ApplicationError("Application is already issued", 409);
  }
  if (!SUBMITTABLE_STATES.includes(application.status as DecisionState)) {
    throw new ApplicationError(`Application cannot be rejected from state ${application.status}`, 409);
  }

  const updated = await db.application.updateMany({
    where: { id: application.id, status: { in: [...SUBMITTABLE_STATES] } },
    data: { status: "REJECTED" },
  });
  if (updated.count === 0) {
    throw new ApplicationError("Application state changed concurrently; retry", 409);
  }

  await writeAuditEvent({
    actorId: agentId,
    actorRole: "agent",
    action: "application.rejected",
    entityType: "Application",
    entityId: application.id,
    metadata: { reason: reason ?? null },
  });

  return { application: { id: application.id, status: "REJECTED" }, rejected: true };
}

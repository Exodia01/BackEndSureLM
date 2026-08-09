/**
 * Policy issuance gating (Phase 4C / P0).
 *
 * Issuance is impossible unless ALL of the following hold deterministically:
 *  - the application exists and belongs to the authenticated agent
 *  - the application is APPROVED
 *  - the policy is still active (existing business rule)
 *  - the frozen-snapshot checklist passes AGAIN at issuance time (all
 *    requirements satisfied, no REVIEW_REQUIRED, no failed documents)
 *  - the frozen policy/version referenced by the application is used
 *
 * The LLM recommendation engine is never consulted here: eligibility is
 * deterministic and evidence-based. Idempotency is preserved by the DB
 * unique constraint (leadId, policyName) and surfaced as a 409.
 */
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { writeAuditEvent } from "@/lib/audit";
import { getChecklistEvaluation, type ApplicationWithEvidence } from "@/lib/applications/lifecycle";

export class IssuanceGateError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 409,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "IssuanceGateError";
  }
}

export interface IssuePolicyInput {
  applicationId: string;
  /** Resolved DB user id of the authenticated agent. */
  agentId: string;
  /** Keycloak subject, recorded for provenance on PolicyIssuance.issuedBy. */
  agentSub: string;
  premiumAmount?: number | null;
  /** When supplied, must equal the application's leadId. */
  expectedLeadId?: string;
}

async function loadApplicationForIssuance(applicationId: string): Promise<ApplicationWithEvidence | null> {
  return (await db.application.findFirst({
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
  })) as unknown as ApplicationWithEvidence | null;
}

export async function issuePolicy(input: IssuePolicyInput) {
  const { applicationId, agentId, agentSub, premiumAmount, expectedLeadId } = input;

  const application = await loadApplicationForIssuance(applicationId);
  if (!application) {
    throw new IssuanceGateError("Application not found", 404);
  }
  if (application.lead.agentId !== agentId) {
    throw new IssuanceGateError("Forbidden", 403);
  }
  if (expectedLeadId && application.leadId !== expectedLeadId) {
    throw new IssuanceGateError("leadId does not match the application", 400);
  }
  if (application.status !== "APPROVED") {
    throw new IssuanceGateError(
      `Application is not approved (${application.status}); submit and approve it before issuance`,
      409
    );
  }

  const snapshot = application.policyVersion.snapshot;
  if (!snapshot) {
    throw new IssuanceGateError("Application's frozen policy version has no requirement snapshot");
  }
  if (!application.policy.isActive) {
    throw new IssuanceGateError(`Policy "${application.policy.name}" is no longer active and cannot be issued`);
  }

  // Deterministic, evidence-based re-check at issuance time (defense in depth).
  const evaluation = getChecklistEvaluation(application);
  if (!evaluation.canApprove) {
    throw new IssuanceGateError(
      `Issuance blocked: ${evaluation.blockers.join("; ") || "checklist not satisfied"}`,
      409,
      { blockers: evaluation.blockers }
    );
  }

  const policyName = application.policy.name;
  const policyProvider = application.policy.provider ?? null;
  const nextPremiumDue = new Date();
  nextPremiumDue.setDate(nextPremiumDue.getDate() + 30);

  try {
    const result = await db.$transaction(async (tx) => {
      const issuance = await tx.policyIssuance.create({
        data: {
          leadId: application.leadId,
          policyName,
          policyProvider,
          premiumAmount: premiumAmount ?? null,
          nextPremiumDue,
          status: "ACTIVE",
          issuedBy: agentSub,
          applicationId: application.id,
          policyId: application.policyId,
          policyVersionId: application.policyVersionId,
        },
      });

      await tx.policyLead.update({
        where: { id: application.leadId },
        data: { status: "POLICY_ISSUED" },
      });

      const updatedApplication = await tx.application.update({
        where: { id: application.id },
        data: { status: "ISSUED" },
      });

      return { issuance, application: updatedApplication };
    });

    await writeAuditEvent({
      actorId: agentId,
      actorRole: "agent",
      action: "issuance.created",
      entityType: "Application",
      entityId: application.id,
      metadata: {
        issuanceId: result.issuance.id,
        policyName,
        policyId: application.policyId,
        policyVersionId: application.policyVersionId,
        premiumAmount: premiumAmount ?? null,
      },
    });

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.policyIssuance.findFirst({
        where: { leadId: application.leadId, policyName },
      });
      throw new IssuanceGateError("Policy already issued for this lead", 409, existing);
    }
    throw error;
  }
}

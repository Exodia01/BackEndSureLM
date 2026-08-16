import { db } from "@/lib/db";
import type { RequirementDefinition } from "@prisma/client";

export interface PublishVersionInput {
  policyId: string;
  label?: string;
  publishedBy?: string;
}

/**
 * Create a new PolicyVersion and an immutable RequirementSnapshot copy of all
 * currently-approved requirement definitions for the policy.
 *
 * Business rules enforced here:
 * - Rejects duplicate version numbers.
 * - Rejects publishing when there are no approved requirements.
 * - Copies ONLY isDraft=false definitions into the snapshot.
 * - Atomic: version + snapshot are created in a single transaction.
 *
 * RequirementSnapshot is treated as immutable by construction: no service in
 * this codebase ever updates or deletes one (CREATE only, inside the publish
 * transaction).
 */
export async function publishPolicyVersion(
  input: PublishVersionInput
): Promise<{ version: any; snapshot: any }> {
  const { policyId, label, publishedBy } = input;

  // Bounded retry: concurrent publishes race on versionNum allocation and on
  // the single-current-version guarantee. On a unique-constraint conflict
  // (P2002 — either UNIQUE("policyId","versionNum") or the partial
  // UNIQUE(policy_id) WHERE is_current) we re-read fresh state and retry,
  // so the losing transaction is resolved cleanly instead of corrupting the
  // version history or leaving two current versions.
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const policy = await db.policy.findUnique({
      where: { id: policyId },
      include: {
        versions: {
          orderBy: { versionNum: "desc" },
          take: 1,
        },
        requirements: {
          where: { isDraft: false },
          orderBy: { ruleKey: "asc" },
        },
      },
    });

    if (!policy) {
      throw new Error("Policy not found");
    }

    if (policy.requirements.length === 0) {
      throw new Error(
        "Cannot publish a version: policy has no approved requirements (isDraft=false)"
      );
    }

    const nextVersionNum = (policy.versions[0]?.versionNum ?? 0) + 1;

    try {
      const { version, snapshot } = await db.$transaction(async (tx) => {
        const createdVersion = await tx.policyVersion.create({
          data: {
            policyId,
            versionNum: nextVersionNum,
            label: label ?? `v${nextVersionNum}`,
            publishedBy,
          },
        });

        const createdSnapshot = await tx.requirementSnapshot.create({
          data: {
            policyVersionId: createdVersion.id,
            policyId,
            createdBy: publishedBy,
            requirements: policy.requirements.map((r: RequirementDefinition) => ({
              id: r.id,
              ruleKey: r.ruleKey,
              label: r.label,
              description: r.description,
              documentType: r.documentType ?? null,
              category: r.category ?? null,
              isMandatory: r.isMandatory ?? null,
              displayOrder: r.displayOrder ?? null,
              onMaxAttemptsMessage: r.onMaxAttemptsMessage ?? null,
              confidence: r.confidence,
              extractionMode: r.extractionMode,
              validationRules: r.validationRules,
              sourceChunkIds: r.sourceChunkIds,
            })),
          },
        });

        // Mark the new version as current; demote any previously-current version.
        // The partial unique index UNIQUE(policy_id) WHERE is_current enforces
        // that only ONE version per policy can ever be current.
        await tx.policyVersion.updateMany({
          where: { policyId, id: { not: createdVersion.id } },
          data: { isCurrent: false },
        });

        await tx.policyVersion.update({
          where: { id: createdVersion.id },
          data: { isCurrent: true },
        });

        await tx.policy.update({
          where: { id: policyId },
          data: { currentVersionId: createdVersion.id },
        });

        return { version: createdVersion, snapshot: createdSnapshot };
      });

      return { version, snapshot };
    } catch (error) {
      const isUniqueViolation =
        (error as { code?: string })?.code === "P2002";

      if (isUniqueViolation && attempt < MAX_ATTEMPTS - 1) {
        // A concurrent publish won the race; re-read and retry with the new
        // latest version number / current-version state.
        continue;
      }

      if (isUniqueViolation) {
        throw new Error(
          "Concurrent version publish conflict: please retry. The database " +
            "guarantees only one current version per policy."
        );
      }

      throw error;
    }
  }

  throw new Error("Failed to publish policy version after multiple attempts");
}

/**
 * List all published versions for a policy with their snapshots, augmented
 * with current-status and publish provenance.
 */
export async function listPolicyVersions(policyId: string) {
  const [versions, policy] = await Promise.all([
    db.policyVersion.findMany({
      where: { policyId },
      orderBy: { versionNum: "desc" },
      include: { snapshot: true },
    }),
    db.policy.findUnique({
      where: { id: policyId },
      select: { currentVersionId: true },
    }),
  ]);

  return versions.map((v) => ({
    ...v,
    isCurrent: v.id === policy?.currentVersionId,
  }));
}

/**
 * Immutability guard: this service has no update/delete functions for
 * RequirementSnapshot by design. Add them here only if the business rules change.
 */
export const SNAPSHOT_IMMUTABLE = true as const;

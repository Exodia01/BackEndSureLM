import { NextRequest } from "next/server";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { requireAgent } from "@/lib/auth/guards";
import { ensureUserInDb } from "@/lib/auth/keycloak";
import { checkRateLimit, rateLimitExceeded } from "@/lib/security/rateLimiter";
import { getDocumentStorage, ALLOWED_MIME_TYPES } from "@/lib/documents/storage";
import { detectMimeType } from "@/lib/documents/mime";
import { enqueueDocumentJob } from "@/lib/documents/jobs";
import { resolveApplicationForAgent, ownershipErrorResponse } from "@/lib/documents/ownership";
import { writeAuditEvent } from "@/lib/audit";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * POST /api/documents
 * multipart/form-data: { applicationId, file, expectedDocType? }
 * - Requires an authenticated agent.
 * - The application must be owned by that agent (IDOR chain).
 * - Content-type is verified against magic bytes, never the client header.
 * - Content-addressed storage; duplicates within an application are rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "documents:upload");
    if (!rateLimit.allowed) {
      return rateLimitExceeded("documents:upload", rateLimit.retryAfterSeconds);
    }

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const formData = await req.formData();
    const applicationId = formData.get("applicationId");
    const expectedDocType = formData.get("expectedDocType");
    const file = formData.get("file");

    if (typeof applicationId !== "string" || !applicationId) {
      return Response.json({ success: false, error: "applicationId is required" }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return Response.json({ success: false, error: "file is required" }, { status: 400 });
    }

    const ownership = await resolveApplicationForAgent(userInDb.id, applicationId);
    if (!ownership.ok) return ownershipErrorResponse(ownership);

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json({ success: false, error: "File exceeds 10MB limit" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectMimeType(buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime)) {
      return Response.json({ success: false, error: "Unsupported file type" }, { status: 415 });
    }

    // Reject polyglots: the client-declared type must match the magic bytes.
    const declared = file.type || detectedMime;
    if (declared !== detectedMime) {
      return Response.json({ success: false, error: "File content does not match its declared type" }, { status: 415 });
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Dedup within the application: same hash → 409 duplicate.
    const existing = await db.customerDocument.findUnique({
      where: { applicationId_originalHash: { applicationId, originalHash: sha256 } },
    });
    if (existing) {
      await writeAuditEvent({
        actorId: userInDb.id,
        actorRole: "agent",
        action: "document.duplicate",
        entityType: "CustomerDocument",
        entityId: existing.id,
        metadata: { applicationId },
      });
      return Response.json({ success: false, error: "Duplicate document", data: { id: existing.id } }, { status: 409 });
    }

    const storage = getDocumentStorage();
    const storageKey = await storage.put(buffer, detectedMime);

    const docType =
      expectedDocType && /^[A-Z_]+$/.test(String(expectedDocType))
        ? (String(expectedDocType) as "AADHAAR" | "PAN" | "BANK_STATEMENT" | "INCOME_PROOF" | "ADDRESS_PROOF" | "IDENTITY_PROOF" | "POLICY_DOCUMENT" | "OTHER")
        : "OTHER";

    const document = await db.customerDocument.create({
      data: {
        applicationId,
        docType,
        status: "UPLOADED",
        originalFilename: file.name.slice(0, 255),
        originalHash: sha256,
        mimeType: detectedMime,
        sizeBytes: buffer.length,
        storageKey,
        pageCount: detectedMime === "application/pdf" ? null : 1,
        uploadedById: userInDb.id,
        attempts: 0,
      },
    });

    await enqueueDocumentJob(document.id);

    await writeAuditEvent({
      actorId: userInDb.id,
      actorRole: "agent",
      action: "document.uploaded",
      entityType: "CustomerDocument",
      entityId: document.id,
      metadata: {
        applicationId,
        mimeType: detectedMime,
        sizeBytes: buffer.length,
        docType,
      },
    });

    return Response.json(
      {
        success: true,
        data: {
          id: document.id,
          status: document.status,
          docType: document.docType,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          applicationId: document.applicationId,
          createdAt: document.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload document error:", error);
    return Response.json({ success: false, error: "Failed to upload document" }, { status: 500 });
  }
}

/**
 * GET /api/documents
 * Lists documents owned by the authenticated agent (via application → lead →
 * agentId). Optional filters: applicationId, status, docType, limit, cursor.
 * PII is never returned — only lifecycle metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAgent(req);
    if (!auth.ok) {
      const body = await auth.response.json().catch(() => ({ error: "Unauthorized" }));
      return Response.json({ success: false, error: body.error }, { status: auth.response.status });
    }
    const user = auth.user;

    const rateLimit = checkRateLimit(user.sub, "documents:list");
    if (!rateLimit.allowed) return rateLimitExceeded("documents:list", rateLimit.retryAfterSeconds);

    const userInDb = await ensureUserInDb({
      sub: user.sub,
      email: user.email,
      name: user.name,
      realm_access: { roles: user.realmRoles },
      resource_access: { "web-app": { roles: user.clientRoles } },
    });

    const { searchParams } = req.nextUrl;
    const applicationId = searchParams.get("applicationId");
    const status = searchParams.get("status");
    const docType = searchParams.get("docType");
    const limitRaw = searchParams.get("limit");
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 200);

    const where = {
      application: {
        lead: { agentId: userInDb.id },
        ...(applicationId ? { id: applicationId } : {}),
      },
      ...(status && /^[A-Z_]+$/.test(status) ? { status: status as never } : {}),
      ...(docType && /^[A-Z_]+$/.test(docType) ? { docType: docType as never } : {}),
    };

    const documents = await db.customerDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        applicationId: true,
        docType: true,
        status: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        pageCount: true,
        attempts: true,
        requirementRuleKey: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return Response.json({ success: true, data: documents });
  } catch (error) {
    console.error("List documents error:", error);
    return Response.json({ success: false, error: "Failed to list documents" }, { status: 500 });
  }
}

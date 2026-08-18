import { describe, it, expect, vi, beforeEach } from "vitest";

const dbMock = {
  auditEvent: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ db: dbMock }));

vi.mock("@/lib/documents/pii", () => ({
  maskDocumentPII: (m: unknown) => m,
}));

const { writeAuditEvent, getFailedAuditCount } = await import("@/lib/audit");

describe("writeAuditEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records an audit event to the database", async () => {
    dbMock.auditEvent.create.mockResolvedValue({});

    await writeAuditEvent({
      actorId: "user-1",
      action: "document.uploaded",
      entityType: "CustomerDocument",
      entityId: "doc-1",
    });

    expect(dbMock.auditEvent.create).toHaveBeenCalledTimes(1);
    const call = dbMock.auditEvent.create.mock.calls[0][0];
    expect(call.data.action).toBe("document.uploaded");
    expect(call.data.entityId).toBe("doc-1");
  });

  it("does not throw when the database write fails", async () => {
    dbMock.auditEvent.create.mockRejectedValue(new Error("DB connection lost"));

    await expect(
      writeAuditEvent({
        actorId: "user-1",
        action: "document.uploaded",
        entityType: "CustomerDocument",
        entityId: "doc-1",
      })
    ).resolves.toBeUndefined();
  });

  it("increments failedAuditCount on DB failure", async () => {
    const before = getFailedAuditCount();
    dbMock.auditEvent.create.mockRejectedValue(new Error("DB down"));

    await writeAuditEvent({
      actorId: "user-1",
      action: "document.uploaded",
      entityType: "CustomerDocument",
      entityId: "doc-1",
    });

    expect(getFailedAuditCount()).toBe(before + 1);
  });

  it("logs structured JSON on failure", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    dbMock.auditEvent.create.mockRejectedValue(new Error("timeout"));

    await writeAuditEvent({
      actorId: "user-1",
      action: "application.submitted",
      entityType: "Application",
      entityId: "app-1",
      metadata: { foo: "bar" },
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse(spy.mock.calls[0][0]);
    expect(logged.event).toBe("audit_write_failed");
    expect(logged.action).toBe("application.submitted");
    expect(logged.entityType).toBe("Application");
    expect(logged.entityId).toBe("app-1");
    expect(logged.actorId).toBe("user-1");
    expect(typeof logged.failureCount).toBe("number");
    expect(logged.error).toBe("timeout");
    spy.mockRestore();
  });
});

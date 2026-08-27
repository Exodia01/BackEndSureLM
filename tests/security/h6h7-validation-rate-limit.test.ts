import { describe, it, expect } from "vitest";
import { RATE_LIMITS } from "@/lib/security/rateLimiter";
import { CreateLeadSchema, CreateMessageSchema, CreateReminderSchema, UpdateLeadSchema } from "@/lib/validation/schemas";

describe("H6 — Zod input validation", () => {
  it("CreateMessageSchema rejects invalid role", () => {
    const result = CreateMessageSchema.safeParse({ leadId: "abc", role: "ADMIN", content: "hello" });
    expect(result.success).toBe(false);
  });

  it("CreateMessageSchema rejects empty content", () => {
    const result = CreateMessageSchema.safeParse({ leadId: "abc", role: "AGENT", content: "" });
    expect(result.success).toBe(false);
  });

  it("CreateLeadSchema rejects empty householdName", () => {
    const result = CreateLeadSchema.safeParse({ householdName: "" });
    expect(result.success).toBe(false);
  });

  it("CreateReminderSchema rejects invalid type", () => {
    const result = CreateReminderSchema.safeParse({ leadId: "abc", type: "MEETING", scheduledAt: "2026-01-01T00:00:00Z" });
    expect(result.success).toBe(false);
  });

  it("CreateReminderSchema accepts valid input", () => {
    const result = CreateReminderSchema.safeParse({ leadId: "abc", type: "FOLLOWUP", scheduledAt: "2026-01-01T00:00:00Z" });
    expect(result.success).toBe(true);
  });

  it("UpdateLeadSchema accepts valid status", () => {
    const result = UpdateLeadSchema.safeParse({ leadId: "abc", status: "NEW" });
    expect(result.success).toBe(true);
  });

  it("UpdateLeadSchema rejects invalid status", () => {
    const result = UpdateLeadSchema.safeParse({ leadId: "abc", status: "INVALID" });
    expect(result.success).toBe(false);
  });
});

describe("H7 — brochure upload rate limiting", () => {
  it("brochures:upload action exists in rate limit config", () => {
    expect(RATE_LIMITS["brochures:upload"]).toBeDefined();
    expect(RATE_LIMITS["brochures:upload"].limit).toBeGreaterThan(0);
    expect(RATE_LIMITS["brochures:upload"].windowMs).toBeGreaterThan(0);
  });
});

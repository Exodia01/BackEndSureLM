import { describe, it, expect } from "vitest";
import {
  checkRateLimit,
  rateLimitExceeded,
  RATE_LIMITS,
} from "@/lib/security/rateLimiter";

describe("rate limiter", () => {
  it("allows requests up to the limit", () => {
    const { limit } = RATE_LIMITS["versions:publish"];
    for (let i = 0; i < limit; i++) {
      expect(checkRateLimit("admin-1", "versions:publish").allowed).toBe(true);
    }
  });

  it("rejects once the limit is exceeded", () => {
    const { limit } = RATE_LIMITS["versions:publish"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("admin-2", "versions:publish");
    }
    const res = checkRateLimit("admin-2", "versions:publish");
    expect(res.allowed).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("is isolated per subject (one admin's abuse does not block another)", () => {
    const { limit } = RATE_LIMITS["policies:create"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("abusive-admin", "policies:create");
    }
    expect(checkRateLimit("abusive-admin", "policies:create").allowed).toBe(false);
    expect(checkRateLimit("other-admin", "policies:create").allowed).toBe(true);
  });

  it("is isolated per action", () => {
    const { limit } = RATE_LIMITS["versions:publish"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("admin-3", "versions:publish");
    }
    expect(checkRateLimit("admin-3", "versions:publish").allowed).toBe(false);
    // A different action for the same subject is not affected.
    expect(checkRateLimit("admin-3", "policies:create").allowed).toBe(true);
  });

  it("reports a positive retry-after when rejected", () => {
    const { limit } = RATE_LIMITS["policies:delete"];
    for (let i = 0; i < limit; i++) {
      checkRateLimit("admin-4", "policies:delete");
    }
    const res = checkRateLimit("admin-4", "policies:delete");
    expect(res.allowed).toBe(false);
    expect(Number.isInteger(res.retryAfterSeconds)).toBe(true);
    expect(res.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("version publishing has the tightest ceiling of the admin mutations", () => {
    const publish = RATE_LIMITS["versions:publish"].limit;
    for (const key of Object.keys(RATE_LIMITS) as (keyof typeof RATE_LIMITS)[]) {
      if (key === "versions:publish") continue;
      // Version publishing (DB transaction + immutable snapshot) is the most
      // expensive mutation, so it must never be higher than any other ceiling.
      expect(publish).toBeLessThanOrEqual(RATE_LIMITS[key].limit);
    }
  });

  it("rateLimitExceeded returns a consistent 429 with Retry-After", () => {
    const res = rateLimitExceeded("versions:publish", 30);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("30");
  });
});

/**
 * In-process sliding-window rate limiter for admin mutation endpoints.
 *
 * The project has no Redis/queue infrastructure, so this uses an in-memory
 * sliding window keyed by `${subject}:${action}`. It is deliberately simple
 * and dependency-free. It is correct for a single-instance deployment; if the
 * app is scaled to multiple instances, move the window into a shared store
 * (the interface here makes that swap straightforward).
 *
 * Authorization is NOT weakened: rate limiting is enforced only AFTER the
 * existing requireAdmin / requireAuth guards succeed. It is an additional
 * abuse control, never a substitute for authorization.
 */

import { NextResponse } from "next/server";

export type RateLimitAction =
  | "policies:create"
  | "policies:update"
  | "policies:delete"
  | "versions:publish"
  | "requirements:extract"
  | "requirements:approve"
  | "requirements:update"
  | "requirements:reject"
  | "brochures:link"
  | "brochures:unlink"
  | "issuances:create"
  | "applications:create"
  | "applications:submit"
  | "applications:approve"
  | "applications:reject"
  | "applications:checklist"
  | "documents:upload"
  | "documents:retry"
  | "documents:review"
  | "documents:download"
  | "documents:list";

export interface RateLimitConfig {
  /** Maximum number of allowed requests in the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

/**
 * Explicit, documented limits. Version publishing is the most expensive
 * operation (DB transaction + immutable snapshot), so it gets the tightest
 * ceiling. Everything else is a burst-cap with a per-hour cap.
 */
export const RATE_LIMITS: Record<RateLimitAction, RateLimitConfig> = {
  "policies:create": { limit: 30, windowMs: 60 * 60 * 1000 },
  "policies:update": { limit: 60, windowMs: 60 * 60 * 1000 },
  "policies:delete": { limit: 20, windowMs: 60 * 60 * 1000 },
  "versions:publish": { limit: 10, windowMs: 60 * 60 * 1000 },
  "requirements:extract": { limit: 20, windowMs: 60 * 60 * 1000 },
  "requirements:approve": { limit: 100, windowMs: 60 * 60 * 1000 },
  "requirements:update": { limit: 100, windowMs: 60 * 60 * 1000 },
  "requirements:reject": { limit: 100, windowMs: 60 * 60 * 1000 },
  "brochures:link": { limit: 60, windowMs: 60 * 60 * 1000 },
  "brochures:unlink": { limit: 60, windowMs: 60 * 60 * 1000 },
  "issuances:create": { limit: 50, windowMs: 60 * 60 * 1000 },
  "applications:create": { limit: 100, windowMs: 60 * 60 * 1000 },
  "applications:submit": { limit: 100, windowMs: 60 * 60 * 1000 },
  "applications:approve": { limit: 100, windowMs: 60 * 60 * 1000 },
  "applications:reject": { limit: 100, windowMs: 60 * 60 * 1000 },
  "applications:checklist": { limit: 300, windowMs: 60 * 60 * 1000 },
  "documents:upload": { limit: 60, windowMs: 60 * 60 * 1000 },
  "documents:retry": { limit: 20, windowMs: 60 * 60 * 1000 },
  "documents:review": { limit: 100, windowMs: 60 * 60 * 1000 },
  "documents:download": { limit: 120, windowMs: 60 * 60 * 1000 },
  "documents:list": { limit: 120, windowMs: 60 * 60 * 1000 },
};

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/**
 * Returns true if the request is allowed (records it), false if it exceeds
 * the configured limit. Keyed by subject (authenticated user sub) + action so
 * one admin's abuse does not affect other admins.
 */
export function checkRateLimit(
  subject: string,
  action: RateLimitAction
): { allowed: boolean; retryAfterSeconds: number } {
  const config = RATE_LIMITS[action];
  if (!config) return { allowed: true, retryAfterSeconds: 0 };

  const key = `${subject}:${action}`;
  const now = Date.now();
  const windowStart = now - config.windowMs;

  const bucket = buckets.get(key) ?? { timestamps: [] as number[] };

  // Drop timestamps outside the window.
  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);

  if (bucket.timestamps.length >= config.limit) {
    buckets.set(key, bucket);
    const oldest = bucket.timestamps[0];
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldest + config.windowMs - now) / 1000)
    );
    return { allowed: false, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup to avoid unbounded growth.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      const cfg = RATE_LIMITS[k.split(":").slice(1).join(":") as RateLimitAction];
      const keep = cfg ? cfg.windowMs : 60 * 60 * 1000;
      b.timestamps = b.timestamps.filter((t) => t > now - keep);
      if (b.timestamps.length === 0) buckets.delete(k);
    }
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Builds a consistent HTTP 429 response with a Retry-After header.
 * All rate-limited endpoints return this same shape.
 */
export function rateLimitExceeded(
  action: RateLimitAction,
  retryAfterSeconds: number
): NextResponse {
  return NextResponse.json(
    {
      error: "Rate limit exceeded",
      action,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

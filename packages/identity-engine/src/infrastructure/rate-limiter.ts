/**
 * rate-limiter.ts — AEGIS Identity Engine · Infrastructure Layer
 *
 * Adapts the shared Upstash rate limiter to the RateLimiterPort interface.
 * The application layer only depends on the port — not on Upstash directly.
 */
import { rateLimit } from "@cozanethq/aegis-shared-sdk";
import type { RateLimiterPort } from "../application/identity-use-cases";

export class UpstashRateLimiter implements RateLimiterPort {
  async check(
    key:           string,
    limit:         number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const window = `${windowSeconds} s`;
    const result = await rateLimit(key, key, limit, window);
    return { allowed: result.allowed, remaining: result.remaining };
  }
}

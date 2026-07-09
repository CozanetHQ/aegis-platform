/**
 * otp-generator.ts — AEGIS Identity Engine · Domain Layer
 *
 * Generates and hashes one-time email verification codes.
 * Pure TypeScript. Only dependency: Node.js crypto (built-in) — same rule
 * aegis-id-generator.ts follows.
 *
 * Codes are never stored in plaintext. hash() is a keyed SHA-256 over
 * (code + identityId + pepper): binding the hash to the identityId means a
 * leaked hash from one account's row can't be replayed against another, and
 * the pepper (a server-only secret, never in the DB) means a stolen DB
 * export alone isn't enough to brute-force codes offline.
 */
import { randomInt, createHash } from "crypto";

export class OtpGenerator {
  /** Generates a random 6-digit code, zero-padded (e.g. "042917"). */
  static generate(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, "0");
  }

  static hash(code: string, identityId: string): string {
    const pepper = process.env.OTP_HASH_PEPPER ?? "";
    return createHash("sha256").update(`${code}:${identityId}:${pepper}`).digest("hex");
  }
}

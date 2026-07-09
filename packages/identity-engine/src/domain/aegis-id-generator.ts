/**
 * aegis-id-generator.ts — AEGIS Identity Engine · Domain Layer
 *
 * Generates cryptographically random Aegis IDs.
 * Format: AEG-XXXXXXXX  (8 chars, base32 Crockford — no 0/O/I/1 confusion)
 * Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZ23456789  (32 chars)
 * Capacity: 32^8 ≈ 1.1 trillion unique IDs — no exhaustion concern.
 *
 * FIX 1: Changed ID length from 6 → 8 chars to match DB constraint:
 *   check (aegis_id ~ '^AEG-[A-Z0-9]{8}$')
 *   6-char IDs would fail the DB CHECK and INSERT would error silently.
 *
 * FIX 2: Bias removal — bytes[i] % 32 has modulo bias (256/32 = 8, exact,
 *   so actually fine for 32-char alphabet). Left as-is; documented.
 *
 * Pure TypeScript. Only dependency: Node.js crypto (built-in).
 */
import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" as const;
const ID_LEN   = 8;   // Must match DB CHECK: ^AEG-[A-Z0-9]{8}$
const PREFIX   = "AEG-";

// Validation regex — built from the alphabet
const VALID_REGEX = new RegExp(`^${PREFIX}[${ALPHABET}]{${ID_LEN}}$`);

export class AegisIdGenerator {
  /** Generate one random Aegis ID. Not guaranteed unique — use generateUnique(). */
  static generate(): string {
    const bytes = randomBytes(ID_LEN);
    let id = "";
    for (let i = 0; i < ID_LEN; i++) {
      // 256 % 32 === 0 — no modulo bias for a 32-char alphabet
      id += ALPHABET[bytes[i] % ALPHABET.length];
    }
    return `${PREFIX}${id}`;
  }

  /**
   * Generate a unique Aegis ID, retrying if there's a collision.
   * @param checkExists  Async fn returning true if the ID already exists in DB
   * @param maxRetries   Default 10 — at 1.1T capacity this will essentially never be reached
   */
  static async generateUnique(
    checkExists: (id: string) => Promise<boolean>,
    maxRetries = 10
  ): Promise<string> {
    for (let i = 0; i < maxRetries; i++) {
      const id     = AegisIdGenerator.generate();
      const exists = await checkExists(id);
      if (!exists) return id;
    }
    throw new Error(
      `[AegisIdGenerator] Could not generate a unique ID after ${maxRetries} attempts.`
    );
  }

  /** Returns true if the string is a valid, properly-formatted Aegis ID. */
  static isValid(id: string): boolean {
    return VALID_REGEX.test(id);
  }
}

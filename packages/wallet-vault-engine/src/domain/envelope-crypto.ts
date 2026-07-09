/**
 * envelope-crypto.ts — Envelope encryption for private key material (Wallet Vault Engine)
 *
 * MVP implementation: AES-256-GCM with a master key from VAULT_MASTER_KEY_HEX
 * (32-byte hex, env var). This is an interim stand-in for a real KMS/HSM —
 * the KmsPort interface below is the seam: swapping to AWS KMS / GCP KMS /
 * an HSM later means implementing this same interface, zero changes to
 * calling code (Rule 7 — future compatibility without rewriting business logic).
 *
 * KNOWN GAP: a single static master key in an env var is NOT acceptable for
 * mainnet custody. This must be replaced before real funds are held. Flagging
 * explicitly rather than presenting this as production-grade.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";

export interface EncryptedMaterial {
  ciphertext: string; // base64
  iv:         string; // base64
  authTag:    string; // base64
  keyVersion: number;
  kmsKeyRef:  string;
}

export interface KmsPort {
  encrypt(plaintext: string): Promise<EncryptedMaterial>;
  decrypt(material: EncryptedMaterial): Promise<string>;
}

const KEY_VERSION = 1;
const KMS_KEY_REF = "env:VAULT_MASTER_KEY_HEX:v1"; // swap to real KMS key ARN/resource id at cutover

function getMasterKey(): Buffer {
  const hex = process.env.VAULT_MASTER_KEY_HEX;
  if (!hex || hex.length !== 64) {
    throw new Error("VAULT_MASTER_KEY_HEX not configured or not 32 bytes (64 hex chars)");
  }
  return Buffer.from(hex, "hex");
}

export class EnvelopeAesGcmKms implements KmsPort {
  async encrypt(plaintext: string): Promise<EncryptedMaterial> {
    const key    = getMasterKey();
    const iv     = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: ciphertext.toString("base64"),
      iv:         iv.toString("base64"),
      authTag:    authTag.toString("base64"),
      keyVersion: KEY_VERSION,
      kmsKeyRef:  KMS_KEY_REF,
    };
  }

  async decrypt(material: EncryptedMaterial): Promise<string> {
    const key      = getMasterKey();
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(material.iv, "base64"));
    decipher.setAuthTag(Buffer.from(material.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(material.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

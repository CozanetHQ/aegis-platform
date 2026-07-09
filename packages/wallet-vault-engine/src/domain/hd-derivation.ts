/**
 * hd-derivation.ts — Deterministic HD wallet derivation (Wallet Vault Engine)
 *
 * One HD root (VAULT_HD_MNEMONIC) for the whole vault. Each (aegisId, blockchain)
 * pair maps deterministically to a BIP44 derivation path, so wallets are
 * reproducible from the mnemonic alone (no need to persist private keys —
 * only the derivation path — though we additionally envelope-encrypt and
 * store the derived key for fast signing without re-deriving from the root
 * on every request; see envelope-crypto.ts).
 *
 * KNOWN GAP (documented, not hidden): VAULT_HD_MNEMONIC lives in a Vercel env
 * var for MVP. Before any mainnet funds are custodied, this must move to a
 * real KMS/HSM (e.g. AWS KMS, GCP KMS, or a hardware HSM) per Rule 7 — the
 * derivation interface here is written so that swap doesn't touch callers.
 */
import { mnemonicToAccount, type HDAccount } from "viem/accounts";
import { keccak256 } from "viem";
import { createHash } from "crypto";
import type { Blockchain } from "./wallet-entity";

const COIN_TYPE: Record<Blockchain, number> = {
  ETHEREUM: 60,
  BNB:      60,   // BNB Smart Chain is EVM-compatible — same curve & address format as Ethereum
  TRON:     195,  // SLIP-44 Tron coin type
};

/**
 * Deterministic non-hardened address index derived from aegisId, so the same
 * identity always gets the same wallet slot without needing a counter table.
 * Truncated to 31 bits to stay within BIP32's non-hardened index range.
 */
function addressIndexFor(aegisId: string): number {
  const hash = createHash("sha256").update(aegisId).digest();
  return hash.readUInt32BE(0) & 0x7fffffff;
}

export function derivationPathFor(aegisId: string, blockchain: Blockchain): string {
  const coinType = COIN_TYPE[blockchain];
  const index    = addressIndexFor(aegisId);
  return `m/44'/${coinType}'/0'/0/${index}`;
}

interface DerivedKey {
  privateKeyHex: string; // 0x-prefixed, secp256k1
  address:       string; // chain-formatted address
}

function getRootAccount(path: string): HDAccount {
  const mnemonic = process.env.VAULT_HD_MNEMONIC;
  if (!mnemonic) {
    throw new Error("VAULT_HD_MNEMONIC not configured on server");
  }
  return mnemonicToAccount(mnemonic, { path: path as any });
}

/** EVM chains (ETHEREUM, BNB) — viem gives us the checksummed address directly. */
function deriveEvm(aegisId: string, blockchain: "ETHEREUM" | "BNB"): DerivedKey {
  const path    = derivationPathFor(aegisId, blockchain);
  const account = getRootAccount(path);
  // viem's mnemonicToAccount doesn't expose the raw private key directly on
  // the HDAccount; derive it via the underlying HD key for storage/signing.
  const privateKeyHex = (account as any).getHdKey?.().privateKey
    ? "0x" + Buffer.from((account as any).getHdKey().privateKey).toString("hex")
    : undefined;
  if (!privateKeyHex) {
    throw new Error("Failed to derive EVM private key material");
  }
  return { privateKeyHex, address: account.address };
}

/**
 * TRON — same secp256k1 curve as EVM, but a different address encoding:
 * base58check(0x41 || keccak256(pubkey)[-20:]).
 * We derive the same way (HD key over the Tron coin-type path) and re-encode.
 */
function deriveTron(aegisId: string): DerivedKey {
  const path    = derivationPathFor(aegisId, "TRON");
  const account = getRootAccount(path);
  const hdKey   = (account as any).getHdKey?.();
  if (!hdKey?.privateKey || !hdKey?.publicKey) {
    throw new Error("Failed to derive TRON key material");
  }
  const privateKeyHex = "0x" + Buffer.from(hdKey.privateKey).toString("hex");

  // Uncompressed public key minus the 0x04 prefix, keccak256, last 20 bytes, 0x41 prefix.
  const pubUncompressed = Buffer.from(hdKey.publicKey).length === 65
    ? Buffer.from(hdKey.publicKey)
    : Buffer.from(hdKey.publicKey); // viem always gives uncompressed for HD keys
  const pubBody = pubUncompressed.subarray(1); // drop 0x04
  const hash    = keccak256(pubBody as unknown as `0x${string}`).slice(2);
  const addrBytes = Buffer.concat([Buffer.from("41", "hex"), Buffer.from(hash, "hex").subarray(-20)]);
  const address = base58CheckEncode(addrBytes);

  return { privateKeyHex, address };
}

export function deriveWallet(aegisId: string, blockchain: Blockchain): DerivedKey {
  if (blockchain === "TRON") return deriveTron(aegisId);
  return deriveEvm(aegisId, blockchain);
}

// ── Minimal base58check (no external dep — avoids pulling in tronweb) ──────
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buf: Buffer): string {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  const base = BigInt(58);
  while (num > 0n) {
    const rem = num % base;
    out = ALPHABET[Number(rem)] + out;
    num = num / base;
  }
  for (const byte of buf) {
    if (byte === 0) out = ALPHABET[0] + out;
    else break;
  }
  return out;
}

function base58CheckEncode(payload: Buffer): string {
  const checksum = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest()
    .subarray(0, 4);
  return base58Encode(Buffer.concat([payload, checksum]));
}

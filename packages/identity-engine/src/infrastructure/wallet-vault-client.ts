/**
 * wallet-vault-client.ts — AEGIS Identity Engine · Infrastructure Layer
 *
 * Phase 1: LocalWalletVaultClient — derives BNB address deterministically (no private key)
 * Phase 2: HttpWalletVaultClient — calls the real Wallet Vault Engine HTTP API
 *
 * FIXED: was calling the wrong path (/api/v2/vault/wallets with
 * {identity_uuid, blockchains}) — the real deployed Wallet Vault Engine
 * exposes POST /api/v1/wallet-vault/generate with { aegisId }, and
 * GET /api/v1/wallet-vault/wallets?aegisId=... to fetch existing wallets.
 * Verified against the live wallet-vault-use-cases.ts contract.
 */
import { keccak256, toBytes } from "viem";
import type { WalletVaultPort, WalletVaultResult } from "../application/identity-use-cases";

// ── Phase 1: Deterministic local client (test/dev only) ───────────────────────
export class LocalWalletVaultClient implements WalletVaultPort {
  async generateWallets(identityId: string): Promise<WalletVaultResult> {
    const seed    = `aegis-identity-v2:${identityId}`;
    const hash    = keccak256(toBytes(seed));
    const address = `0x${hash.slice(-40)}` as `0x${string}`;
    return {
      wallets: [
        { walletVaultId: `local-bnb-${identityId}`, blockchain: "BNB", address, isPrimary: true },
      ],
    };
  }
  async rollbackWallets(identityId: string): Promise<void> {
    console.log(`[LocalWalletVaultClient] Rollback no-op for ${identityId}`);
  }
}

// ── Phase 2: HTTP client — calls the real Wallet Vault Engine API ─────────────
export class HttpWalletVaultClient implements WalletVaultPort {
  private readonly baseUrl = process.env.WALLET_VAULT_URL
    ?? "https://aegis-wallet-vault-engine.vercel.app";
  private readonly apiKey  = process.env.WALLET_VAULT_API_KEY ?? "";

  private get headers(): Record<string, string> {
    return {
      "Content-Type":     "application/json",
      "X-Vault-API-Key":  this.apiKey,
    };
  }

  /**
   * NOTE: identityId here must be the aegisId (e.g. "AEG-XXXXXX"), not the
   * internal identity UUID — the Wallet Vault Engine keys wallets by aegisId.
   * Callers in identity-use-cases.ts must pass identity.aegisId.
   */
  async generateWallets(aegisId: string): Promise<WalletVaultResult> {
    const res = await fetch(`${this.baseUrl}/api/v1/wallet-vault/generate`, {
      method:  "POST",
      headers: this.headers,
      body:    JSON.stringify({ aegisId }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(
        `[HttpWalletVaultClient] generateWallets failed: HTTP ${res.status} — ${body?.error?.message ?? "unknown"}`
      );
    }

    const data = await res.json() as {
      wallets: Array<{ id: string; blockchain: "BNB" | "ETHEREUM" | "TRON"; address: string; isPrimary: boolean }>
    };
    return {
      wallets: data.wallets.map((w) => ({
        walletVaultId: w.id,
        blockchain:    w.blockchain,
        address:       w.address as `0x${string}`,
        isPrimary:     w.isPrimary,
      })),
    };
  }

  /**
   * The live Wallet Vault Engine has no rollback endpoint (its generate is
   * idempotent by design — no dangling state to roll back). Keep this a
   * safe no-op so identity-use-cases.ts's error path doesn't throw.
   */
  async rollbackWallets(aegisId: string): Promise<void> {
    console.log(`[HttpWalletVaultClient] No rollback endpoint on Wallet Vault Engine — no-op for ${aegisId}`);
  }
}

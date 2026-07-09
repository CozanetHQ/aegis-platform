/**
 * wallet-entity.ts — Wallet domain model & state machine (Wallet Vault Engine)
 */

export type Blockchain = "BNB" | "ETHEREUM" | "TRON";

export type WalletState = "ACTIVE" | "FROZEN" | "DEPRECATED";

export interface Wallet {
  id:             string;
  aegisId:        string;
  blockchain:     Blockchain;
  address:        string;
  isPrimary:      boolean;
  derivationPath: string;
  state:          WalletState;
  createdAt:      string;
  updatedAt:      string;
}

/** Public-facing wallet shape — never includes key material. */
export type PublicWallet = Wallet;

// ── State machine ────────────────────────────────────────────────────────────
// ACTIVE   → FROZEN      (admin/system freeze — suspicious activity, compliance hold)
// FROZEN   → ACTIVE      (admin unfreeze)
// ACTIVE   → DEPRECATED  (wallet rotated out, no longer used for new transfers)
// FROZEN   → DEPRECATED  (frozen wallet permanently retired)
// DEPRECATED is terminal — no transitions out.

const ALLOWED_TRANSITIONS: Record<WalletState, WalletState[]> = {
  ACTIVE:     ["FROZEN", "DEPRECATED"],
  FROZEN:     ["ACTIVE", "DEPRECATED"],
  DEPRECATED: [],
};

export function canTransition(from: WalletState, to: WalletState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Can this wallet be used to sign an outbound transaction right now? */
export function isSignable(state: WalletState): boolean {
  return state === "ACTIVE";
}

export const SUPPORTED_BLOCKCHAINS: Blockchain[] = ["BNB", "ETHEREUM", "TRON"];

/** The one blockchain marked isPrimary per identity when wallets are
 * generated. Ethereum is the canonical default — BNB shares the same
 * address/key anyway (both EVM, coin type 60), so the only meaningful
 * primary choice is really "EVM (via Ethereum) vs TRON". */
export const PRIMARY_BLOCKCHAIN: Blockchain = "ETHEREUM";

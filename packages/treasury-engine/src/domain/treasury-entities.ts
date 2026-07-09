/**
 * treasury-entities.ts — Domain entities (Treasury Engine)
 * Pure domain — zero I/O imports.
 */

export type LedgerEntryType = "FEE_COLLECTED" | "GAS_SPONSORSHIP" | "TREASURY_ADJUSTMENT";

export interface TreasuryLedgerEntry {
  id: string;
  type: LedgerEntryType;
  aegisId: string;
  chain: string;
  correlationId: string;
  /** wei, as a decimal string (BigInt-safe) */
  amountWei: string;
  /** the on-chain tx hash this entry is associated with, if any */
  txHash: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FeeQuote {
  correlationId: string;
  aegisId: string;
  /** wei, decimal string */
  swapAmountWei: string;
  feeBps: number;
  /** wei, decimal string */
  feeAmountWei: string;
  /** wei, decimal string — swapAmountWei minus feeAmountWei */
  netAmountWei: string;
  expiresAt: string;
}

export interface GasSponsorshipResult {
  correlationId: string;
  aegisId: string;
  sponsored: boolean;
  /** wei, decimal string. 0 if not sponsored (wallet already had enough). */
  topUpAmountWei: string;
  /** tx hash of the treasury -> user top-up transfer, if a top-up was sent */
  topUpTxHash: string | null;
  reason: string;
}

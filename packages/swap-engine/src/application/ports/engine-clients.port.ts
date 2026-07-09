/**
 * engine-clients.port.ts — Swap Engine · outbound ports to other engines.
 * Swap Engine is a stateless orchestrator — it never talks to another
 * engine's database directly, only via HTTP through these ports.
 */

export interface WalletInfo {
  id: string;
  aegisId: string;
  blockchain: string;
  address: string;
  state: "ACTIVE" | "FROZEN" | "DEPRECATED";
}

export interface WalletVaultClient {
  /** Wallet authorization step — fetch the user's wallet(s) and confirm the BNB wallet is ACTIVE. */
  getWallets(aegisId: string): Promise<WalletInfo[]>;
  /** Transaction signing step. */
  signTransaction(walletId: string, aegisId: string, unsignedTx: Record<string, unknown>): Promise<string>;
}

export interface FeeQuote {
  correlationId: string;
  feeAmountWei: string;
  netAmountWei: string;
}

export interface GasSponsorshipResult {
  sponsored: boolean;
  topUpTxHash: string | null;
}

export interface TreasuryClient {
  calculateFee(aegisId: string, swapAmountWei: string, correlationId: string): Promise<FeeQuote>;
  sponsorGasIfNeeded(aegisId: string, userWalletAddress: string, correlationId: string): Promise<GasSponsorshipResult>;
  recordTransaction(input: {
    aegisId: string; correlationId: string; chain: string; txHash: string; feeAmountWei: string; metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface AuditClient {
  emitEvent(input: {
    engine: string; category: string; eventName: string; severity: string; outcome: string;
    actorId: string; actorType: string; correlationId: string; details: Record<string, unknown>;
  }): Promise<void>;
}

export interface NotificationClient {
  notify(input: { eventId: string; eventType: string; recipientAegisId: string; payload: Record<string, unknown> }): Promise<void>;
}

export interface PortfolioClient {
  refresh(aegisId: string, payload: Record<string, unknown>): Promise<void>;
}

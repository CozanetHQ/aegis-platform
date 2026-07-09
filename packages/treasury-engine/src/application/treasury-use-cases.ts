/**
 * treasury-use-cases.ts — Application layer (Treasury Engine)
 */
import { v4 as uuidv4 } from "uuid";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import { calculateFee, type FeePolicyConfig } from "../domain/fee-policy";
import type { TreasuryRepository, ChainClient } from "./ports";
import type { FeeQuote, GasSponsorshipResult, TreasuryLedgerEntry, LedgerEntryType } from "../domain/treasury-entities";

const FEE_QUOTE_TTL_SECONDS = 60;

export interface GasSponsorshipPolicy {
  thresholdWei: bigint; // if wallet balance is below this, sponsor a top-up
  topUpWei: bigint;      // amount to send when sponsoring
  dailyCapWei: bigint;   // max total sponsorship per aegisId per rolling 24h
}

export class TreasuryUseCases {
  constructor(
    private readonly repo: TreasuryRepository,
    private readonly chain: ChainClient,
    private readonly feePolicy: FeePolicyConfig,
    private readonly gasPolicy: GasSponsorshipPolicy,
  ) {}

  /** Step: Treasury fee calculation. Pure calc, no side effects (recorded later via recordTransaction). */
  calculateSwapFee(aegisId: string, swapAmountWei: bigint, correlationId?: string): FeeQuote {
    const { feeAmountWei, netAmountWei } = calculateFee(swapAmountWei, this.feePolicy);
    return {
      correlationId: correlationId ?? uuidv4(),
      aegisId,
      swapAmountWei: swapAmountWei.toString(),
      feeBps: this.feePolicy.feeBps,
      feeAmountWei: feeAmountWei.toString(),
      netAmountWei: netAmountWei.toString(),
      expiresAt: new Date(Date.now() + FEE_QUOTE_TTL_SECONDS * 1000).toISOString(),
    };
  }

  /**
   * Step: Gas sponsorship. Checks the user wallet's native balance; if below
   * the configured threshold, sends a top-up from the treasury hot wallet —
   * enforcing a rolling 24h per-user cap so a single account can't drain the
   * treasury (see PRODUCTION_BLOCKERS.md — this cap is basic, not a full
   * anomaly-detection system).
   */
  async sponsorGasIfNeeded(aegisId: string, userWalletAddress: string, correlationId?: string): Promise<GasSponsorshipResult> {
    const corrId = correlationId ?? uuidv4();
    const balanceWei = await this.chain.getNativeBalanceWei(userWalletAddress);

    if (balanceWei >= this.gasPolicy.thresholdWei) {
      return {
        correlationId: corrId,
        aegisId,
        sponsored: false,
        topUpAmountWei: "0",
        topUpTxHash: null,
        reason: "Wallet balance already above gas threshold; no sponsorship needed.",
      };
    }

    const alreadySponsored24h = await this.repo.sumGasSponsorshipLast24h(aegisId);
    if (alreadySponsored24h + this.gasPolicy.topUpWei > this.gasPolicy.dailyCapWei) {
      throw new AegisError(
        "GAS_SPONSORSHIP_DAILY_CAP_EXCEEDED",
        `Gas sponsorship daily cap exceeded for this identity (already sponsored ${alreadySponsored24h} wei in the last 24h).`,
        429,
      );
    }

    const txHash = await this.chain.sendNativeTopUp(userWalletAddress, this.gasPolicy.topUpWei);

    await this.repo.insertLedgerEntry({
      type: "GAS_SPONSORSHIP",
      aegisId,
      chain: "BNB",
      correlationId: corrId,
      amountWei: this.gasPolicy.topUpWei.toString(),
      txHash,
      metadata: { userWalletAddress, balanceBeforeWei: balanceWei.toString() },
    });

    return {
      correlationId: corrId,
      aegisId,
      sponsored: true,
      topUpAmountWei: this.gasPolicy.topUpWei.toString(),
      topUpTxHash: txHash,
      reason: `Wallet balance ${balanceWei} wei below threshold ${this.gasPolicy.thresholdWei} wei; sponsored top-up sent.`,
    };
  }

  /** Step: transaction recording. Called after PancakeSwap confirmation to record the fee collection against the real, final swap tx hash. */
  async recordTransaction(input: {
    aegisId: string;
    correlationId: string;
    chain: string;
    txHash: string;
    feeAmountWei: string;
    metadata?: Record<string, unknown>;
  }): Promise<TreasuryLedgerEntry> {
    return this.repo.insertLedgerEntry({
      type: "FEE_COLLECTED",
      aegisId: input.aegisId,
      chain: input.chain,
      correlationId: input.correlationId,
      amountWei: input.feeAmountWei,
      txHash: input.txHash,
      metadata: input.metadata ?? {},
    });
  }

  async getLedger(filter: { aegisId?: string; type?: LedgerEntryType; limit?: number }): Promise<TreasuryLedgerEntry[]> {
    return this.repo.listLedgerEntries(filter);
  }
}

/**
 * execute-swap.use-case.ts — Swap Engine · Phase 2 execution chain
 *
 * Quote → Wallet authorization → Treasury fee calculation → Gas sponsorship →
 * Transaction signing → PancakeSwap execution → Confirmation → Audit event →
 * Notification → Portfolio refresh.
 *
 * ("Dashboard refresh" and "Transaction history" are the client/UI's reaction
 * to the Notification + Portfolio-refresh events firing — see
 * aegis-architecture/PRODUCTION_BLOCKERS.md.)
 *
 * Every downstream call failure is surfaced as its own AegisError so the
 * caller (and the audit trail) can tell exactly which step of the chain broke.
 */
import { v4 as uuidv4 } from "uuid";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import type { WalletVaultClient, TreasuryClient, AuditClient, NotificationClient, PortfolioClient } from "../ports/engine-clients.port";
import type { PancakeSwapExecuteProvider } from "../../infrastructure/providers/pancakeswap-execute.provider";

export interface ExecuteSwapInput {
  aegisId: string;
  tokenIn: string;
  tokenOut: string;
  amountInWei: string;
  minimumReceivedWei: string;
  route: string[];
  quoteId: string;
}

export interface ExecuteSwapResult {
  correlationId: string;
  txHash: string;
  status: "success" | "reverted";
  feeAmountWei: string;
  netAmountWei: string;
  gasSponsored: boolean;
}

export class ExecuteSwapUseCase {
  constructor(
    private readonly walletVault: WalletVaultClient,
    private readonly treasury: TreasuryClient,
    private readonly audit: AuditClient,
    private readonly notification: NotificationClient,
    private readonly portfolio: PortfolioClient,
    private readonly pancakeSwap: PancakeSwapExecuteProvider,
  ) {}

  async execute(input: ExecuteSwapInput): Promise<ExecuteSwapResult> {
    const correlationId = uuidv4();
    const auditBase = { engine: "swap", correlationId, actorId: input.aegisId, actorType: "USER" as const };

    // 1. Wallet authorization — resolve + validate the user's BNB wallet.
    const wallets = await this.walletVault.getWallets(input.aegisId);
    const bnbWallet = wallets.find((w) => w.blockchain === "BNB");
    if (!bnbWallet) {
      throw new AegisError("SWAP_NO_BNB_WALLET", "No BNB wallet found for this identity.", 404);
    }
    if (bnbWallet.state !== "ACTIVE") {
      await this.audit.emitEvent({ ...auditBase, category: "SWAP", eventName: "swap.wallet_not_active", severity: "WARNING", outcome: "FAILURE", details: { walletId: bnbWallet.id, state: bnbWallet.state } });
      throw new AegisError("SWAP_WALLET_NOT_ACTIVE", `BNB wallet is ${bnbWallet.state}, cannot execute swap.`, 409);
    }

    // 2. Treasury fee calculation.
    const feeQuote = await this.treasury.calculateFee(input.aegisId, input.amountInWei, correlationId);

    // 3. Gas sponsorship — top up native BNB if the wallet can't cover gas.
    const gasResult = await this.treasury.sponsorGasIfNeeded(input.aegisId, bnbWallet.address, correlationId);

    // Build the unsigned tx plan (approve step if needed + the swap itself).
    const plan = await this.pancakeSwap.buildUnsignedSwap({
      fromAddress: bnbWallet.address,
      tokenIn: input.tokenIn,
      tokenOut: input.tokenOut,
      amountInWei: BigInt(input.amountInWei),
      minimumReceivedWei: BigInt(input.minimumReceivedWei),
      route: input.route,
    });

    let finalTxHash = "";
    for (const step of plan.steps) {
      // 4. Transaction signing (Wallet Vault).
      const signedTx = await this.walletVault.signTransaction(bnbWallet.id, input.aegisId, step.unsignedTx);
      // 5. PancakeSwap execution — broadcast.
      const txHash = await this.pancakeSwap.broadcastSignedTx(signedTx);
      // 6. Confirmation.
      const receipt = await this.pancakeSwap.waitForConfirmation(txHash);
      if (receipt.status !== "success") {
        await this.audit.emitEvent({ ...auditBase, category: "SWAP", eventName: `swap.${step.kind}_reverted`, severity: "ERROR", outcome: "FAILURE", details: { txHash } });
        throw new AegisError("SWAP_TRANSACTION_REVERTED", `${step.kind} transaction reverted on-chain (tx ${txHash}).`, 502, { txHash });
      }
      finalTxHash = txHash;
    }

    // Record the fee against the final (swap) tx hash.
    await this.treasury.recordTransaction({
      aegisId: input.aegisId,
      correlationId,
      chain: "BNB",
      txHash: finalTxHash,
      feeAmountWei: feeQuote.feeAmountWei,
      metadata: { quoteId: input.quoteId, tokenIn: input.tokenIn, tokenOut: input.tokenOut },
    });

    // 7. Audit event.
    await this.audit.emitEvent({
      ...auditBase, category: "SWAP", eventName: "swap.executed", severity: "INFO", outcome: "SUCCESS",
      details: { txHash: finalTxHash, tokenIn: input.tokenIn, tokenOut: input.tokenOut, amountInWei: input.amountInWei, feeAmountWei: feeQuote.feeAmountWei, gasSponsored: gasResult.sponsored },
    });

    // 8. Notification. Event type/payload keys match Notification Engine's
    // SwapExecuted template (template-resolver.ts + email-templates.ts) —
    // amountIn/tokenInSymbol/tokenOutSymbol/txHash render into the email.
    await this.notification.notify({
      eventId: correlationId, eventType: "SwapExecuted", recipientAegisId: input.aegisId,
      payload: {
        txHash: finalTxHash,
        tokenIn: input.tokenIn,
        tokenOut: input.tokenOut,
        amountIn: input.amountInWei,
        netAmountWei: feeQuote.netAmountWei,
      },
    });

    // 9. Portfolio refresh — INTENTIONALLY SKIPPED. Portfolio Engine's
    // POST /api/v1/snapshot expects a full computed snapshot (totalValue,
    // availableValue, topHoldings across every wallet/token — see
    // portfolio-snapshot.entity.ts), which the Swap Engine has no way to
    // compute from a single trade. Calling it here with just
    // {lastSwapTxHash, lastSwapCorrelationId} would silently persist a
    // zeroed/fake snapshot into the user's real portfolio history — worse
    // than not calling it. Revisit once Portfolio Engine exposes a
    // lightweight "invalidate cache" endpoint instead of requiring a full
    // recomputed snapshot payload.

    return {
      correlationId,
      txHash: finalTxHash,
      status: "success",
      feeAmountWei: feeQuote.feeAmountWei,
      netAmountWei: feeQuote.netAmountWei,
      gasSponsored: gasResult.sponsored,
    };
  }
}

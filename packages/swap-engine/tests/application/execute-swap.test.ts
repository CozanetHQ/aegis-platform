import { describe, it, expect, vi } from "vitest";
import { ExecuteSwapUseCase } from "@/application/use-cases/execute-swap.use-case";
import type { WalletVaultClient, TreasuryClient, AuditClient, NotificationClient, PortfolioClient, WalletInfo } from "@/application/ports/engine-clients.port";
import type { PancakeSwapExecuteProvider } from "@/infrastructure/providers/pancakeswap-execute.provider";

function makeWallet(overrides: Partial<WalletInfo> = {}): WalletInfo {
  return { id: "wallet-1", aegisId: "aegis-1", blockchain: "BNB", address: "0xUSER", state: "ACTIVE", ...overrides };
}

function makeFakes(overrides: {
  wallets?: WalletInfo[];
  confirmStatus?: "success" | "reverted";
} = {}) {
  const walletVault: WalletVaultClient = {
    getWallets: vi.fn().mockResolvedValue(overrides.wallets ?? [makeWallet()]),
    signTransaction: vi.fn().mockResolvedValue("0xSIGNED"),
  };
  const treasury: TreasuryClient = {
    calculateFee: vi.fn().mockResolvedValue({ correlationId: "corr-1", feeAmountWei: "3000", netAmountWei: "997000" }),
    sponsorGasIfNeeded: vi.fn().mockResolvedValue({ sponsored: true, topUpTxHash: "0xTOPUP" }),
    recordTransaction: vi.fn().mockResolvedValue(undefined),
  };
  const audit: AuditClient = { emitEvent: vi.fn().mockResolvedValue(undefined) };
  const notification: NotificationClient = { notify: vi.fn().mockResolvedValue(undefined) };
  const portfolio: PortfolioClient = { refresh: vi.fn().mockResolvedValue(undefined) };
  const pancakeSwap = {
    buildUnsignedSwap: vi.fn().mockResolvedValue({ steps: [{ kind: "swap", unsignedTx: { to: "0xROUTER" } }] }),
    broadcastSignedTx: vi.fn().mockResolvedValue("0xSWAPTX"),
    waitForConfirmation: vi.fn().mockResolvedValue({ status: overrides.confirmStatus ?? "success", blockNumber: 123n }),
  } as unknown as PancakeSwapExecuteProvider;

  return { walletVault, treasury, audit, notification, portfolio, pancakeSwap };
}

const baseInput = {
  aegisId: "aegis-1", tokenIn: "0xTOKENA", tokenOut: "0xTOKENB",
  amountInWei: "1000000", minimumReceivedWei: "990000",
  route: ["0xTOKENA", "0xTOKENB"], quoteId: "quote-1",
};

describe("ExecuteSwapUseCase", () => {
  it("runs the full chain in order and returns a success result", async () => {
    const fakes = makeFakes();
    const uc = new ExecuteSwapUseCase(fakes.walletVault, fakes.treasury, fakes.audit, fakes.notification, fakes.portfolio, fakes.pancakeSwap);

    const result = await uc.execute(baseInput);

    expect(result.status).toBe("success");
    expect(result.txHash).toBe("0xSWAPTX");
    expect(result.feeAmountWei).toBe("3000");
    expect(result.gasSponsored).toBe(true);

    expect(fakes.walletVault.getWallets).toHaveBeenCalledWith("aegis-1");
    expect(fakes.treasury.calculateFee).toHaveBeenCalled();
    expect(fakes.treasury.sponsorGasIfNeeded).toHaveBeenCalled();
    expect(fakes.walletVault.signTransaction).toHaveBeenCalledWith("wallet-1", "aegis-1", { to: "0xROUTER" });
    expect(fakes.pancakeSwap.broadcastSignedTx).toHaveBeenCalledWith("0xSIGNED");
    expect(fakes.treasury.recordTransaction).toHaveBeenCalled();
    expect(fakes.audit.emitEvent).toHaveBeenCalled();
    expect(fakes.notification.notify).toHaveBeenCalled();
    // Portfolio refresh is intentionally NOT called — see the comment in
    // execute-swap.use-case.ts step 9. Calling Portfolio Engine's snapshot
    // endpoint with swap-only data would persist a fake zeroed snapshot.
    expect(fakes.portfolio.refresh).not.toHaveBeenCalled();
  });

  it("rejects when the identity has no BNB wallet", async () => {
    const fakes = makeFakes({ wallets: [] });
    const uc = new ExecuteSwapUseCase(fakes.walletVault, fakes.treasury, fakes.audit, fakes.notification, fakes.portfolio, fakes.pancakeSwap);
    await expect(uc.execute(baseInput)).rejects.toThrow(/no bnb wallet/i);
    expect(fakes.treasury.calculateFee).not.toHaveBeenCalled();
  });

  it("rejects when the wallet is not ACTIVE, and emits an audit event", async () => {
    const fakes = makeFakes({ wallets: [makeWallet({ state: "FROZEN" })] });
    const uc = new ExecuteSwapUseCase(fakes.walletVault, fakes.treasury, fakes.audit, fakes.notification, fakes.portfolio, fakes.pancakeSwap);
    await expect(uc.execute(baseInput)).rejects.toThrow(/FROZEN/);
    expect(fakes.audit.emitEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: "swap.wallet_not_active" }));
    expect(fakes.treasury.calculateFee).not.toHaveBeenCalled();
  });

  it("throws and audits when the on-chain transaction reverts, without recording a treasury transaction", async () => {
    const fakes = makeFakes({ confirmStatus: "reverted" });
    const uc = new ExecuteSwapUseCase(fakes.walletVault, fakes.treasury, fakes.audit, fakes.notification, fakes.portfolio, fakes.pancakeSwap);
    await expect(uc.execute(baseInput)).rejects.toThrow(/reverted/i);
    expect(fakes.treasury.recordTransaction).not.toHaveBeenCalled();
    expect(fakes.notification.notify).not.toHaveBeenCalled();
    expect(fakes.audit.emitEvent).toHaveBeenCalledWith(expect.objectContaining({ eventName: "swap.swap_reverted" }));
  });

  it("signs and broadcasts an approve step before the swap step when the plan includes one", async () => {
    const fakes = makeFakes();
    (fakes.pancakeSwap.buildUnsignedSwap as any).mockResolvedValue({
      steps: [
        { kind: "approve", unsignedTx: { to: "0xTOKENA" } },
        { kind: "swap", unsignedTx: { to: "0xROUTER" } },
      ],
    });
    const uc = new ExecuteSwapUseCase(fakes.walletVault, fakes.treasury, fakes.audit, fakes.notification, fakes.portfolio, fakes.pancakeSwap);
    const result = await uc.execute(baseInput);

    expect(fakes.walletVault.signTransaction).toHaveBeenCalledTimes(2);
    expect(fakes.pancakeSwap.broadcastSignedTx).toHaveBeenCalledTimes(2);
    expect(result.txHash).toBe("0xSWAPTX"); // final tx hash is the swap step's, not the approve's
  });
});

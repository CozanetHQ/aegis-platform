import { describe, it, expect, vi } from "vitest";
import { TreasuryUseCases } from "@/application/treasury-use-cases";
import { InMemoryTreasuryRepository } from "@/infrastructure/in-memory-treasury-repository";
import type { ChainClient } from "@/application/ports";

function makeFakeChain(overrides: Partial<ChainClient> = {}): ChainClient {
  return {
    getNativeBalanceWei: vi.fn().mockResolvedValue(0n),
    sendNativeTopUp: vi.fn().mockResolvedValue("0xFAKETXHASH"),
    getTreasuryAddress: () => "0xTREASURY",
    ...overrides,
  };
}

const feePolicy = { feeBps: 30, minFeeWei: 0n };
const gasPolicy = { thresholdWei: 2_000_000_000_000_000n, topUpWei: 3_000_000_000_000_000n, dailyCapWei: 50_000_000_000_000_000n };

describe("TreasuryUseCases.calculateSwapFee", () => {
  it("returns a fee quote with an expiry", () => {
    const uc = new TreasuryUseCases(new InMemoryTreasuryRepository(), makeFakeChain(), feePolicy, gasPolicy);
    const quote = uc.calculateSwapFee("aegis-1", 1_000_000n);
    expect(quote.feeAmountWei).toBe("3000");
    expect(quote.netAmountWei).toBe("997000");
    expect(new Date(quote.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("TreasuryUseCases.sponsorGasIfNeeded", () => {
  it("does nothing when the wallet already has enough native balance", async () => {
    const chain = makeFakeChain({ getNativeBalanceWei: vi.fn().mockResolvedValue(5_000_000_000_000_000n) });
    const uc = new TreasuryUseCases(new InMemoryTreasuryRepository(), chain, feePolicy, gasPolicy);
    const result = await uc.sponsorGasIfNeeded("aegis-1", "0xUSER");
    expect(result.sponsored).toBe(false);
    expect(chain.sendNativeTopUp).not.toHaveBeenCalled();
  });

  it("sends a top-up and records a ledger entry when balance is below threshold", async () => {
    const chain = makeFakeChain({ getNativeBalanceWei: vi.fn().mockResolvedValue(0n) });
    const repo = new InMemoryTreasuryRepository();
    const uc = new TreasuryUseCases(repo, chain, feePolicy, gasPolicy);
    const result = await uc.sponsorGasIfNeeded("aegis-1", "0xUSER");
    expect(result.sponsored).toBe(true);
    expect(result.topUpTxHash).toBe("0xFAKETXHASH");
    expect(chain.sendNativeTopUp).toHaveBeenCalledWith("0xUSER", gasPolicy.topUpWei);

    const ledger = await repo.listLedgerEntries({ aegisId: "aegis-1" });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe("GAS_SPONSORSHIP");
  });

  it("enforces the rolling 24h daily cap per aegisId", async () => {
    const chain = makeFakeChain({ getNativeBalanceWei: vi.fn().mockResolvedValue(0n) });
    const tightGasPolicy = { ...gasPolicy, dailyCapWei: 3_000_000_000_000_000n }; // exactly one top-up allowed
    const uc = new TreasuryUseCases(new InMemoryTreasuryRepository(), chain, feePolicy, tightGasPolicy);

    const first = await uc.sponsorGasIfNeeded("aegis-1", "0xUSER");
    expect(first.sponsored).toBe(true);

    await expect(uc.sponsorGasIfNeeded("aegis-1", "0xUSER")).rejects.toThrow(/daily cap/i);
  });
});

describe("TreasuryUseCases.recordTransaction + getLedger", () => {
  it("records a fee collection entry and it's retrievable via the ledger", async () => {
    const uc = new TreasuryUseCases(new InMemoryTreasuryRepository(), makeFakeChain(), feePolicy, gasPolicy);
    await uc.recordTransaction({
      aegisId: "aegis-2",
      correlationId: "11111111-1111-1111-1111-111111111111",
      chain: "BNB",
      txHash: "0xSWAPTX",
      feeAmountWei: "3000",
    });
    const ledger = await uc.getLedger({ aegisId: "aegis-2" });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe("FEE_COLLECTED");
    expect(ledger[0].txHash).toBe("0xSWAPTX");
  });
});

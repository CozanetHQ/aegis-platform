import { describe, it, expect } from "vitest";
import { calculateFee } from "@/domain/fee-policy";

describe("calculateFee", () => {
  it("calculates a standard bps fee", () => {
    const result = calculateFee(1_000_000n, { feeBps: 30, minFeeWei: 0n });
    expect(result.feeAmountWei).toBe(3_000n); // 0.30% of 1,000,000
    expect(result.netAmountWei).toBe(997_000n);
  });

  it("enforces the min fee floor", () => {
    const result = calculateFee(100n, { feeBps: 30, minFeeWei: 50n });
    expect(result.feeAmountWei).toBe(50n);
    expect(result.netAmountWei).toBe(50n);
  });

  it("never lets the fee exceed the swap amount", () => {
    const result = calculateFee(10n, { feeBps: 30, minFeeWei: 1000n });
    expect(result.feeAmountWei).toBe(10n);
    expect(result.netAmountWei).toBe(0n);
  });

  it("rejects zero or negative amounts", () => {
    expect(() => calculateFee(0n, { feeBps: 30, minFeeWei: 0n })).toThrow();
    expect(() => calculateFee(-5n, { feeBps: 30, minFeeWei: 0n })).toThrow();
  });

  it("rejects out-of-range bps", () => {
    expect(() => calculateFee(100n, { feeBps: -1, minFeeWei: 0n })).toThrow();
    expect(() => calculateFee(100n, { feeBps: 10_001, minFeeWei: 0n })).toThrow();
  });
});

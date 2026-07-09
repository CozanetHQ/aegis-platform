/**
 * fee-policy.ts — Pure fee calculation (Treasury Engine)
 * No I/O. Same convention as Payment Engine's fee calc (see aegis-payment-engine).
 */

export interface FeePolicyConfig {
  feeBps: number;      // basis points, e.g. 30 = 0.30%
  minFeeWei: bigint;
}

export interface FeeCalculationResult {
  feeAmountWei: bigint;
  netAmountWei: bigint;
}

export function calculateFee(swapAmountWei: bigint, config: FeePolicyConfig): FeeCalculationResult {
  if (swapAmountWei <= 0n) {
    throw new Error("swapAmountWei must be greater than 0");
  }
  if (config.feeBps < 0 || config.feeBps > 10_000) {
    throw new Error("feeBps must be between 0 and 10000");
  }

  let feeAmountWei = (swapAmountWei * BigInt(config.feeBps)) / 10_000n;
  if (feeAmountWei < config.minFeeWei) {
    feeAmountWei = config.minFeeWei;
  }
  if (feeAmountWei > swapAmountWei) {
    // Never let a min-fee floor exceed the swap amount itself.
    feeAmountWei = swapAmountWei;
  }

  return {
    feeAmountWei,
    netAmountWei: swapAmountWei - feeAmountWei,
  };
}

/**
 * engine.ts — Treasury Engine · Public Interface
 * The ONLY file other engines or API routes may import.
 */
import { TreasuryUseCases } from "./application/treasury-use-cases";
import { InMemoryTreasuryRepository } from "./infrastructure/in-memory-treasury-repository";
import { SupabaseTreasuryRepository } from "./infrastructure/supabase-treasury-repository";
import { ViemChainClient } from "./infrastructure/chain-client";
import type { TreasuryRepository } from "./application/ports";

// Real persistence when the shared Supabase project is configured (closed
// blocker #4, 2026-07-08); falls back to in-memory so this engine stays
// runnable/testable with zero external setup.
function buildRepository(): TreasuryRepository {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) return new SupabaseTreasuryRepository(url, key);
  console.warn("[treasury-engine] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY not set — using in-memory repository (data will not persist).");
  return new InMemoryTreasuryRepository();
}

const repo = buildRepository();
const chain = new ViemChainClient();

const feePolicy = {
  feeBps: Number(process.env.TREASURY_FEE_BPS ?? "30"),
  minFeeWei: BigInt(process.env.TREASURY_MIN_FEE_WEI ?? "0"),
};

const gasPolicy = {
  thresholdWei: BigInt(process.env.GAS_SPONSORSHIP_THRESHOLD_WEI ?? "2000000000000000"),
  topUpWei: BigInt(process.env.GAS_SPONSORSHIP_TOPUP_WEI ?? "3000000000000000"),
  dailyCapWei: BigInt(process.env.GAS_SPONSORSHIP_DAILY_CAP_WEI ?? "50000000000000000"),
};

export const TreasuryEngine = new TreasuryUseCases(repo, chain, feePolicy, gasPolicy);
export { currentNetworkInfo } from "./infrastructure/chain-client";

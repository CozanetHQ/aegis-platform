/**
 * czn-balance-reader.ts — AEGIS Identity Engine · Infrastructure Layer
 *
 * Reads a wallet's REAL on-chain CZN (Cozy Network) token balance from BNB
 * Smart Chain. This backs the CZN discount-tier feature used by Payment
 * Engine (BRONZE/SILVER/GOLD/PLATINUM fee discounts) — previously the
 * internal identity lookup route didn't return a balance at all, so Payment
 * Engine's client always defaulted to "0" and no user ever got a discount,
 * no matter how much CZN they actually held. This makes it real.
 *
 * Confirmed CZN contract address on BSC: 0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA
 * (9 decimals — matches Swap Engine's token list).
 */
import { createPublicClient, http, fallback } from "viem";

export const CZN_CONTRACT_BSC = "0xE470E53147E199E6a6C02a50473fF8E84bD2d2CA" as const;
export const CZN_DECIMALS = 9;

const ERC20_BALANCE_OF_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function getRpcUrls(): string[] {
  return (process.env.BSC_RPC_URLS ?? "https://bsc-dataseed.binance.org/")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getClient() {
  const urls = getRpcUrls();
  return createPublicClient({
    chain: {
      id: Number(process.env.BSC_CHAIN_ID ?? "56"),
      name: "BNB Smart Chain",
      nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
      rpcUrls: { default: { http: urls }, public: { http: urls } },
    },
    transport: fallback(urls.map((u) => http(u, { timeout: 8_000 }))),
  });
}

/**
 * Returns the wallet's raw CZN balance (smallest unit, as a decimal string)
 * for a given BSC address. Returns "0" on any RPC failure rather than
 * throwing — a balance-read failure should never break identity lookups
 * used by every other engine; worst case a user's discount tier is
 * temporarily under-computed, not that transfers/logins break.
 */
export async function getCznBalance(address: string): Promise<string> {
  try {
    const client = getClient();
    const balance = await client.readContract({
      address: CZN_CONTRACT_BSC,
      abi: ERC20_BALANCE_OF_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return balance.toString();
  } catch (e) {
    console.error("[czn-balance-reader] failed to read CZN balance for", address, e);
    return "0";
  }
}

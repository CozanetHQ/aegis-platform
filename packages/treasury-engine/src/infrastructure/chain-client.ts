/**
 * chain-client.ts — Viem-based BNB Smart Chain client (Treasury Engine)
 *
 * Network is configurable via env vars (BSC_CHAIN_ID / BSC_RPC_URLS) so
 * testnet (chainId 97, e.g. https://data-seed-prebsc-1-s1.binance.org:8545/)
 * can be enabled later with zero code changes — mainnet (chainId 56) is the
 * configured default per the owner's Phase 1 target.
 */
import { createPublicClient, createWalletClient, http, fallback, parseGwei } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Chain } from "viem";
import { AegisError } from "@cozanethq/aegis-shared-sdk";
import type { ChainClient } from "../application/ports";

function getChainConfig(): Chain {
  const chainId = Number(process.env.BSC_CHAIN_ID ?? "56");
  const rpcUrls = (process.env.BSC_RPC_URLS ?? "https://bsc-dataseed.binance.org/").split(",").map((s) => s.trim()).filter(Boolean);
  const isTestnet = chainId === 97;
  return {
    id: chainId,
    name: isTestnet ? "BNB Smart Chain Testnet" : "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: rpcUrls }, public: { http: rpcUrls } },
  } as Chain;
}

function getTreasuryAccount() {
  const pk = process.env.TREASURY_HOT_WALLET_PRIVATE_KEY;
  if (!pk) {
    throw new AegisError("TREASURY_WALLET_NOT_CONFIGURED", "TREASURY_HOT_WALLET_PRIVATE_KEY not configured on server", 500);
  }
  return privateKeyToAccount(pk as `0x${string}`);
}

export class ViemChainClient implements ChainClient {
  private readonly chain: Chain;

  constructor() {
    this.chain = getChainConfig();
  }

  private publicClient() {
    const urls = this.chain.rpcUrls.default.http;
    return createPublicClient({ chain: this.chain, transport: fallback(urls.map((u) => http(u, { timeout: 8_000 }))) });
  }

  private walletClient() {
    const urls = this.chain.rpcUrls.default.http;
    return createWalletClient({ chain: this.chain, transport: fallback(urls.map((u) => http(u, { timeout: 8_000 }))), account: getTreasuryAccount() });
  }

  getTreasuryAddress(): string {
    return getTreasuryAccount().address;
  }

  async getNativeBalanceWei(address: string): Promise<bigint> {
    return this.publicClient().getBalance({ address: address as `0x${string}` });
  }

  async sendNativeTopUp(toAddress: string, amountWei: bigint): Promise<string> {
    const client = this.walletClient();
    try {
      const hash = await client.sendTransaction({
        to: toAddress as `0x${string}`,
        value: amountWei,
      });
      return hash;
    } catch (e) {
      throw new AegisError(
        "GAS_SPONSORSHIP_BROADCAST_FAILED",
        `Failed to broadcast treasury top-up transaction: ${e instanceof Error ? e.message : "unknown error"}`,
        502,
      );
    }
  }
}

export function currentNetworkInfo() {
  const chainId = Number(process.env.BSC_CHAIN_ID ?? "56");
  return { chainId, isMainnet: chainId === 56, isTestnet: chainId === 97 };
}

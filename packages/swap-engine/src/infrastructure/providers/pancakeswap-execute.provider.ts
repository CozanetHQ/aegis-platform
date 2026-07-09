/**
 * pancakeswap-execute.provider.ts — Swap Engine · Infrastructure
 *
 * Phase 2: builds the unsigned PancakeSwap V2 transaction, broadcasts the
 * signed raw transaction, and polls for confirmation. This is the piece the
 * engine's own docs (engine.ts, pancakeswap-swap.provider.ts) explicitly
 * called "not yet built" before this pass.
 *
 * Network is configurable via BSC_CHAIN_ID / BSC_RPC_URLS env vars — mainnet
 * (56) is the default per the Phase 1 target; set BSC_CHAIN_ID=97 to run
 * against BSC Testnet with zero code changes.
 */
import { createPublicClient, http, fallback, encodeFunctionData, type Chain } from "viem";
import { AegisError } from "@cozanethq/aegis-shared-sdk";

export const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E" as const;
export const WBNB_CONTRACT = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as const;
/** Convention used by many DEX aggregators to represent "native coin" in a token-pair path. */
export const NATIVE_BNB_SENTINEL = "0xEeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeE" as const;

const ROUTER_ABI = [
  {
    name: "swapExactETHForTokens", type: "function", stateMutability: "payable",
    inputs: [{ name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForETH", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "amountIn", type: "uint256" }, { name: "amountOutMin", type: "uint256" }, { name: "path", type: "address[]" }, { name: "to", type: "address" }, { name: "deadline", type: "uint256" }],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ name: "", type: "bool" }] },
] as const;

export interface UnsignedTxPlan {
  /** One or two txs — an ERC20 approve (if needed) followed by the swap itself. */
  steps: Array<{ kind: "approve" | "swap"; unsignedTx: Record<string, unknown> }>;
}

function getChain(): Chain {
  const chainId = Number(process.env.BSC_CHAIN_ID ?? "56");
  const rpcUrls = (process.env.BSC_RPC_URLS ?? "https://bsc-dataseed.binance.org/").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    id: chainId,
    name: chainId === 97 ? "BNB Smart Chain Testnet" : "BNB Smart Chain",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: { default: { http: rpcUrls }, public: { http: rpcUrls } },
  } as Chain;
}

function publicClient() {
  const chain = getChain();
  return createPublicClient({ chain, transport: fallback(chain.rpcUrls.default.http.map((u) => http(u, { timeout: 10_000 }))) });
}

export class PancakeSwapExecuteProvider {
  /**
   * Builds the plan of one or two unsigned transactions needed to execute this
   * swap from `fromAddress`: an ERC20 approve (skipped for native BNB in, and
   * skipped if allowance is already sufficient) followed by the swap call.
   */
  async buildUnsignedSwap(input: {
    fromAddress: string;
    tokenIn: string;
    tokenOut: string;
    amountInWei: bigint;
    minimumReceivedWei: bigint;
    route: string[];
    deadlineSeconds?: number;
  }): Promise<UnsignedTxPlan> {
    const client = publicClient();
    const chain = getChain();
    const isNativeIn = input.tokenIn.toLowerCase() === NATIVE_BNB_SENTINEL.toLowerCase();
    const isNativeOut = input.tokenOut.toLowerCase() === NATIVE_BNB_SENTINEL.toLowerCase();
    const deadline = BigInt(Math.floor(Date.now() / 1000) + (input.deadlineSeconds ?? 600));

    const steps: UnsignedTxPlan["steps"] = [];
    let nonce = await client.getTransactionCount({ address: input.fromAddress as `0x${string}`, blockTag: "pending" });
    const gasPrice = await client.getGasPrice();

    if (!isNativeIn) {
      const allowance = await client.readContract({
        address: input.tokenIn as `0x${string}`, abi: ERC20_ABI, functionName: "allowance",
        args: [input.fromAddress as `0x${string}`, PANCAKE_ROUTER_V2],
      }) as bigint;

      if (allowance < input.amountInWei) {
        const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [PANCAKE_ROUTER_V2, input.amountInWei] });
        steps.push({
          kind: "approve",
          unsignedTx: {
            type: "legacy", chainId: chain.id, nonce, gasPrice, gas: 60_000n,
            to: input.tokenIn, value: 0n, data: approveData,
          },
        });
        nonce += 1;
      }
    }

    let swapData: `0x${string}`;
    let value = 0n;
    if (isNativeIn) {
      swapData = encodeFunctionData({
        abi: ROUTER_ABI, functionName: "swapExactETHForTokens",
        args: [input.minimumReceivedWei, input.route as `0x${string}`[], input.fromAddress as `0x${string}`, deadline],
      });
      value = input.amountInWei;
    } else if (isNativeOut) {
      swapData = encodeFunctionData({
        abi: ROUTER_ABI, functionName: "swapExactTokensForETH",
        args: [input.amountInWei, input.minimumReceivedWei, input.route as `0x${string}`[], input.fromAddress as `0x${string}`, deadline],
      });
    } else {
      swapData = encodeFunctionData({
        abi: ROUTER_ABI, functionName: "swapExactTokensForTokens",
        args: [input.amountInWei, input.minimumReceivedWei, input.route as `0x${string}`[], input.fromAddress as `0x${string}`, deadline],
      });
    }

    steps.push({
      kind: "swap",
      unsignedTx: {
        type: "legacy", chainId: chain.id, nonce, gasPrice, gas: 260_000n,
        to: PANCAKE_ROUTER_V2, value, data: swapData,
      },
    });

    return { steps };
  }

  async broadcastSignedTx(signedTx: string): Promise<string> {
    const client = publicClient();
    try {
      return await client.sendRawTransaction({ serializedTransaction: signedTx as `0x${string}` });
    } catch (e) {
      throw new AegisError("SWAP_BROADCAST_FAILED", `Failed to broadcast swap transaction: ${e instanceof Error ? e.message : "unknown error"}`, 502);
    }
  }

  /** Polls for the transaction receipt. Throws SWAP_CONFIRMATION_TIMEOUT if it doesn't confirm in time. */
  async waitForConfirmation(txHash: string, timeoutMs = 60_000, pollIntervalMs = 2_000): Promise<{ status: "success" | "reverted"; blockNumber: bigint }> {
    const client = publicClient();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
        if (receipt) {
          return { status: receipt.status === "success" ? "success" : "reverted", blockNumber: receipt.blockNumber };
        }
      } catch {
        // not mined yet — keep polling
      }
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    throw new AegisError("SWAP_CONFIRMATION_TIMEOUT", `Transaction ${txHash} did not confirm within ${timeoutMs}ms`, 504);
  }
}

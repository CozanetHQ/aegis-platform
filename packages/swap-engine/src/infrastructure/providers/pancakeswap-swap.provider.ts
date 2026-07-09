/**
 * pancakeswap-swap.provider.ts — Payment Engine · Infrastructure
 *
 * Read-only on-chain quoting for arbitrary BSC token pairs via the
 * PancakeSwap V2 Router's `getAmountsOut`. Same technique as the Market
 * Engine's pancakeswap.provider.ts (CZN price feed), generalized to any
 * two tokens and any input amount instead of a single fixed "price this
 * one token in USDT" case.
 *
 * This does NOT sign or broadcast anything — quoting only. No private
 * keys, no wallet-vault involvement. Swap execution (actually moving a
 * user's funds) is intentionally not implemented here yet — see
 * get-swap-quote.use-case.ts for why.
 */

const PANCAKE_ROUTER_V2 = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
export const WBNB_CONTRACT = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // verified BSC WBNB

const BSC_RPCS = [
  "https://bsc-dataseed.binance.org/",
  "https://bsc-dataseed1.defibit.io/",
  "https://bsc.publicnode.com",
  "https://rpc.ankr.com/bsc",
];

const GET_AMOUNTS_OUT_SELECTOR = "0xd06ca61f";

function encodeGetAmountsOut(amountIn: bigint, path: string[]): string {
  let data = GET_AMOUNTS_OUT_SELECTOR;
  data += "0000000000000000000000000000000000000000000000000000000000000040";
  data += amountIn.toString(16).padStart(64, "0");
  data += path.length.toString(16).padStart(64, "0");
  for (const addr of path) {
    data += addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  }
  return data;
}

function decodeAmountsOut(hexResponse: string): bigint[] {
  const hex = hexResponse.replace(/^0x/, "");
  const offset = parseInt(hex.slice(0, 64), 16);
  const arrStart = offset * 2;
  const arrLen = parseInt(hex.slice(arrStart, arrStart + 64), 16);
  const amounts: bigint[] = [];
  for (let i = 0; i < arrLen; i++) {
    const start = arrStart + 64 + i * 64;
    amounts.push(BigInt("0x" + hex.slice(start, start + 64)));
  }
  return amounts;
}

async function ethCall(to: string, data: string): Promise<string> {
  let lastError: Error | null = null;
  for (const rpc of BSC_RPCS) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.error) { lastError = new Error(json.error.message); continue; }
      if (json.result && json.result !== "0x") return json.result;
    } catch (e) {
      lastError = e as Error;
      continue;
    }
  }
  throw lastError ?? new Error("All BSC RPCs failed");
}

export interface SwapQuoteResult {
  amountOut: bigint;
  route: string[];
}

export class PancakeSwapSwapProvider {
  /**
   * Tries a direct pair first (tokenIn -> tokenOut). If PancakeSwap has
   * no direct liquidity pool for that pair, falls back to routing
   * through WBNB (tokenIn -> WBNB -> tokenOut), the standard PancakeSwap
   * routing convention for pairs without a direct pool.
   */
  async getAmountsOut(amountIn: bigint, tokenIn: string, tokenOut: string): Promise<SwapQuoteResult> {
    if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
      throw new Error("tokenIn and tokenOut must be different");
    }

    try {
      const directPath = [tokenIn, tokenOut];
      const data = encodeGetAmountsOut(amountIn, directPath);
      const result = await ethCall(PANCAKE_ROUTER_V2, data);
      const amounts = decodeAmountsOut(result);
      if (amounts.length >= 2 && amounts[amounts.length - 1] > 0n) {
        return { amountOut: amounts[amounts.length - 1], route: directPath };
      }
    } catch {
      // No direct pool — fall through to routed path.
    }

    const routedPath = [tokenIn, WBNB_CONTRACT, tokenOut];
    const data = encodeGetAmountsOut(amountIn, routedPath);
    const result = await ethCall(PANCAKE_ROUTER_V2, data);
    const amounts = decodeAmountsOut(result);
    if (amounts.length < 3 || amounts[amounts.length - 1] <= 0n) {
      throw new Error("No liquidity for this pair");
    }
    return { amountOut: amounts[amounts.length - 1], route: routedPath };
  }
}

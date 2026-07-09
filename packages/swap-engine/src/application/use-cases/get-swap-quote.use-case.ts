/**
 * get-swap-quote.use-case.ts — Payment Engine · Application Layer
 *
 * Read-only PancakeSwap V2 quote for a token pair + amount. No funds
 * move here — this only reads on-chain router state (getAmountsOut) to
 * tell the user what they'd get. Swap EXECUTION (actually signing +
 * broadcasting the swap) is a separate, not-yet-built concern — see the
 * architecture note in engine.ts.
 */
import { v4 as uuidv4 } from "uuid";
import { PancakeSwapSwapProvider } from "../../infrastructure/providers/pancakeswap-swap.provider";

export interface GetSwapQuoteInput {
  tokenIn: string;
  tokenOut: string;
  amountIn: string; // wei, as a string (BigInt-safe)
  decimalsIn: number;
  decimalsOut: number;
  slippageBps?: number;
}

export interface SwapQuoteResult {
  quote_id: string;
  provider: string;
  amount_in: string;
  estimated_amount_out: string;
  minimum_received: string;
  price_impact: number;
  slippage: string;
  transaction_fee: string;
  estimated_confirm_time: number;
  expires_at: string;
  route: string[];
}

const QUOTE_TTL_SECONDS = 30;
// Typical gas cost for a 2-hop PancakeSwap V2 swap. Used only to give the
// user a fee estimate up front — the real gas used at execution time can
// differ slightly depending on the final route/hop count.
const ESTIMATED_SWAP_GAS_UNITS = 180_000n;

async function fetchGasPriceWei(): Promise<bigint> {
  const rpcs = [
    "https://bsc-dataseed.binance.org/",
    "https://bsc.publicnode.com",
  ];
  for (const rpc of rpcs) {
    try {
      const res = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_gasPrice", params: [] }),
        signal: AbortSignal.timeout(4000),
      });
      const json = await res.json();
      if (json.result) return BigInt(json.result);
    } catch {
      continue;
    }
  }
  // Fallback: BSC's floor gas price is enforced at 1 gwei by validators.
  return 1_000_000_000n;
}

export class GetSwapQuoteUseCase {
  constructor(private provider: PancakeSwapSwapProvider) {}

  async execute(input: GetSwapQuoteInput): Promise<SwapQuoteResult> {
    const amountIn = BigInt(input.amountIn);
    if (amountIn <= 0n) throw new Error("amountIn must be greater than 0");
    const slippageBps = input.slippageBps ?? 200; // default 2%

    const { amountOut, route } = await this.provider.getAmountsOut(amountIn, input.tokenIn, input.tokenOut);

    // Price impact: compare the execution rate for this trade size against
    // the "spot" rate quoted for a tiny reference amount on the same route.
    let priceImpact = 0;
    try {
      const referenceIn = BigInt(10 ** Math.min(input.decimalsIn, 6)); // a small, non-zero reference amount
      if (referenceIn < amountIn) {
        const { amountOut: referenceOut } = await this.provider.getAmountsOut(referenceIn, input.tokenIn, input.tokenOut);
        const spotRate = Number(referenceOut) / Number(referenceIn);
        const execRate = Number(amountOut) / Number(amountIn);
        if (spotRate > 0) {
          priceImpact = Math.max(0, ((spotRate - execRate) / spotRate) * 100);
        }
      }
    } catch {
      // Reference quote failing shouldn't block the main quote — just report 0.
      priceImpact = 0;
    }

    const minimumReceived = (amountOut * BigInt(10_000 - slippageBps)) / 10_000n;
    const gasPriceWei = await fetchGasPriceWei();
    const transactionFee = gasPriceWei * ESTIMATED_SWAP_GAS_UNITS;

    return {
      quote_id: uuidv4(),
      provider: "pancakeswap_v2",
      amount_in: amountIn.toString(),
      estimated_amount_out: amountOut.toString(),
      minimum_received: minimumReceived.toString(),
      price_impact: Number(priceImpact.toFixed(4)),
      slippage: `${(slippageBps / 100).toFixed(2)}%`,
      transaction_fee: transactionFee.toString(),
      estimated_confirm_time: 6,
      expires_at: new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString(),
      route,
    };
  }
}

export const dynamic = "force-dynamic";

import { SwapEngine } from "@/engine";
import { requireAuth, validateBody, err, ok } from "@cozanethq/aegis-shared-sdk";
import { z } from "zod";

const SwapQuoteSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountIn: z.string().min(1),
  decimalsIn: z.number().int().min(0).max(18),
  decimalsOut: z.number().int().min(0).max(18),
  chainId: z.number().int().optional(),
  slippageBps: z.number().int().min(1).max(5000).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAuth(request);
    const body = await validateBody(request, SwapQuoteSchema);

    const quote = await SwapEngine.getSwapQuote({
      tokenIn: body.tokenIn,
      tokenOut: body.tokenOut,
      amountIn: body.amountIn,
      decimalsIn: body.decimalsIn,
      decimalsOut: body.decimalsOut,
      slippageBps: body.slippageBps,
    });

    return ok(quote);
  } catch (error) {
    return err(error);
  }
}

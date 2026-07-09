/**
 * POST /api/v1/treasury/calculate-fee — called by Swap/Transfer/Payment engines.
 * Engine-to-engine auth via X-Treasury-API-Key.
 */
export const dynamic = "force-dynamic";
import { z } from "zod";
import { validateBody, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { TreasuryEngine } from "@/engine";

const Schema = z.object({
  aegisId: z.string().min(1),
  swapAmountWei: z.string().min(1),
  correlationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, "x-treasury-api-key", [
      process.env.TREASURY_ENGINE_API_KEY,
    ]);
    const body = await validateBody(request, Schema);
    const quote = TreasuryEngine.calculateSwapFee(body.aegisId, BigInt(body.swapAmountWei), body.correlationId);
    return ok(quote);
  } catch (e) {
    return err(e);
  }
}

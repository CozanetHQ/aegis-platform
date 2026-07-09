/**
 * POST /api/v1/treasury/sponsor-gas — called by Swap Engine before broadcasting
 * a user transaction. Tops up the user's native balance from the treasury hot
 * wallet if it's below the configured gas threshold. Engine-to-engine auth via
 * X-Treasury-API-Key.
 */
export const dynamic = "force-dynamic";
import { z } from "zod";
import { validateBody, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { TreasuryEngine } from "@/engine";

const Schema = z.object({
  aegisId: z.string().min(1),
  userWalletAddress: z.string().min(1),
  correlationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, "x-treasury-api-key", [
      process.env.TREASURY_ENGINE_API_KEY,
    ]);
    const body = await validateBody(request, Schema);
    const result = await TreasuryEngine.sponsorGasIfNeeded(body.aegisId, body.userWalletAddress, body.correlationId);
    return ok(result);
  } catch (e) {
    return err(e);
  }
}

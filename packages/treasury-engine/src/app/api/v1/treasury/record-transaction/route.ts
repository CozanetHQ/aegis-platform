/**
 * POST /api/v1/treasury/record-transaction — called by Swap Engine after a
 * swap has confirmed on-chain, to record the fee collection against the real
 * final tx hash. Engine-to-engine auth via X-Treasury-API-Key.
 */
export const dynamic = "force-dynamic";
import { z } from "zod";
import { validateBody, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { TreasuryEngine } from "@/engine";

const Schema = z.object({
  aegisId: z.string().min(1),
  correlationId: z.string().uuid(),
  chain: z.string().min(1),
  txHash: z.string().min(1),
  feeAmountWei: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, "x-treasury-api-key", [
      process.env.TREASURY_ENGINE_API_KEY,
    ]);
    const body = await validateBody(request, Schema);
    const entry = await TreasuryEngine.recordTransaction(body);
    return ok({ entry }, 201);
  } catch (e) {
    return err(e);
  }
}

/**
 * POST /api/v1/swap/execute — Phase 2: actually signs and broadcasts the
 * trade. User-facing (real Supabase session via requireAuth), reached
 * through the Gateway's existing generic swap proxy — no Gateway change
 * needed (see aegis-gateway src/config/engines.json "swap" entry).
 */
export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireAuth, validateBody, ok, err } from "@cozanethq/aegis-shared-sdk";
import { SwapEngine } from "@/engine";

const ExecuteSchema = z.object({
  tokenIn: z.string().min(1),
  tokenOut: z.string().min(1),
  amountInWei: z.string().min(1),
  minimumReceivedWei: z.string().min(1),
  route: z.array(z.string().min(1)).min(2),
  quoteId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.aegisId) throw new Error("No Aegis ID on this identity");
    const body = await validateBody(request, ExecuteSchema);

    const result = await SwapEngine.executeSwap({ aegisId: auth.aegisId, ...body });
    return ok(result);
  } catch (error) {
    return err(error);
  }
}

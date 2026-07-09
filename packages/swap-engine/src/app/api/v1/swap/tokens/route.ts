export const dynamic = "force-dynamic";

import { SwapEngine } from "@/engine";
import { requireAuth, err, ok } from "@cozanethq/aegis-shared-sdk";

export async function GET(request: Request) {
  try {
    await requireAuth(request);
    const tokens = await SwapEngine.getSwapTokens();
    return ok({ tokens });
  } catch (error) {
    return err(error);
  }
}

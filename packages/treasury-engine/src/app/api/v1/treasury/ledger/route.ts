/**
 * GET /api/v1/treasury/ledger?aegisId=&type=&limit= — engine-to-engine or
 * admin tooling read of the treasury ledger. Auth via X-Treasury-API-Key.
 */
export const dynamic = "force-dynamic";
import { requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { TreasuryEngine } from "@/engine";

export async function GET(request: Request) {
  try {
    requireEngineApiKey(request, "x-treasury-api-key", [
      process.env.TREASURY_ENGINE_API_KEY,
    ]);
    const { searchParams } = new URL(request.url);
    const entries = await TreasuryEngine.getLedger({
      aegisId: searchParams.get("aegisId") ?? undefined,
      type: (searchParams.get("type") as any) ?? undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined,
    });
    return ok({ entries });
  } catch (e) {
    return err(e);
  }
}

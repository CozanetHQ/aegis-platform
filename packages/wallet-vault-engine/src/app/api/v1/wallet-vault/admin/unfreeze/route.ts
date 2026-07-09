import { z } from "zod";
import { validateBody, requireAdmin, ok, err } from "@cozanethq/aegis-shared-sdk";
import { WalletVaultEngine } from "@/engine";

const UnfreezeSchema = z.object({
  walletId: z.string().uuid(),
  reason:   z.string().min(1).max(500),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(request);
    const body  = await validateBody(request, UnfreezeSchema);
    await WalletVaultEngine.unfreezeWallet(body.walletId, body.reason, admin.userId);
    return ok({ unfrozen: true });
  } catch (e) {
    return err(e);
  }
}

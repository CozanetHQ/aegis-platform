/**
 * POST /api/v1/wallet-vault/generate — called by Identity Engine during onboarding.
 * Engine-to-engine auth via X-Vault-API-Key. Idempotent.
 */
import { z } from "zod";
import { validateBody, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { WalletVaultEngine } from "@/engine";

const GenerateSchema = z.object({
  aegisId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, "x-vault-api-key", process.env.WALLET_VAULT_API_KEY);
    const body = await validateBody(request, GenerateSchema);
    const wallets = await WalletVaultEngine.generateWalletsForIdentity(body.aegisId);
    return ok({ wallets });
  } catch (e) {
    return err(e);
  }
}

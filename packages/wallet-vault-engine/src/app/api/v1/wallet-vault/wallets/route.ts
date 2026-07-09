/**
 * GET /api/v1/wallet-vault/wallets?aegisId=... — public wallet info only, never key material.
 * Called by Identity/Transfer/Payment engines. Engine-to-engine auth via X-Vault-API-Key.
 */
import { z } from "zod";
import { validateParams, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { WalletVaultEngine } from "@/engine";

const QuerySchema = z.object({
  aegisId: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    requireEngineApiKey(request, "x-vault-api-key", [
      process.env.WALLET_VAULT_API_KEY,          // Identity Engine, Gateway, Portfolio Engine, Treasury Engine
      process.env.WALLET_VAULT_API_KEY_TRANSFER, // Transfer Engine — own credential
    ]);
    const { searchParams } = new URL(request.url);
    const query = validateParams(searchParams, QuerySchema);
    const wallets = await WalletVaultEngine.getWallets(query.aegisId);
    return ok({ wallets });
  } catch (e) {
    return err(e);
  }
}

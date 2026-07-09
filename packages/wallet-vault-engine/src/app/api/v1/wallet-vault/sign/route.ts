/**
 * POST /api/v1/wallet-vault/sign — called by Transfer Engine to sign an outbound tx.
 * Engine-to-engine auth via X-Vault-API-Key. Enforces wallet ownership + ACTIVE state.
 */
import { z } from "zod";
import { validateBody, requireEngineApiKey, ok, err } from "@cozanethq/aegis-shared-sdk";
import { WalletVaultEngine } from "@/engine";

const SignSchema = z.object({
  walletId:   z.string().uuid(),
  aegisId:    z.string().min(1),
  unsignedTx: z.record(z.unknown()),
});

export async function POST(request: Request) {
  try {
    requireEngineApiKey(request, "x-vault-api-key", [
      process.env.WALLET_VAULT_API_KEY,          // Identity Engine, Gateway, Portfolio Engine, Treasury Engine
      process.env.WALLET_VAULT_API_KEY_TRANSFER, // Transfer Engine — own credential
      process.env.WALLET_VAULT_API_KEY_SWAP,     // Swap Engine — own credential (Phase 1 execute chain, 2026-07-08)
    ]);
    const body = await validateBody(request, SignSchema);
    const signedTx = await WalletVaultEngine.signTransaction(body.walletId, body.aegisId, body.unsignedTx);
    return ok({ signedTx });
  } catch (e) {
    return err(e);
  }
}

/**
 * GET /api/v1/identity/internal/:aegis_id — Engine-to-engine identity lookup
 *
 * NEW — added during repo-per-engine migration. This wraps the ALREADY-BUILT
 * resolveRecipient() use case (previously exposed on the IdentityEngine facade
 * but never wired to a route). No business logic added here — this is purely
 * an integration contract for other engines (Transfer, Payment, Business, AI)
 * to look up an Aegis ID's state + wallet mappings without going through the
 * public-safe /api/v1/identity/:aegis_id endpoint.
 *
 * Auth: X-Identity-API-Key (bilateral engine trust, timing-safe comparison).
 * NOTE: kycLevel is not yet tracked by Identity Engine — callers should treat
 * it as a stub (always 1) until KYC tracking is built. Flagged as a known gap.
 *
 * UPDATED 2026-07-03: Now includes email in the success response so the
 * Notification Engine can resolve contact info without depending on
 * event payloads carrying it.
 *
 * UPDATED 2026-07-09: Now includes a REAL on-chain cznBalance (read live
 * from the CZN BEP-20 contract on BSC for the user's primary BNB wallet).
 * Previously this field didn't exist at all, so Payment Engine's CZN
 * discount-tier feature silently defaulted every user to "0" balance /
 * NONE tier forever, regardless of actual holdings. Fixed.
 */
export const dynamic = "force-dynamic";

import { requireEngineApiKey } from "@cozanethq/aegis-shared-sdk";
import { ok, err }             from "@cozanethq/aegis-shared-sdk";
import { AegisError }          from "@cozanethq/aegis-shared-sdk";
import { AegisIdGenerator }    from "@/domain/aegis-id-generator";
import { IdentityEngine }      from "@/engine";
import { getCznBalance }       from "@/infrastructure/czn-balance-reader";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ aegis_id: string }> }
) {
  try {
    requireEngineApiKey(request, "x-identity-api-key", [
      process.env.IDENTITY_ENGINE_API_KEY,          // Payment Engine, Notification Engine
      process.env.IDENTITY_ENGINE_API_KEY_TRANSFER, // Transfer Engine — own credential
    ]);

    const { aegis_id } = await params;
    if (!AegisIdGenerator.isValid(aegis_id)) {
      throw new AegisError("VALIDATION_ERROR", "Invalid Aegis ID format", 400);
    }

    const result = await IdentityEngine.resolveRecipient(aegis_id);

    if ("reason" in result) {
      return ok({
        found:    false,
        aegisId:  aegis_id,
        state:    result.reason,
        kycLevel: 1, // stub — Identity Engine does not track KYC levels yet
      });
    }

    const primaryWallet = result.wallets.find(w => w.isPrimary) ?? result.wallets[0];
    const bnbWallet = result.wallets.find(w => w.blockchain === "BNB" && w.isPrimary)
      ?? result.wallets.find(w => w.blockchain === "BNB");
    const cznBalance = bnbWallet ? await getCznBalance(bnbWallet.address) : "0";

    return ok({
      found:         true,
      aegisId:       result.aegisId,
      email:         result.email,
      state:         "ACTIVE",
      walletVaultId: primaryWallet?.walletVaultId ?? null,
      wallets:       result.wallets.map(w => ({
        walletVaultId: w.walletVaultId,
        blockchain:    w.blockchain,
        address:       w.address,
        isPrimary:     w.isPrimary,
      })),
      kycLevel:      1, // stub — Identity Engine does not track KYC levels yet
      cznBalance,       // raw units, 9 decimals — real on-chain BEP-20 balanceOf()
    });
  } catch (e) {
    return err(e);
  }
}

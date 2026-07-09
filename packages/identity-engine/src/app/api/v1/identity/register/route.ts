/**
 * POST /api/v2/identity/register
 *
 * Creates an identity skeleton immediately after Supabase Auth user creation.
 * Called by the frontend auth flow right after signUp() resolves.
 *
 * FIX: Removed aegisId from input — the engine generates it internally now.
 *      Route callers must never dictate domain IDs.
 *
 * Rate limited: 5 requests per IP per hour (enforced inside IdentityUseCases).
 * Idempotent: calling twice for the same authProviderId returns IDENTITY_EMAIL_EXISTS.
 */
export const dynamic = "force-dynamic";

import { z }                        from "zod";
import { validateBody }             from "@cozanethq/aegis-shared-sdk";
import { requireAuth, getClientIp } from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine }           from "@/engine";
import { ok, err }                  from "@cozanethq/aegis-shared-sdk";

const Schema = z.object({
  accountType: z
    .enum(["INDIVIDUAL", "BUSINESS", "ORGANIZATION", "DEVELOPER", "MERCHANT", "SUBSCRIPTION", "AI_ASSISTANT"])
    .optional()
    .default("INDIVIDUAL"),
});

export async function POST(request: Request) {
  try {
    const auth   = await requireAuth(request);
    const body   = await validateBody(request, Schema);
    const ip     = getClientIp(request);

    const identity = await IdentityEngine.createIdentity({
      authProviderId: auth.userId,
      email:          auth.email,
      accountType:    body.accountType,
      ipAddress:      ip,
    });

    return ok({ aegisId: identity.aegisId, state: identity.state }, 201);
  } catch (e) {
    return err(e);
  }
}

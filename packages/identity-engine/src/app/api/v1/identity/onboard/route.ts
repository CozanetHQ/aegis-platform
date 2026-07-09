/**
 * POST /api/v2/identity/onboard
 *
 * Completes onboarding: saves profile + generates wallets → transitions to ACTIVE.
 * Called once after email verification. State must be EMAIL_VERIFIED.
 */
export const dynamic = "force-dynamic";

import { z }                from "zod";
import { requireAuth }      from "@cozanethq/aegis-shared-sdk";
import { validateBody }     from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine }   from "@/engine";
import { ok, err }          from "@cozanethq/aegis-shared-sdk";

const Schema = z.object({
  fullName:     z.string().min(1).max(100).optional(),
  username:     z.string().regex(/^[a-zA-Z0-9_]{3,30}$/, "Username must be 3–30 alphanumeric characters").optional(),
  countryCode:  z.string().regex(/^[A-Z]{2}$/, "Must be ISO 3166-1 alpha-2").optional(),
  languageCode: z.string().max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const auth   = await requireAuth(request);
    const body   = await validateBody(request, Schema);
    const result = await IdentityEngine.completeOnboarding({
      authProviderId: auth.userId,
      ...body,
    });
    return ok({ wallets: result.wallets });
  } catch (e) {
    return err(e);
  }
}

/**
 * POST /api/v2/identity/verify-email
 *
 * Transitions identity PENDING_REGISTRATION → EMAIL_VERIFIED.
 * Called by the frontend after the user types in the 6-digit code emailed
 * to them by send-verification-code. Idempotent — safe to call multiple
 * times once already verified.
 */
export const dynamic = "force-dynamic";

import { z }               from "zod";
import { requireAuth }     from "@cozanethq/aegis-shared-sdk";
import { validateBody }    from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine }  from "@/engine";
import { ok, err }         from "@cozanethq/aegis-shared-sdk";

const Schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const body = await validateBody(request, Schema);
    await IdentityEngine.verifyEmail(auth.userId, body.code);
    return ok({ verified: true });
  } catch (e) {
    return err(e);
  }
}

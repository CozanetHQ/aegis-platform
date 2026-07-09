/**
 * POST /api/v2/identity/send-verification-code
 *
 * Generates a 6-digit code, stores its hash (10 min expiry), and sends it to
 * the caller's own registered email via the Notification Engine (Resend).
 * Called once right after signup, and again by the frontend's "resend code"
 * action. Rate-limited to one send per 60s per identity.
 *
 * No request body — the recipient is always the authenticated caller's own
 * account, never an arbitrary target (prevents using this as an email bomb
 * against someone else's inbox).
 */
export const dynamic = "force-dynamic";

import { requireAuth }    from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";
import { ok, err }        from "@cozanethq/aegis-shared-sdk";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    const result = await IdentityEngine.sendVerificationCode(auth.userId);
    return ok(result);
  } catch (e) {
    return err(e);
  }
}

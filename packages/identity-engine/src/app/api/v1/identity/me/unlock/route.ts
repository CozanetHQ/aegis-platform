/**
 * POST /api/v2/identity/me/unlock
 *
 * User-initiated account unlock.
 * Only valid if the lock was user-initiated — admin locks can only be
 * lifted by admins via /admin/unlock.
 *
 * Note: This does not distinguish BETWEEN admin and user locks at the DB level yet.
 * Phase 2: add lock_actor to identity so admin-locked accounts can be
 * blocked from self-unlock here.
 */
export const dynamic = "force-dynamic";

import { requireAuth }   from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";
import { ok, err }        from "@cozanethq/aegis-shared-sdk";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    await IdentityEngine.selfUnlock(auth.userId);
    return ok({ unlocked: true });
  } catch (e) {
    return err(e);
  }
}

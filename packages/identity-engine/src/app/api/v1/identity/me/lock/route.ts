/**
 * POST /api/v2/identity/me/lock
 *
 * User-initiated account lock — freezes the account immediately.
 * Use case: user suspects compromise and wants to freeze activity.
 * Only the user can lock their own account via this endpoint.
 * Admin lock goes through /admin/lock.
 */
export const dynamic = "force-dynamic";

import { requireAuth }   from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";
import { ok, err }        from "@cozanethq/aegis-shared-sdk";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    await IdentityEngine.selfLock(auth.userId);
    return ok({ locked: true });
  } catch (e) {
    return err(e);
  }
}

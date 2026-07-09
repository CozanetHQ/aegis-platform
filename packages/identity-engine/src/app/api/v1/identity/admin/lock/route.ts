/**
 * POST /api/v2/identity/admin/lock
 * Admin only. Requires role: admin or super_admin.
 */
export const dynamic = "force-dynamic";

import { z }                  from "zod";
import { requireAdmin }       from "@cozanethq/aegis-shared-sdk";
import { validateBody }       from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine }     from "@/engine";
import { AegisIdGenerator }   from "@/domain/aegis-id-generator";
import { AegisError }         from "@cozanethq/aegis-shared-sdk";
import { ok, err }            from "@cozanethq/aegis-shared-sdk";

const Schema = z.object({
  aegisId: z.string().refine(AegisIdGenerator.isValid, { message: "Invalid Aegis ID format" }),
  reason:  z.string().min(10, "Reason must be at least 10 characters").max(500),
});

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    const body = await validateBody(request, Schema);
    await IdentityEngine.lockAccount(auth.userId, body.aegisId, body.reason);
    return ok({ success: true, action: "lock", aegisId: body.aegisId });
  } catch (e) {
    return err(e);
  }
}

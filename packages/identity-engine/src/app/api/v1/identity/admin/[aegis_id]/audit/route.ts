/**
 * GET /api/v2/identity/admin/:aegis_id/audit
 *
 * Returns the full state transition audit trail for an identity.
 * Admin only.
 */
export const dynamic = "force-dynamic";

import { requireAdmin }   from "@cozanethq/aegis-shared-sdk";
import { IdentityEngine } from "@/engine";
import { AegisIdGenerator } from "@/domain/aegis-id-generator";
import { AegisError }     from "@cozanethq/aegis-shared-sdk";
import { ok, err }        from "@cozanethq/aegis-shared-sdk";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ aegis_id: string }> }
) {
  try {
    await requireAdmin(request);
    const { aegis_id } = await params;

    if (!AegisIdGenerator.isValid(aegis_id)) {
      throw new AegisError("VALIDATION_ERROR", "Invalid Aegis ID format");
    }

    const trail = await IdentityEngine.getAuditTrail(aegis_id);
    return ok({ aegisId: aegis_id, transitions: trail, count: trail.length });
  } catch (e) {
    return err(e);
  }
}

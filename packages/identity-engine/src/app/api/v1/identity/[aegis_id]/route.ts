/**
 * GET /api/v2/identity/:aegis_id
 *
 * Returns the compact public identity card for any aegis_id.
 * Safe for unauthenticated callers — never exposes email or internal id.
 *
 * FIX: Next.js 15 requires params to be awaited (Promise<{...}>).
 */
export const dynamic = "force-dynamic";

import { IdentityEngine }   from "@/engine";
import { AegisIdGenerator } from "@/domain/aegis-id-generator";
import { AegisError }       from "@cozanethq/aegis-shared-sdk";
import { ok, err }          from "@cozanethq/aegis-shared-sdk";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ aegis_id: string }> }
) {
  try {
    const { aegis_id } = await params;

    if (!AegisIdGenerator.isValid(aegis_id)) {
      throw new AegisError("VALIDATION_ERROR", "Invalid Aegis ID format");
    }

    const card = await IdentityEngine.getPublicCard(aegis_id);
    return ok(card);
  } catch (e) {
    return err(e);
  }
}

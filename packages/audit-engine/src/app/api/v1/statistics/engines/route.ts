export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check. Fixed to
// requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const activity = await AuditEngine().getEngineActivity.execute();
    return Response.json({ data: activity });
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    return Response.json(
      { error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { AuditError } from "@/application/audit-error";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check. Fixed to
// requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const result = await AuditEngine().getInvestigation.execute(id);

    return Response.json(result);
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    if (err instanceof AuditError) {
      return Response.json(
        { error: { code: err.code, message: err.message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } },
        { status: err.statusCode }
      );
    }
    return Response.json(
      { error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } },
      { status: 500 }
    );
  }
}

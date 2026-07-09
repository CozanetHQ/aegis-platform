export const dynamic = "force-dynamic";
import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check — a correlation
// lookup can span any user's cross-engine journey. Fixed to requireAdmin().
// See docs/CONTRACT_AUDIT.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ correlationId: string }> }
) {
  try {
    await requireAdmin(request);

    const { correlationId } = await params;
    const result = await AuditEngine().getCorrelationLookup.execute(correlationId);
    return Response.json({
      data: result.events.map(e => e.toPublicJSON()),
      journey: result.journey,
    });
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    return Response.json({ error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

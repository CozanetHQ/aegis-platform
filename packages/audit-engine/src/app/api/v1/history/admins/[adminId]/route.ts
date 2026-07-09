export const dynamic = "force-dynamic";
import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check on an admin-action
// history lookup — fixed to requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ adminId: string }> }
) {
  try {
    await requireAdmin(request);

    const { adminId } = await params;
    const url = new URL(request.url);
    const limit  = parseInt(url.searchParams.get("limit") ?? "50");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const result = await AuditEngine().getAdminHistory.execute(adminId, limit, offset);
    return Response.json({ data: result.events.map(e => e.toPublicJSON()), total: result.total, limit, offset });
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    return Response.json({ error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

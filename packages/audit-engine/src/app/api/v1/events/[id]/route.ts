export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check — any single event
// could belong to any user. Fixed to requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request);

    const { id } = await params;
    const event = await AuditEngine().eventRepo.getById(id);

    if (!event) {
      return Response.json(
        { error: { code: "AUDIT_NOT_FOUND", message: `Event ${id} not found`, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } },
        { status: 404 }
      );
    }

    return Response.json({ data: event.toPublicJSON() });
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

export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { AuditError } from "@/application/audit-error";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// POST — Start investigation (admin only)
// SECURITY: the "(admin only)" comment was aspirational — the code only
// checked for a "Bearer <anything>" prefix, no role check at all. Fixed to
// requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const body = await request.json();

    if (!body.initiatedBy || !body.pivotType || !body.pivotValue) {
      throw AuditError.validation("initiatedBy, pivotType, and pivotValue are required");
    }

    const result = await AuditEngine().startInvestigation.execute({
      initiatedBy: body.initiatedBy,
      pivotType:   body.pivotType,
      pivotValue:  body.pivotValue,
      title:       body.title,
      description: body.description,
    });

    return Response.json({
      data: result.investigation.toPublicJSON(),
      eventCount: result.eventCount,
      anomalies: result.anomalies,
    }, { status: 201 });
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

// GET — List investigations (admin only)
// SECURITY: same unenforced-Bearer-prefix issue as above. Fixed to
// requireAdmin().
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const limit  = parseInt(url.searchParams.get("limit") ?? "20");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");

    const result = await AuditEngine().listInvestigations.execute(limit, offset);

    return Response.json({
      data: result.investigations.map(i => i.toPublicJSON()),
      total: result.total,
    });
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

export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { AuditError } from "@/application/audit-error";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// POST — Export audit data (admin only)
// SECURITY: was an unenforced "Bearer <anything>" check — this is a full
// bulk-export of audit data with arbitrary filters, the single most
// sensitive endpoint in this engine. Fixed to requireAdmin(). See
// docs/CONTRACT_AUDIT.md — worth considering requireSuperAdmin() instead,
// given the blast radius of a single export, as a follow-up policy call.
export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const body = await request.json();

    if (!body.requestedBy || !body.format) {
      throw AuditError.validation("requestedBy and format are required");
    }

    const result = await AuditEngine().exportAuditData.execute({
      requestedBy: body.requestedBy,
      format:      body.format,
      filters:     body.filters ?? {},
    });

    return Response.json({
      data: result.exportRecord.toPublicJSON(),
      content: result.content,
      contentType: result.contentType,
    }, {
      headers: { "Content-Type": result.contentType },
    });
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

// GET — List exports (admin only)
// SECURITY: same unenforced-Bearer-prefix issue. Fixed to requireAdmin().
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const limit  = parseInt(url.searchParams.get("limit") ?? "20");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");

    const result = await AuditEngine().listExports.execute(limit, offset);

    return Response.json({
      data: result.exports.map(e => e.toPublicJSON()),
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

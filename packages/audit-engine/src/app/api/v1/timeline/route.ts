export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check on a cross-user
// timeline query. Fixed to requireAdmin(). See docs/CONTRACT_AUDIT.md.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const params = url.searchParams;

    const result = await AuditEngine().getTimeline.execute({
      userId:        params.get("userId") ?? undefined,
      correlationId: params.get("correlationId") ?? undefined,
      walletId:      params.get("walletId") ?? undefined,
      walletAddress: params.get("walletAddress") ?? undefined,
      sessionId:     params.get("sessionId") ?? undefined,
      limit:         params.get("limit") ? parseInt(params.get("limit")!) : undefined,
    });

    return Response.json({ data: result.entries, total: result.total });
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

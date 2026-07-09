export const dynamic = "force-dynamic";
import { AuditEngine } from "@/engine";
import { requireAuth, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check — anyone could read
// ANY user's audit history (IPs, sessions, device IDs...) by guessing/passing
// a userId. Fixed: requires a real session (requireAuth) AND only allows the
// caller to read their OWN history, unless they're admin/super_admin. See
// docs/CONTRACT_AUDIT.md.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { userId } = await params;

    const isSelf = auth.userId === userId;
    const isAdmin = auth.role === "admin" || auth.role === "super_admin";
    if (!isSelf && !isAdmin) {
      throw new AegisError("AUDIT_FORBIDDEN", "You can only view your own audit history", 403);
    }

    const url = new URL(request.url);
    const limit  = parseInt(url.searchParams.get("limit") ?? "50");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const result = await AuditEngine().getUserHistory.execute(userId, limit, offset);
    return Response.json({ data: result.events.map(e => e.toPublicJSON()), total: result.total, limit, offset });
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    return Response.json({ error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

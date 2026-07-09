export const dynamic = "force-dynamic";
import { AuditEngine } from "@/engine";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// SECURITY: was an unenforced "Bearer <anything>" check. Fixed to
// requireAdmin() — a wallet has no session of its own to self-authenticate
// with, and per-wallet audit history isn't currently correlatable to "the
// caller's own wallet" without an extra ownership lookup against Wallet
// Vault (a real product feature, not a bug fix — noted in
// docs/CONTRACT_AUDIT.md as a possible follow-up if self-service wallet
// history is wanted).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ walletId: string }> }
) {
  try {
    await requireAdmin(request);

    const { walletId } = await params;
    const url = new URL(request.url);
    const limit  = parseInt(url.searchParams.get("limit") ?? "50");
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const result = await AuditEngine().getWalletHistory.execute(walletId, limit, offset);
    return Response.json({ data: result.events.map(e => e.toPublicJSON()), total: result.total, limit, offset });
  } catch (err) {
    if (err instanceof AegisError) {
      return Response.json(err.toResponse(), { status: err.httpStatus });
    }
    return Response.json({ error: { code: "AUDIT_INTERNAL", message: (err as Error).message, correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } }, { status: 500 });
  }
}

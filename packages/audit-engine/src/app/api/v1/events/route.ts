export const dynamic = "force-dynamic";

import { AuditEngine } from "@/engine";
import { AuditError } from "@/application/audit-error";
import { requireAdmin, AegisError } from "@cozanethq/aegis-shared-sdk";

// POST /api/v1/events — Create audit event (engine-to-engine, API key auth)
export async function POST(request: Request) {
  try {
    // API key auth for engine-to-engine communication
    const apiKey = request.headers.get("x-audit-api-key");
    const expectedKey = process.env.AUDIT_ENGINE_API_KEY;
    if (!expectedKey || apiKey !== expectedKey) {
      return Response.json(
        { error: { code: "AUDIT_UNAUTHORIZED", message: "Invalid or missing X-Audit-API-Key", correlationId: crypto.randomUUID(), timestamp: new Date().toISOString() } },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Extract IP and device info from headers if not in body
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? null;
    const country = request.headers.get("x-vercel-ip-country") ?? null;
    const platform = request.headers.get("x-aegis-platform") ?? "API";

    const result = await AuditEngine().createAuditEvent.execute({
      ...body,
      ipAddress: body.ipAddress ?? ip,
      country:   body.country ?? country,
      platform:  body.platform ?? platform,
    });

    return Response.json({ data: result.toPublicJSON() }, { status: 201 });
  } catch (err) {
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

// GET /api/v1/events — Search audit events with filters
// SECURITY: previously only checked that Authorization *looked like* "Bearer
// <anything>" with zero JWT verification and zero role check — a complete
// auth bypass letting anyone read any user's/admin's/wallet's full audit
// trail (IPs, sessions, device IDs, admin actions...) via arbitrary
// `userId`/`walletId`/etc. filters. This is a cross-user, cross-admin
// search over "the permanent memory of AEGIS" (docs/SECURITY.md's own
// words) — admin-only by design intent, unenforced in code. Fixed to use
// the shared SDK's requireAdmin(), which independently verifies the
// Supabase JWT and role. See docs/CONTRACT_AUDIT.md.
export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const url = new URL(request.url);
    const params = url.searchParams;

    const result = await AuditEngine().searchAuditEvents.execute({
      userId:        params.get("userId") ?? undefined,
      walletId:      params.get("walletId") ?? undefined,
      walletAddress: params.get("walletAddress") ?? undefined,
      engine:        params.get("engine") ?? undefined,
      category:      params.get("category") ?? undefined,
      eventName:     params.get("eventName") ?? undefined,
      severity:      params.get("severity") ?? undefined,
      outcome:       params.get("outcome") ?? undefined,
      correlationId: params.get("correlationId") ?? undefined,
      sessionId:     params.get("sessionId") ?? undefined,
      deviceId:      params.get("deviceId") ?? undefined,
      ipAddress:     params.get("ipAddress") ?? undefined,
      country:       params.get("country") ?? undefined,
      actorId:       params.get("actorId") ?? undefined,
      actorType:     params.get("actorType") ?? undefined,
      platform:      params.get("platform") ?? undefined,
      startDate:     params.get("startDate") ?? undefined,
      endDate:       params.get("endDate") ?? undefined,
      limit:         params.get("limit") ? parseInt(params.get("limit")!) : undefined,
      offset:        params.get("offset") ? parseInt(params.get("offset")!) : undefined,
      orderBy:       params.get("orderBy") ?? undefined,
      orderDir:      (params.get("orderDir") as "asc" | "desc") ?? undefined,
    });

    return Response.json({
      data: result.events.map(e => e.toPublicJSON()),
      total: result.total,
      limit: result.limit,
      offset: result.offset,
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

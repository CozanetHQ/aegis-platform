export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — serves the CANONICAL contract.
 *
 * CONTRACT-FIRST FIX (2026-07-07): this used to be a hand-maintained
 * object literal that had drifted out of sync with the actual routes
 * (signup/login/refresh existed in code but were never declared here —
 * that's part of what broke onboarding through the Gateway). The spec is
 * now a single static file at /openapi/openapi.json, checked into git —
 * that file IS the contract aegis-gateway's build-time validator and
 * typed-client generator consume. This route just serves it; it can never
 * drift from what's committed because there's only one copy.
 */
import spec from "../../../../../openapi/openapi.json";

export async function GET() {
  return Response.json(spec);
}

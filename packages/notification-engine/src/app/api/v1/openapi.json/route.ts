export const dynamic = "force-dynamic";

import spec from "../../../../../openapi/openapi.json";

/**
 * GET /api/v1/openapi.json — serves the CANONICAL, checked-in contract.
 * Previously a hand-written inline spec (kept in sync manually with no
 * enforcement). See docs/CONTRACT_AUDIT.md.
 */
export async function GET() {
  return Response.json(spec);
}

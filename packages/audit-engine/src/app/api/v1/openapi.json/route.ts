export const dynamic = "force-dynamic";

import spec from "../../../../../openapi/openapi.json";

/**
 * GET /api/v1/openapi.json — serves the CANONICAL, checked-in contract.
 * Previously an inline hand-written spec that (correctly) declared
 * bearerAuth on every route but never distinguished "any authenticated
 * user" from "admin only" — matching the code, which enforced neither.
 * Now carries an x-required-role per path reflecting what's actually
 * enforced after the auth-bypass fix. See docs/CONTRACT_AUDIT.md.
 */
export async function GET() {
  return Response.json(spec);
}

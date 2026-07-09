export const dynamic = "force-dynamic";

/**
 * GET /api/v1/openapi.json — serves the CANONICAL contract.
 * Single source of truth lives at /openapi/openapi.json (checked into
 * git). aegis-gateway's build-time validator and typed-client generator
 * consume that file directly — this route just serves the same object.
 */
import spec from "../../../../../openapi/openapi.json";

export async function GET() {
  return Response.json(spec);
}

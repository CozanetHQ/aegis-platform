export const dynamic = "force-dynamic";

import spec from "../../../../../openapi/openapi.json";

export async function GET() {
  return Response.json(spec);
}

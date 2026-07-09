export const dynamic = "force-dynamic";
import pkg from "../../../../../package.json";

export async function GET() {
  return Response.json({ name: pkg.name, version: pkg.version });
}

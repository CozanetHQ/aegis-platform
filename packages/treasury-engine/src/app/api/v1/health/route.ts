export const dynamic = "force-dynamic";
import { currentNetworkInfo } from "@/engine";

export async function GET() {
  return Response.json({ status: "healthy", network: currentNetworkInfo(), timestamp: new Date().toISOString() });
}

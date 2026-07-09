export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    service: "aegis-swap-engine",
    version: "1.0.0",
    build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
    timestamp: new Date().toISOString(),
  });
}

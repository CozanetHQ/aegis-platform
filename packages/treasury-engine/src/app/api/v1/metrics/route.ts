export const dynamic = "force-dynamic";

export async function GET() {
  const body = `# HELP treasury_engine_up Treasury Engine liveness\n# TYPE treasury_engine_up gauge\ntreasury_engine_up 1\n`;
  return new Response(body, { headers: { "Content-Type": "text/plain; version=0.0.4" } });
}

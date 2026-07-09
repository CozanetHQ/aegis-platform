export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    service: 'aegis-portfolio-engine',
    version: '1.0.0',
    build: process.env.BUILD_ID ?? 'dev',
    timestamp: new Date().toISOString(),
  });
}

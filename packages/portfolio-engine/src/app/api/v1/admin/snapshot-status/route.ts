export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = request.headers.get('X-Portfolio-API-Key');
  if (apiKey !== process.env.PORTFOLIO_ENGINE_API_KEY) {
    return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'Admin API key required' } }, { status: 401 });
  }
  return Response.json({
    data: {
      lastSnapshotAt: null,
      snapshotCount: 0,
      interval: 'hourly',
      status: 'active',
    },
  });
}

import { getCacheInstance } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const apiKey = request.headers.get('X-Portfolio-API-Key');
  if (apiKey !== process.env.PORTFOLIO_ENGINE_API_KEY) {
    return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'Admin API key required' } }, { status: 401 });
  }
  const cache = getCacheInstance();
  return Response.json({
    data: {
      size: cache.getSize(),
      hitRate: cache.getHitRate(),
      missRate: cache.getMissRate(),
      recentInvalidations: cache.getRecentInvalidations(20),
    },
  });
}

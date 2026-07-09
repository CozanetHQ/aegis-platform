import { getCacheInstance } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cache = getCacheInstance();
  return Response.json({
    status: 'ok',
    service: 'aegis-portfolio-engine',
    timestamp: new Date().toISOString(),
    cache: {
      size: cache.getSize(),
      hitRate: cache.getHitRate(),
      missRate: cache.getMissRate(),
    },
  });
}

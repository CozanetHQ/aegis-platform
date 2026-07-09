import { getCacheInstance } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cache = getCacheInstance();
  return Response.json({
    service: 'aegis-portfolio-engine',
    metrics: {
      cache_size: cache.getSize(),
      cache_hit_rate: cache.getHitRate(),
      cache_miss_rate: cache.getMissRate(),
      recent_invalidations: cache.getRecentInvalidations(10),
    },
    timestamp: new Date().toISOString(),
  });
}

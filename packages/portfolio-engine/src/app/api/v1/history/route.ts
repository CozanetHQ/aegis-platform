import { useCases } from '@/engine';
import { TimeRange } from '@/domain/enums/portfolio-enums';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) {
      return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    }
    const url = new URL(request.url);
    const range = (url.searchParams.get('range') ?? '24h') as TimeRange;
    const validRanges = Object.values(TimeRange);
    if (!validRanges.includes(range)) {
      return Response.json({ error: { code: 'INVALID_RANGE', message: `Range must be one of: ${validRanges.join(', ')}` } }, { status: 400 });
    }
    const history = await useCases.getPortfolioHistory().execute(userId, range);
    return Response.json({ data: history });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

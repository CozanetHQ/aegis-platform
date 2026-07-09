import { useCases } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    const summaries = await useCases.getWalletSummaries().execute(userId);
    return Response.json({ data: summaries });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

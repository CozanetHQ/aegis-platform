import { useCases } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    const url = new URL(request.url);
    const walletId = url.searchParams.get('walletId') ?? undefined;
    const balance = await useCases.getAvailableBalance().execute(userId, walletId);
    return Response.json({ data: balance });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

import { useCases } from '@/engine';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { walletId: string } }) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) {
      return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    }
    const summary = await useCases.getWalletSummary().execute(userId, params.walletId);
    if (!summary) {
      return Response.json({ error: { code: 'NOT_FOUND', message: 'Wallet summary not found' } }, { status: 404 });
    }
    return Response.json({ data: summary });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

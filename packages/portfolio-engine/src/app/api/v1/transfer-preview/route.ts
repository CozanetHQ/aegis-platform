import { useCases } from '@/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { walletId, amount, token, chain } = body;
    if (!walletId || !amount || !token || !chain) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'walletId, amount, token, and chain are required' } }, { status: 400 });
    }
    const preview = await useCases.previewTransfer().execute(walletId, amount, token, chain);
    return Response.json({ data: preview });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

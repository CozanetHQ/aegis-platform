import { useCases } from '@/engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    const body = await request.json();
    const { amount, fee, discount } = body;
    if (amount === undefined) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', message: 'amount is required' } }, { status: 400 });
    }
    const preview = await useCases.previewPayment().execute(userId, Number(amount), Number(fee ?? 0), Number(discount ?? 0));
    return Response.json({ data: preview });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

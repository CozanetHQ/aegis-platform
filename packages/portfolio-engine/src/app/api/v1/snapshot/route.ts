import { useCases } from '@/engine';
import { PortfolioSnapshot } from '@/domain/entities/portfolio-snapshot.entity';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = request.headers.get('X-User-Id');
    if (!userId) return Response.json({ error: { code: 'AUTH_UNAUTHORIZED', message: 'User ID required' } }, { status: 401 });
    const body = await request.json();
    const snapshot = new PortfolioSnapshot(
      crypto.randomUUID(),
      userId,
      new Date().toISOString(),
      body.totalValue ?? 0,
      body.availableValue ?? 0,
      body.pendingValue ?? 0,
      body.lockedValue ?? 0,
      body.reservedValue ?? 0,
      body.walletCount ?? 0,
      body.chainCount ?? 0,
      body.topHoldings ?? [],
      body.netWorth ?? body.totalValue ?? 0,
    );
    await useCases.createSnapshot().execute(snapshot);
    return Response.json({ data: snapshot.toDTO() }, { status: 201 });
  } catch (err) {
    return Response.json({ error: { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Unknown error' } }, { status: 500 });
  }
}

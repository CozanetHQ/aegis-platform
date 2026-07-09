import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpMarketClient } from '../../src/infrastructure/clients/http-engine-clients';

/**
 * Regression tests for the Portfolio ↔ Market integration bug fixed in this
 * PR (see docs/CONTRACT_AUDIT.md): the previous HttpMarketClient could never
 * successfully fetch a live price because of THREE independent contract
 * mismatches (wrong health status, wrong route shape, wrong envelope/field
 * names). These tests use the REAL response shapes Market Engine's own
 * source returns (health/route.ts, prices/route.ts,
 * get-prices.use-case.ts), not idealized ones, so they'd have caught every
 * one of those mismatches.
 */

const BASE_URL = 'https://market.internal.test';

function mockFetchSequence(responses: Array<{ ok: boolean; status?: number; json: any }>) {
  let call = 0;
  global.fetch = vi.fn(async () => {
    const r = responses[Math.min(call, responses.length - 1)];
    call++;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      statusText: r.ok ? 'OK' : 'Error',
      json: async () => r.json,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('HttpMarketClient (real Market Engine contract)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isAvailable', () => {
    it('is available when health returns the REAL status value "healthy" (not "ok")', async () => {
      mockFetchSequence([{ ok: true, json: { status: 'healthy', timestamp: new Date().toISOString() } }]);
      const client = new HttpMarketClient(BASE_URL);
      expect(await client.isAvailable()).toBe(true);
    });

    it('is unavailable when health returns "degraded"', async () => {
      mockFetchSequence([{ ok: true, json: { status: 'degraded', timestamp: new Date().toISOString() } }]);
      const client = new HttpMarketClient(BASE_URL);
      expect(await client.isAvailable()).toBe(false);
    });

    it('is unavailable when health returns the OLD expected value "ok" (guards against reverting the fix)', async () => {
      mockFetchSequence([{ ok: true, json: { status: 'ok' } }]);
      const client = new HttpMarketClient(BASE_URL);
      // "ok" is not a real status Market Engine ever returns — treating it
      // as available again would mean the fix regressed.
      expect(await client.isAvailable()).toBe(false);
    });
  });

  describe('getPrice', () => {
    it('parses the REAL /prices response shape: { prices: [...] } with priceUsd/updatedAt fields', async () => {
      mockFetchSequence([
        { ok: true, json: { status: 'healthy' } }, // health check
        {
          ok: true,
          json: {
            prices: [{ symbol: 'ETH', priceUsd: 3456.78, updatedAt: new Date().toISOString(), change24h: 1.2 }],
            count: 1,
            timestamp: new Date().toISOString(),
          },
        },
      ]);
      const client = new HttpMarketClient(BASE_URL);
      const price = await client.getPrice('ETH', 'ETHEREUM');

      expect(price).not.toBeNull();
      expect(price!.symbol).toBe('ETH');
      expect(price!.price).toBe(3456.78); // mapped from priceUsd
      expect(price!.currency).toBe('USD');
      expect(price!.stale).toBe(false);
    });

    it('calls the REAL route — flat query param, no path segment, no chain', async () => {
      mockFetchSequence([
        { ok: true, json: { status: 'healthy' } },
        { ok: true, json: { prices: [{ symbol: 'BTC', priceUsd: 65000, updatedAt: new Date().toISOString() }] } },
      ]);
      const client = new HttpMarketClient(BASE_URL);
      await client.getPrice('BTC', 'BITCOIN');

      const calledUrl = (global.fetch as any).mock.calls[1][0] as string;
      expect(calledUrl).toBe(`${BASE_URL}/api/v1/prices?symbols=BTC`);
      expect(calledUrl).not.toContain('/prices/BTC'); // the old, nonexistent path-param route
      expect(calledUrl).not.toContain('chain=');
    });

    it('does NOT require a { data: ... } envelope (the real response has none)', async () => {
      mockFetchSequence([
        { ok: true, json: { status: 'healthy' } },
        { ok: true, json: { prices: [{ symbol: 'USDT', priceUsd: 1.0, updatedAt: new Date().toISOString() }] } },
      ]);
      const client = new HttpMarketClient(BASE_URL);
      const price = await client.getPrice('USDT', 'ETHEREUM');
      expect(price?.price).toBe(1.0);
    });

    it('marks a price stale once older than the 2x-cache-TTL threshold', async () => {
      const old = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 minutes old
      mockFetchSequence([
        { ok: true, json: { status: 'healthy' } },
        { ok: true, json: { prices: [{ symbol: 'SOL', priceUsd: 150, updatedAt: old }] } },
      ]);
      const client = new HttpMarketClient(BASE_URL);
      const price = await client.getPrice('SOL', 'SOLANA');
      expect(price?.stale).toBe(true);
    });

    it('returns null when Market Engine is unavailable', async () => {
      mockFetchSequence([{ ok: true, json: { status: 'degraded' } }]);
      const client = new HttpMarketClient(BASE_URL);
      expect(await client.getPrice('ETH', 'ETHEREUM')).toBeNull();
    });

    it('returns null (not throw) on network failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;
      const client = new HttpMarketClient(BASE_URL);
      expect(await client.getPrice('ETH', 'ETHEREUM')).toBeNull();
    });
  });

  describe('getPrices (batched)', () => {
    it('issues a single request for all symbols and maps every {symbol, chain} pair', async () => {
      mockFetchSequence([
        { ok: true, json: { status: 'healthy' } },
        {
          ok: true,
          json: {
            prices: [
              { symbol: 'ETH', priceUsd: 3000, updatedAt: new Date().toISOString() },
              { symbol: 'USDT', priceUsd: 1, updatedAt: new Date().toISOString() },
            ],
          },
        },
      ]);
      const client = new HttpMarketClient(BASE_URL);
      const result = await client.getPrices([
        { symbol: 'ETH', chain: 'ETHEREUM' },
        { symbol: 'USDT', chain: 'ETHEREUM' },
        { symbol: 'USDT', chain: 'BSC' }, // same symbol, different chain — same price applies
      ]);

      // Exactly one price fetch call (after the health check) — not one per token.
      expect((global.fetch as any).mock.calls.length).toBe(2);
      expect(result.get('ETH:ETHEREUM')?.price).toBe(3000);
      expect(result.get('USDT:ETHEREUM')?.price).toBe(1);
      expect(result.get('USDT:BSC')?.price).toBe(1);
    });

    it('returns an empty map when unavailable', async () => {
      mockFetchSequence([{ ok: true, json: { status: 'degraded' } }]);
      const client = new HttpMarketClient(BASE_URL);
      const result = await client.getPrices([{ symbol: 'ETH', chain: 'ETHEREUM' }]);
      expect(result.size).toBe(0);
    });
  });
});

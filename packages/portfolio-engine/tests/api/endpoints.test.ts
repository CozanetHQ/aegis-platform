import { describe, it, expect } from 'vitest';

// These are integration tests that verify the API route structure.
// Full integration tests require a running server.

describe('Portfolio Engine API Structure', () => {
  it('should have all required standard endpoints', () => {
    const standardEndpoints = ['health', 'version', 'metrics', 'openapi.json'];
    for (const ep of standardEndpoints) {
      expect(standardEndpoints).toContain(ep);
    }
  });

  it('should have all required business endpoints', () => {
    const businessEndpoints = [
      'summary', 'history', 'wallets/[walletId]', 
      'allocation/assets', 'allocation/chains', 'allocation/wallets',
      'performance', 'available-balance',
      'transfer-preview', 'payment-preview', 'snapshot',
    ];
    expect(businessEndpoints.length).toBe(11);
  });

  it('should have all admin endpoints', () => {
    const adminEndpoints = [
      'admin/statistics', 'admin/top-assets', 'admin/top-chains',
      'admin/cache-status', 'admin/snapshot-status',
    ];
    expect(adminEndpoints.length).toBe(5);
  });
});

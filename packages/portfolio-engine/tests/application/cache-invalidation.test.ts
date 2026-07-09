import { describe, it, expect, beforeEach } from 'vitest';
import { InvalidateCacheUseCase } from '../../src/application/use-cases/portfolio-use-cases';
import { FakeCache } from '../fakes';
import { CacheInvalidationReason } from '../../src/domain/enums/portfolio-enums';

describe('InvalidateCacheUseCase', () => {
  let cache: FakeCache;
  let useCase: InvalidateCacheUseCase;

  beforeEach(() => {
    cache = new FakeCache();
    useCase = new InvalidateCacheUseCase(cache);
  });

  it('should invalidate all keys for a user', async () => {
    await cache.set('portfolio:user-001:summary', { data: 'test' }, 60);
    await cache.set('portfolio:user-001:wallets', { data: 'test' }, 60);
    await cache.set('portfolio:user-002:summary', { data: 'test' }, 60);

    await useCase.execute('user-001', CacheInvalidationReason.TRANSFER_COMPLETED);

    expect(cache.store.has('portfolio:user-001:summary')).toBe(false);
    expect(cache.store.has('portfolio:user-001:wallets')).toBe(false);
    expect(cache.store.has('portfolio:user-002:summary')).toBe(true);
  });

  it('should record invalidation reason', async () => {
    await cache.set('portfolio:user-001:summary', { data: 'test' }, 60);
    await useCase.execute('user-001', CacheInvalidationReason.WALLET_UPDATED);
    expect(cache.invalidations.length).toBe(1);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCache } from '../../src/infrastructure/cache/in-memory-cache';

describe('InMemoryCache', () => {
  let cache: InMemoryCache;

  beforeEach(() => {
    cache = new InMemoryCache();
  });

  it('should store and retrieve data', async () => {
    await cache.set('key1', { value: 42 }, 60);
    const result = await cache.get<{ value: number }>('key1');
    expect(result).not.toBeNull();
    expect(result!.data.value).toBe(42);
  });

  it('should return null for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });

  it('should track hits and misses', async () => {
    await cache.set('key1', 'data', 60);
    await cache.get('key1'); // hit
    await cache.get('missing'); // miss
    expect(cache.getHitRate()).toBeCloseTo(0.5, 2);
    expect(cache.getMissRate()).toBeCloseTo(0.5, 2);
  });

  it('should expire data after TTL', async () => {
    await cache.set('key1', 'data', 0);
    // TTL of 0 means it expires immediately
    await new Promise((r) => setTimeout(r, 10));
    const result = await cache.get('key1');
    expect(result).toBeNull();
  });

  it('should invalidate specific key', async () => {
    await cache.set('key1', 'data', 60);
    await cache.invalidate('key1', 'test');
    const result = await cache.get('key1');
    expect(result).toBeNull();
  });

  it('should invalidate by pattern', async () => {
    await cache.set('portfolio:user-001:summary', 'data', 60);
    await cache.set('portfolio:user-001:wallets', 'data', 60);
    await cache.set('portfolio:user-002:summary', 'data', 60);
    await cache.invalidatePattern('portfolio:user-001:*', 'test');
    expect(await cache.get('portfolio:user-001:summary')).toBeNull();
    expect(await cache.get('portfolio:user-001:wallets')).toBeNull();
    const other = await cache.get('portfolio:user-002:summary');
    expect(other).not.toBeNull();
  });

  it('should track cache size', async () => {
    expect(cache.getSize()).toBe(0);
    await cache.set('key1', 'data', 60);
    expect(cache.getSize()).toBe(1);
    await cache.set('key2', 'data', 60);
    expect(cache.getSize()).toBe(2);
  });

  it('should record recent invalidations', async () => {
    await cache.set('key1', 'data', 60);
    await cache.invalidate('key1', 'transfer_completed');
    const invalidations = cache.getRecentInvalidations();
    expect(invalidations.length).toBe(1);
    expect(invalidations[0].reason).toBe('transfer_completed');
  });
});

/**
 * In-Memory Cache with TTL and invalidation tracking.
 * 
 * For production, this should be replaced with Redis.
 * The interface remains the same.
 */

import { CachePort } from '../../domain/repositories/portfolio.repository';

interface CacheRecord {
  data: unknown;
  expiresAt: number;
  createdAt: number;
}

export class InMemoryCache implements CachePort {
  private store = new Map<string, CacheRecord>();
  private hits = 0;
  private misses = 0;
  private invalidations: { key: string; reason: string; timestamp: string }[] = [];

  async get<T>(key: string): Promise<{ data: T; expiresAt: number } | null> {
    const record = this.store.get(key);
    if (!record) {
      this.misses++;
      return null;
    }
    if (record.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return { data: record.data as T, expiresAt: record.expiresAt };
  }

  async set<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
      createdAt: Date.now(),
    });
  }

  async invalidate(key: string, reason: string): Promise<void> {
    if (this.store.has(key)) {
      this.store.delete(key);
      this.invalidations.push({ key, reason, timestamp: new Date().toISOString() });
    }
  }

  async invalidatePattern(pattern: string, reason: string): Promise<void> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of Array.from(this.store.keys())) {
      if (regex.test(key)) {
        this.store.delete(key);
        this.invalidations.push({ key, reason, timestamp: new Date().toISOString() });
      }
    }
  }

  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  getMissRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.misses / total : 0;
  }

  getSize(): number {
    return this.store.size;
  }

  getRecentInvalidations(limit = 20) {
    return this.invalidations.slice(-limit);
  }
}

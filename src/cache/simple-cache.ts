import { logger } from '../utils/logger.js';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private ttl: number;

  constructor(ttlMs: number = 60000) {
    this.ttl = ttlMs;
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      data: value,
      expiresAt: Date.now() + this.ttl,
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Workspace cache (1 minute TTL)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const workspaceCache = new SimpleCache<any>(60000);

// User opt-in status cache (30 seconds TTL)
export const userOptInCache = new SimpleCache<boolean>(30000);

// Helper to invalidate workspace cache
export function invalidateWorkspaceCache(teamId: string): void {
  workspaceCache.delete(teamId);
  logger.debug({ teamId }, 'Invalidated workspace cache');
}

// Helper to invalidate user cache
export function invalidateUserCache(key: string): void {
  userOptInCache.delete(key);
  logger.debug({ key }, 'Invalidated user cache');
}

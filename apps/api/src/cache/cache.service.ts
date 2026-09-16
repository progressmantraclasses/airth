import { Injectable, Logger } from '@nestjs/common';
import { Redis } from '@upstash/redis';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null;

  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (url && token) {
      this.redis = new Redis({ url, token });
    } else {
      this.logger.warn('Upstash credentials missing — cache disabled');
      this.redis = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get<T>(key);
    } catch (err) {
      this.logger.warn(`Redis GET failed for key "${key}": ${err}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
    } catch (err) {
      this.logger.warn(`Redis SET failed for key "${key}": ${err}`);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(...keys);
    } catch (err) {
      this.logger.warn(`Redis DEL failed: ${err}`);
    }
  }

  // Acquire a short-lived lock. Returns true if we got the lock.
  async acquireLock(key: string, ttlMs = 3000): Promise<boolean> {
    if (!this.redis) return true; // no redis = no lock = allow through
    try {
      const result = await this.redis.set(key, '1', { nx: true, px: ttlMs });
      return result === 'OK';
    } catch (err) {
      this.logger.warn(`Redis lock acquire failed for "${key}": ${err}`);
      return true; // degrade gracefully — don't block the request
    }
  }

  async releaseLock(key: string): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.warn(`Redis lock release failed for "${key}": ${err}`);
    }
  }
}

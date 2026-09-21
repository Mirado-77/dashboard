import type { RateLimitRule } from './options.js';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Returns the seconds to wait when the limit is reached, otherwise null. */
  consume(key: string, rule: RateLimitRule): number | null;
}

export function memoryRateLimiter(now = () => Date.now()): RateLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    consume(key, rule) {
      const time = now();
      if (buckets.size > 10_000) {
        for (const [k, b] of buckets) if (b.resetAt <= time) buckets.delete(k);
      }
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= time) {
        bucket = { count: 0, resetAt: time + rule.window * 1000 };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > rule.max) {
        return Math.ceil((bucket.resetAt - time) / 1000);
      }
      return null;
    },
  };
}

/*
** EPITECH PROJECT, 2026
** G-WEB-500-PAR-5-1-dashboard-10
** File description:
** ttl-cache
*/

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory cache with a time to live per entry.
 *
 * Concurrent calls for the same key share one load, and a failed load is
 * never stored.
 */
export class TtlCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly pending = new Map<string, Promise<T>>();

  constructor(
    private readonly maxEntries = 500,
    private readonly now = () => Date.now(),
  ) {}

  async get(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const running = this.pending.get(key);
    if (running) return running;

    const promise = load()
      .then((value) => {
        this.store(key, value, ttlSeconds);
        return value;
      })
      .finally(() => this.pending.delete(key));
    this.pending.set(key, promise);
    return promise;
  }

  private store(key: string, value: T, ttlSeconds: number) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}

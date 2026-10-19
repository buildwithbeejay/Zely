import { logThrottled } from "@/shared/utils/throttled-log";

export interface RateLimitHit {
  count: number;
  resetInMs: number;
}

const MAX_KEYS = 200_000; // roughly 40-50 MB worst case

class MemoryRateLimitStore {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor() {
    setInterval(() => this.sweep(), 60_000).unref();
  }

  hit(key: string, windowMs: number): RateLimitHit {
    const now = Date.now();
    let e = this.hits.get(key);
    if (!e || e.resetAt <= now) {
      if (this.hits.size >= MAX_KEYS) this.makeRoom();
      e = { count: 0, resetAt: now + windowMs };
      this.hits.set(key, e);
    }
    e.count++;
    return { count: e.count, resetInMs: Math.max(0, e.resetAt - now) };
  }

  private sweep() {
    const now = Date.now();
    for (const [k, v] of this.hits) if (v.resetAt <= now) this.hits.delete(k);
  }

  private makeRoom() {
    this.sweep();
    if (this.hits.size < MAX_KEYS) return;
    // still full: drop the oldest 10% (Map keeps insertion order)
    let n = Math.ceil(MAX_KEYS * 0.1);
    for (const k of this.hits.keys()) {
      this.hits.delete(k);
      if (--n <= 0) break;
    }
    logThrottled(
      "warn",
      "memory-rl-full",
      "Rate-limit memory store full — evicted oldest keys",
    );
  }
}

export const memoryRateLimitStore = new MemoryRateLimitStore();

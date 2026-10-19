import Redis from "ioredis";
import { config } from "@/config/index";
import { logger } from "@/shared/utils/logger";
import { withRedisBreaker } from "@/infrastructure/resilience/breakers/redis.breaker";
import { rehydrateBlacklistOnRedisReconnect } from "@/infrastructure/helpers/session.helper";

import { logThrottled } from "@/shared/utils/throttled-log";
import { memoryRateLimitStore, RateLimitHit } from "./memory-rate-limit.store";

class RedisConnection {
  private client: Redis | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;

  private wasUp = false;
  private downSince: number | null = null;

  private readonly name: string;
  private readonly db?: number;
  private readonly rehydrateOnReady: boolean;
  private readonly commandTimeout: number;

  constructor(
    opts: {
      name?: string;
      db?: number;
      rehydrateOnReady?: boolean;
      commandTimeout?: number;
    } = {},
  ) {
    this.name = opts.name ?? "main";
    this.db = opts.db;
    this.rehydrateOnReady = opts.rehydrateOnReady ?? true;
    this.commandTimeout = opts.commandTimeout ?? 1000;
  }

  private static readonly RATE_LIMIT_LUA = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local t = redis.call('PTTL', KEYS[1])
if t < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); t = tonumber(ARGV[1]) end
return {c, t}`;

  // ─────────────────────────────────────────────
  // CORE: Single entry point for all Redis ops
  // Circuit breaker + connection guard live here
  // ─────────────────────────────────────────────

  public async execute<T>(
    command: () => Promise<T>,
    fallback: () => Promise<T>,
    context?: string,
  ): Promise<T> {
    // client never initialized at all — skip breaker, nothing to count
    if (!this.client) {
      logThrottled(
        "warn",
        `${this.name}-redis-not-init`,
        "Redis client not initialized — using fallbacks",
      );
      return fallback();
    }

    // client exists but may be disconnected
    // let withRedisBreaker handle it — so failures are counted and circuit can open
    return withRedisBreaker(
      async () => {
        // if client is not ready this will throw — breaker counts it
        if (this.client?.status !== "ready") {
          throw new Error(
            `Redis client not ready — status: ${this.client?.status}`,
          );
        }
        return command();
      },
      () => fallback(),
      context,
    );
  }

  // ─────────────────────────────────────────────
  // INTERNAL: Safe accessor for Redis client
  // ─────────────────────────────────────────────

  private get redis(): Redis {
    if (!this.client) {
      throw new Error("Redis client not initialized. Call connect() first.");
    }
    return this.client;
  }

  // ─────────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────────

  async connect(): Promise<boolean> {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        db: this.db ?? config.redis.db,
        retryStrategy: (times) => Math.min(times * 500, 10_000), // no logging here
        maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
        enableReadyCheck: config.redis.enableReadyCheck,
        commandTimeout: this.commandTimeout,
        enableOfflineQueue: false,
        connectTimeout: 10_000,
        keepAlive: 30_000,
        lazyConnect: true,
      });
      this.setupEventListeners();

      const ok = await this.client
        .connect()
        .then(() => true)
        .catch((err: any) => {
          const code =
            err?.code ?? err?.errors?.[0]?.code ?? err?.message ?? "unknown";
          logger.error(
            `❌ Redis: initial connection failed (${code}) — degraded mode`,
          );
          return false;
        });

      if (ok) await this.testConnection();
      return ok;
    } catch (error) {
      logger.error("❌ Redis: unexpected error during connect", {
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async testConnection(): Promise<void> {
    try {
      const result = await this.redis.ping();
      if (result === "PONG") {
        logger.info("✅ Redis: Ping successful");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("❌ Redis: Ping failed:", errorMessage);
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // EVENT LISTENERS
  // ─────────────────────────────────────────────

  private setupEventListeners(): void {
    this.redis.on("ready", async () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;

      if (this.downSince) {
        const secs = Math.round((Date.now() - this.downSince) / 1000);
        logger.info(`✅ Redis[${this.name}]: recovered after ${secs}s`);
        this.downSince = null;
      } else {
        logger.info(`✅ Redis[${this.name}]: ready`);
      }
      this.wasUp = true;

      // only the main instance rehydrates the blacklist
      if (this.rehydrateOnReady) {
        await rehydrateBlacklistOnRedisReconnect().catch((e) =>
          logger.error("Blacklist rehydrate failed", { message: e?.message }),
        );
      }
    });

    this.redis.on("error", (err: any) => {
      this.isConnected = false;
      const code =
        err?.code ??
        err?.errors?.map((e: any) => e.code).join(",") ??
        err?.message ??
        "unknown";
      logThrottled(
        "error",
        `${this.name}-redis-error`,
        `❌ Redis[${this.name}] unavailable: ${code}`,
      );
    });

    this.redis.on("close", () => {
      if (this.wasUp) {
        logger.warn(
          `🔌 Redis[${this.name}]: connection lost — using fallbacks`,
        );
        this.wasUp = false;
        this.downSince = Date.now();
      }
      this.isConnected = false;
    });

    this.redis.on("reconnecting", () => {
      this.reconnectAttempts++; // count only, no log
    });

    this.redis.on("end", () => {
      this.isConnected = false;
    });
  }

  async rateLimitHit(key: string, windowMs: number): Promise<RateLimitHit> {
    return this.execute<RateLimitHit>(
      async () => {
        const [count, ttl] = (await this.redis.eval(
          RedisConnection.RATE_LIMIT_LUA,
          1,
          key,
          windowMs,
        )) as [number, number];
        return { count, resetInMs: Math.max(0, ttl) };
      },
      async () => memoryRateLimitStore.hit(key, windowMs),
      `ratelimit:${key}`,
    );
  }

  private fallbackWarn(op: string, msg: string) {
    logThrottled("warn", `${this.name}-fallback-${op}`, msg);
  }

  // ─────────────────────────────────────────────
  // OPERATIONS
  // All go through execute() — circuit breaker
  // is applied automatically, no exceptions
  // ─────────────────────────────────────────────

  async set(key: string, value: unknown, ttl?: number): Promise<boolean> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (ttl !== undefined && (!Number.isInteger(ttl) || ttl < 0)) {
      throw new Error("TTL must be a non-negative integer");
    }

    const stringValue =
      typeof value === "string" ? value : JSON.stringify(value);

    return this.execute(
      async () => {
        if (ttl !== undefined) {
          await this.redis.setex(key, ttl, stringValue);
        } else {
          await this.redis.set(key, stringValue);
        }
        return true;
      },
      async () => {
        this.fallbackWarn("set", "Redis unavailable — set skipped");
        return false;
      },
      `set:${key}`,
    );
  }

  async get<T = unknown>(
    key: string,
    parseJson: boolean = true,
  ): Promise<T | string | null> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      async () => {
        const value = await this.redis.get(key);
        if (value === null) return null;
        if (parseJson) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value;
          }
        }
        return value;
      },
      async () => {
        this.fallbackWarn("get", "Redis unavailable — get returning null");
        return null;
      },
      `get:${key}`,
    ) as Promise<T | string | null>;
  }

  async delete(key: string): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      () => this.redis.del(key),
      async () => {
        this.fallbackWarn("delete", "Redis unavailable — delete skipped");
        return 0;
      },
      `delete:${key}`,
    );
  }

  async exists(key: string): Promise<boolean> {
    if (!key) throw new Error("Redis key must be a non-empty string");

    return this.execute(
      async () => (await this.redis.exists(key)) === 1,
      async () => {
        this.fallbackWarn(
          "exists",
          "Redis unavailable — exists returning false",
        );
        return false;
      },
      `exists:${key}`,
    );
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (!Number.isInteger(seconds) || seconds < 0)
      throw new Error("TTL must be a non-negative integer");

    return this.execute(
      () => this.redis.expire(key, seconds),
      async () => {
        this.fallbackWarn("expire", "Redis unavailable — expire skipped");
        return 0;
      },
      `expire:${key}`,
    );
  }

  async increment(key: string, amount: number = 1): Promise<number> {
    if (!key) throw new Error("Redis key must be a non-empty string");
    if (!Number.isInteger(amount))
      throw new Error("Increment amount must be an integer");

    return this.execute(
      () => this.redis.incrby(key, amount),
      async () => {
        logThrottled(
          "error",
          `${this.name}-fallback-increment`,
          "Redis unavailable — increment rejected to prevent silent bypass",
        );
        throw new Error("Redis unavailable — increment operation rejected");
      },
      `increment:${key}`,
    );
  }

  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    if (!keys.length) return [];

    return this.execute(
      async () => {
        const values = await this.redis.mget(keys);
        return values.map((value) => {
          try {
            return JSON.parse(value as string) as T;
          } catch {
            return value as T | null;
          }
        });
      },
      async () => {
        this.fallbackWarn("mget", "Redis unavailable — mget returning nulls");
        return keys.map(() => null as T | null);
      },
      `mget:${keys.join(",")}`,
    );
  }

  async flush(): Promise<void> {
    return this.execute(
      async () => {
        await this.redis.flushdb();
        logger.info("🗑️ Redis: Database flushed");
      },
      async () => {
        // flush should never silently no-op
        throw new Error("Redis unavailable — flush rejected");
      },
      `flush`,
    );
  }

  // ─────────────────────────────────────────────
  // HEALTH + TEARDOWN
  // ─────────────────────────────────────────────

  async getHealthStatus() {
    if (!this.client) {
      return { isConnected: false, error: "Redis client not initialized" };
    }

    try {
      const info = await this.redis.info();
      return {
        isConnected: this.isConnected,
        status: this.client.status,
        reconnectAttempts: this.reconnectAttempts,
        uptime: this.extractFromInfo(info, "uptime_in_seconds"),
      };
    } catch (error) {
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  isHealthy(): boolean {
    return this.isConnected && this.client !== null;
  }

  private extractFromInfo(info: string, key: string): string {
    if (!info || !key) return "N/A";
    const match = info.match(new RegExp(`^${key}:(.+)$`, "im"));
    return match ? match[1].trim() : "N/A";
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
      logger.info("👋 Redis: Disconnected gracefully");
    }
  }

  // Exposed only for edge cases — all normal usage should go through execute()
  public getClient(): Redis {
    if (!this.client)
      throw new Error("Redis client not initialized. Call connect() first.");
    return this.client;
  }
}

const redis = new RedisConnection({ name: "main" });
export default redis;

export const rateLimitRedis = new RedisConnection({
  name: "ratelimit",
  db: 2,
  rehydrateOnReady: false,
  commandTimeout: 300,
});

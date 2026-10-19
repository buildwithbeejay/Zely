import { createCircuitBreaker, BrokenCircuitError } from "../circuit-breaker";
import { logThrottled } from "@/shared/utils/throttled-log";

export const redisBreaker = createCircuitBreaker({
  service: "redis",
  strategy: "consecutive",
  consecutiveFailures: 3,
  halfOpenAfter: 15_000,
});

export async function withRedisBreaker<T>(
  fn: () => Promise<T>,
  fallback: () => Promise<T>,
  context?: string,
): Promise<T> {
  try {
    return await redisBreaker.execute(fn);
  } catch (err: any) {
    if (err instanceof BrokenCircuitError) {
      logThrottled(
        "warn",
        "redis-breaker-open",
        "Redis circuit OPEN — using fallbacks",
      );
    } else {
      logThrottled(
        "warn",
        "redis-op-failed",
        "Redis operation failed — using fallback",
        {
          error: err?.code ?? err?.message,
        },
      );
    }
    return fallback();
  }
}

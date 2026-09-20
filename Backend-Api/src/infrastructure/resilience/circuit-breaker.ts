import { logger } from "@/shared/utils/logger";
import {
  BrokenCircuitError,
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  handleWhen,
  IPolicy,
  retry,
  SamplingBreaker,
  wrap,
} from "cockatiel";
import { createCircuitBreakerMetrics, registry } from "./metrics";

import { Registry } from "prom-client";

// ─── Types
export interface CircuitBreakerConfig {
  service: string;
  strategy: "consecutive" | "sampling";
  consecutiveFailures?: number;
  samplingThreshold?: number;
  samplingDuration?: number;
  halfOpenAfter: number;
  retry?: {
    maxAttempts: number;
    initialDelayMs: number;
  };
  handleOnly?: (err: Error) => boolean;
}

export interface CircuitBreakerWrapper<T> {
  execute: <R>(fn: () => Promise<R>) => Promise<R>;

  isOpen: () => boolean;

  getState: () => "closed" | "open" | "half-open";
}

// ─── State tracking
const STATE_VALUES = {
  closed: 0,
  open: 1,
  "half-open": 2,
} as const;

// ─── Factory
export function createCircuitBreaker<T>(
  config: CircuitBreakerConfig,
  metricRegistry: Registry = registry,
): CircuitBreakerWrapper<T> {
  const {
    circuitBreakerState,
    circuitBreakerOpenTotal,
    circuitBreakerFailureTotal,
    circuitBreakerSuccessTotal,
  } = createCircuitBreakerMetrics(metricRegistry);

  const {
    service,
    strategy,
    consecutiveFailures = 5,
    samplingThreshold = 0.5,
    samplingDuration = 30_000,
    halfOpenAfter,
    handleOnly,
  } = config;

  circuitBreakerOpenTotal.labels(service).inc(0);
  circuitBreakerFailureTotal.labels(service).inc(0);
  circuitBreakerSuccessTotal.labels(service).inc(0);

  // Build error policy
  const errorPolicy = handleOnly ? handleWhen(handleOnly) : handleAll;

  // Build breaker strategy
  const breakerStrategy =
    strategy === "consecutive"
      ? new ConsecutiveBreaker(consecutiveFailures)
      : new SamplingBreaker({
          threshold: samplingThreshold,
          duration: samplingDuration,
        });

  // Build circuit breaker policy
  const breaker = circuitBreaker(errorPolicy, {
    halfOpenAfter,
    breaker: breakerStrategy,
  });

  // ── Track state
  let currentState: "closed" | "open" | "half-open" = "closed";

  const updateState = (state: "closed" | "open" | "half-open") => {
    currentState = state;
    circuitBreakerState.set({ service }, STATE_VALUES[state]);
  };

  // ── Wire events
  breaker.onBreak(() => {
    updateState("open");
    circuitBreakerOpenTotal.inc({ service });
    logger.error(`Circuit breaker OPENED for service: ${service}`, { service });
  });

  breaker.onReset(() => {
    updateState("closed");
    logger.info(`Circuit breaker CLOSED for service: ${service}`, { service });
  });

  breaker.onHalfOpen(() => {
    updateState("half-open");
    logger.warn(
      `Circuit breaker HALF-OPEN for service: ${service} — testing recovery`,
      { service },
    );
  });

  breaker.onSuccess(() => {
    circuitBreakerSuccessTotal.inc({ service });
  });

  breaker.onFailure(() => {
    circuitBreakerFailureTotal.inc({ service });
  });

  // ── Build final policy
  // Optionally wrap with retry
  let policy: IPolicy;

  if (config.retry) {
    const retryPolicy = retry(errorPolicy, {
      maxAttempts: config.retry.maxAttempts,
      backoff: new ExponentialBackoff({
        initialDelay: config.retry.initialDelayMs,
        maxDelay: 30_000,
      }),
    });
    policy = wrap(retryPolicy, breaker);
  } else {
    policy = breaker;
  }

  // Initialize state metric
  updateState("closed");

  return {
    execute: <R>(fn: () => Promise<R>): Promise<R> => {
      return policy.execute(fn);
    },

    isOpen: () => currentState === "open",

    getState: () => currentState,
  };
}

// Re-export BrokenCircuitError so callers can catch it
export { BrokenCircuitError };

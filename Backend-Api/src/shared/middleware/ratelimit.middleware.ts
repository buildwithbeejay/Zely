import {
  getKeyByIP,
  RateLimitConfig,
  RateLimitInfo,
} from "@/config/ratelimiter.config";
import { Request, Response, NextFunction } from "express";

import { logger } from "@/shared/utils/logger";
import redis, { rateLimitRedis } from "@/infrastructure/cache/redis.cli";

export function createRateLimitMiddleware(options: RateLimitConfig) {
  const failMode = options.failMode ?? "open";

  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (options.skip && options.skip(req)) {
        return next();
      }

      const keyGenerator = options.keyGenerator || getKeyByIP;
      const key = keyGenerator(req);

      let info: RateLimitInfo;
      try {
        // Redis if available, in-memory counter if not. Doesn't throw on Redis outages.
        const hit = await rateLimitRedis.rateLimitHit(
          `${options.keyPrefix}:${key}`,
          options.windowMs,
        );
        const retryAfter = Math.max(1, Math.ceil(hit.resetInMs / 1000));
        info = {
          limit: options.maxRequests,
          current: hit.count,
          remaining: Math.max(0, options.maxRequests - hit.count),
          resetTime: new Date(Date.now() + hit.resetInMs),
          retryAfter,
        };
      } catch (err) {
        // Last resort only: both Redis and the memory fallback failed (should never happen).
        logger.error("Rate limiter failure", {
          path: req.path,
          failMode,
          message: (err as Error)?.message,
        });
        if (failMode === "closed") {
          res.status(503).json({
            success: false,
            error: {
              code: "RATE_LIMIT_UNAVAILABLE",
              message:
                "Service temporarily unavailable. Please try again in a moment.",
            },
          });
          return;
        }
        return next();
      }

      res.setHeader("X-RateLimit-Limit", info.limit.toString());
      res.setHeader("X-RateLimit-Remaining", info.remaining.toString());
      res.setHeader("X-RateLimit-Reset", info.resetTime.toISOString());

      if (info.current > info.limit) {
        res.setHeader("Retry-After", info.retryAfter.toString());

        if (options.onLimitReached) {
          try {
            options.onLimitReached(req, info);
          } catch (cbErr) {
            logger.error("onLimitReached callback error", {
              message: (cbErr as Error)?.message,
            });
          }
        }

        res.status(429).json({
          success: false,
          error: {
            code: "RATE_LIMIT_EXCEEDED",
            message:
              options.message || "Too many requests, please try again later.",
            retryAfter: info.retryAfter,
            resetTime: info.resetTime.toISOString(),
          },
        });
        return;
      }

      next();
    } catch (error) {
      logger.error("Rate limit middleware unexpected error", {
        message: (error as Error)?.message,
      });
      next();
    }
  };
}

import { config } from "@/config/index";
import {
  scheduleReconciliation,
  startReconciliationWorker,
} from "@/modules/reconciliation/reconciliation.scheduler";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";
import redis from "@/infrastructure/cache/redis.cli";

async function bootstrap() {
  try {
    /** -------------------------
     * CONNECT TO MONGODB
     * ------------------------- */
    await mongoose.connect(config.database.mongodb.uri);
    logger.info("Poller connected to MongoDB");

    const ok = await redis.connect();
    if (!ok)
      logger.warn(
        "Redis unavailable at startup — worker running in degraded mode",
      );

    logger.info("Redis initialization completed");

    /** -------------------------
     * GRACEFUL SHUTDOWN
     * ------------------------- */
    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down poller");
      await mongoose.disconnect();
      await redis.disconnect();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down poller");
      await mongoose.disconnect();
      await redis.disconnect();
      process.exit(0);
    });

    // Catch unhandled errors — log but never crash silently
    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled rejection in poller process", { reason });
    });

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught exception in poller process", {
        error: err.message,
        stack: err.stack,
      });
      // Give logger time to flush before exiting
      setTimeout(() => process.exit(1), 1000);
    });

    /** -------------------------
     * START POLLER
     * ------------------------- */
    await scheduleReconciliation();
  } catch (err: any) {
    logger.error("Failed to bootstrap poller", { error: err.message });
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  logger.error("Failed to start reconciliation worker", {
    error: error instanceof Error ? error.message : String(error),
  });
});

// After your DB connections, scheduler init, etc.

startReconciliationWorker();

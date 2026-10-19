import { initFailedEvents, FailedEvent } from "@/events/idempotency";

import {
  ProcessorType,
  RetryEnvelope,
} from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { NotFoundError } from "@/shared/errors/notFoundError";
import BadRequestError from "@/shared/errors/badRequest";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { logger } from "@/shared/utils/logger";
import { PROCESSOR_REGISTRY } from "@/kafka/consumer/retry.consumer";

class DLQAdminService {
  // ─── List DLQ events ──────────────────────────────────────────────────────
  public listEvents = async (query: {
    search?: string;
    topic?: string;
    status?: string;
    errorType?: string;
    page?: number | string;
    limit?: number | string;
  }) => {
    const collection = await initFailedEvents();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const filter: Record<string, any> = {};
    if (query.topic && query.topic !== "ALL") filter.topic = query.topic;
    if (query.status && query.status !== "ALL") filter.status = query.status;
    if (query.errorType) filter.errorType = query.errorType;

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [
        { "payload.event.eventId": rx },
        { topic: rx },
        { error: rx },
      ];
    }

    const [docs, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ failedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      events: docs.map(this.mapEvent),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  };

  // ─── Get single event detail ──────────────────────────────────────────────
  public getEvent = async (eventId: string) => {
    const collection = await initFailedEvents();
    const doc = await collection.findOne({
      "payload.event.eventId": eventId,
    });
    if (!doc) throw new NotFoundError("DLQ_EVENT_NOT_FOUND");
    return this.mapEvent(doc);
  };

  // ─── Replay a single event ────────────────────────────────────────────────
  public replayEvent = async (eventId: string, adminUserId: string) => {
    const collection = await initFailedEvents();
    const doc = await collection.findOne({
      "payload.event.eventId": eventId,
    });

    if (!doc) throw new NotFoundError("DLQ_EVENT_NOT_FOUND");

    if (doc.status === "REPLAYED") {
      throw new BadRequestError("EVENT_ALREADY_REPLAYED");
    }

    const processorType = doc.payload?.meta?.processor as ProcessorType;
    const originalTopic = doc.payload?.meta?.originalTopic ?? doc.topic;

    if (!processorType || !PROCESSOR_REGISTRY[processorType]) {
      throw new BadRequestError(
        `UNKNOWN_PROCESSOR: ${processorType ?? "undefined"} — cannot replay`,
      );
    }

    const config = PROCESSOR_REGISTRY[processorType];

    // Rebuild the envelope exactly as it was before failure
    const envelope: RetryEnvelope = {
      event: doc.payload.event,
      meta: {
        ...doc.payload.meta,
        retryCount: 0, // reset for replay — this is a fresh manual attempt
        lastError: null,
      },
    };

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await config.processor(originalTopic, envelope, session);
      await session.commitTransaction();

      if (config.onSuccess) {
        await config.onSuccess(result, envelope);
      }

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "REPLAYED",
            replayedAt: new Date(),
            replayedBy: adminUserId,
            lastReplayError: null,
          },
          $inc: { replayAttempts: 1 },
        },
      );

      logger.info("✅ DLQ event replayed successfully", {
        eventId,
        processorType,
        adminUserId,
      });

      return { success: true, eventId, replayedAt: new Date() };
    } catch (err: any) {
      if (session.inTransaction()) await session.abortTransaction();

      const isPermanent =
        err instanceof PermanentError || err.name === "PermanentError";
      const newErrorType = isPermanent ? "PERMANENT" : "TRANSIENT";

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            status: "REPLAY_FAILED",
            errorType: newErrorType,
            lastReplayError: err.message,
            error: err.message,
          },
          $inc: { replayAttempts: 1 },
        },
      );

      logger.error("❌ DLQ event replay failed", {
        eventId,
        processorType,
        error: err.message,
      });

      throw new BadRequestError(
        `REPLAY_FAILED: ${err.message}${isPermanent ? " (permanent error — root cause must be fixed before replaying again)" : ""}`,
      );
    } finally {
      session.endSession();
    }
  };

  // ─── Replay all pending events for a topic ───────────────────────────────
  public replayTopic = async (topic: string, adminUserId: string) => {
    const collection = await initFailedEvents();
    const pending = await collection
      .find({ topic, status: { $ne: "REPLAYED" } })
      .toArray();

    if (pending.length === 0) {
      throw new BadRequestError("NO_PENDING_EVENTS_FOR_TOPIC");
    }

    const results = {
      succeeded: [] as string[],
      failed: [] as { eventId: string; error: string }[],
    };

    for (const doc of pending) {
      const eventId = doc.payload?.event?.eventId;
      try {
        await this.replayEvent(eventId, adminUserId);
        results.succeeded.push(eventId);
      } catch (err: any) {
        results.failed.push({ eventId, error: err.message });
      }
    }

    logger.info("Bulk topic replay completed", {
      topic,
      succeeded: results.succeeded.length,
      failed: results.failed.length,
    });

    return {
      success: true,
      replayedCount: results.succeeded.length,
      failedCount: results.failed.length,
      details: results,
      replayedAt: new Date(),
    };
  };

  // ─── Stats ────────────────────────────────────────────────────────────────
  public getStats = async () => {
    const collection = await initFailedEvents();

    const [pending, replayed, topics, maxRetriesReached] = await Promise.all([
      collection.countDocuments({ status: { $ne: "REPLAYED" } }),
      collection.countDocuments({ status: "REPLAYED" }),
      collection.distinct("topic", { status: { $ne: "REPLAYED" } }),
      collection.countDocuments({
        status: { $ne: "REPLAYED" },
        errorType: "PERMANENT",
      }),
    ]);

    return {
      pendingEvents: pending,
      replayedEvents: replayed,
      impactedTopics: topics.length,
      maxRetriesReached,
    };
  };

  private mapEvent = (doc: any) => ({
    eventId: doc.payload?.event?.eventId ?? "UNKNOWN",
    topic: doc.topic,
    error: doc.error,
    errorType: doc.errorType ?? "UNKNOWN",
    status: doc.status ?? "PENDING",
    retryCount: doc.payload?.meta?.retryCount ?? 0,
    maxRetries: 5, // or pull from config per processor if you want exact per-type max
    replayAttempts: doc.replayAttempts ?? 0,
    replayedAt: doc.replayedAt ?? null,
    replayedBy: doc.replayedBy ?? null,
    lastReplayError: doc.lastReplayError ?? null,
    sourceService: doc.payload?.meta?.processor ?? "unknown",
    failedAt: doc.failedAt,
    payload: doc.payload?.event,
    stackTrace: doc.lastReplayError ?? null,
  });

  // ─── Dismiss a single event ────────────────────────────────────────────────
  public dismissEvent = async (
    eventId: string,
    adminUserId: string,
    reason: string,
  ) => {
    const collection = await initFailedEvents();
    const doc = await collection.findOne({ "payload.event.eventId": eventId });

    if (!doc) throw new NotFoundError("DLQ_EVENT_NOT_FOUND");

    if (doc.status === "REPLAYED") {
      throw new BadRequestError("CANNOT_DISMISS_ALREADY_REPLAYED_EVENT");
    }

    await collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          status: "DISMISSED",
          dismissedAt: new Date(),
          dismissedBy: adminUserId,
          dismissReason: reason,
        },
      },
    );

    logger.info("DLQ event dismissed", { eventId, adminUserId, reason });

    return { success: true, eventId };
  };

  // ─── Bulk dismiss ───────────────────────────────────────────────────────────
  public bulkDismiss = async (
    eventIds: string[],
    adminUserId: string,
    reason: string,
  ) => {
    const collection = await initFailedEvents();

    const result = await collection.updateMany(
      {
        "payload.event.eventId": { $in: eventIds },
        status: { $ne: "REPLAYED" },
      },
      {
        $set: {
          status: "DISMISSED",
          dismissedAt: new Date(),
          dismissedBy: adminUserId,
          dismissReason: reason,
        },
      },
    );

    logger.info("Bulk DLQ dismiss completed", {
      requested: eventIds.length,
      dismissed: result.modifiedCount,
      adminUserId,
    });

    return {
      success: true,
      requestedCount: eventIds.length,
      dismissedCount: result.modifiedCount,
    };
  };

  // ─── Add a note ──────────────────────────────────────────────────────────────
  public addNote = async (
    eventId: string,
    adminUserId: string,
    text: string,
  ) => {
    const collection = await initFailedEvents();
    const doc = await collection.findOne({ "payload.event.eventId": eventId });

    if (!doc) throw new NotFoundError("DLQ_EVENT_NOT_FOUND");

    const note = {
      text,
      addedBy: adminUserId,
      addedAt: new Date(),
    };

    await collection.updateOne({ _id: doc._id }, { $push: { notes: note } });

    return { success: true, note };
  };
}

export default DLQAdminService;

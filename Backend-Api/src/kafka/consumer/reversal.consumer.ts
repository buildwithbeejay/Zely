import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { processReversalEvent } from "@/events/reversalProcessor.evt";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { logger } from "@/shared/utils/logger";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { ReversalEventSchema } from "../schema/reversal.schema";
import { validateWithSchema } from "../schema/zod.helper";

export const REVERSAL_CONSUMER_GROUP = "reversal-consumer";

const reversalConsumer = kafka.consumer({
  groupId: REVERSAL_CONSUMER_GROUP,
});

export async function runReversalConsumer() {
  await reversalConsumer.connect();

  await reversalConsumer.subscribe({
    topics: [TOPICS.REVERSAL_EVENTS],
    fromBeginning: false,
  });

  await reversalConsumer.run({
    autoCommit: false,
    eachMessage: async ({
      topic,
      partition,
      message,
    }: {
      topic: string;
      partition: number;
      message: any;
    }) => {
      if (!message.value) return;

      const timer = kafkaProcessingDuration.startTimer({
        topic,
        consumer_group: REVERSAL_CONSUMER_GROUP,
      });

      let envelope: RetryEnvelope;
      try {
        const raw = JSON.parse(message.value.toString());
        const parsedPayload =
          typeof raw.payload === "string"
            ? JSON.parse(raw.payload)
            : raw.payload;

        envelope = {
          meta: {
            retryCount: raw.retryCount ?? parsedPayload.meta?.retryCount ?? 0,
            createdAt:
              parsedPayload.meta?.createdAt ?? new Date().toISOString(),
            originalConsumerGroup: REVERSAL_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "reversal",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse reversal Kafka message", {
          topic,
          partition,
          offset: message.offset,
        });
        timer();
        await reversalConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const validatedEvent = validateWithSchema(
        ReversalEventSchema,
        envelope.event,
      );

      const validatedEnvelope: RetryEnvelope = {
        meta: envelope.meta,
        event: validatedEvent,
      };

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        REVERSAL_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: REVERSAL_CONSUMER_GROUP,
        });
        timer();
        await reversalConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      try {
        await withMongoTransaction(async (session) => {
          await processReversalEvent(topic, validatedEnvelope, session);

          await completeIdempotency(
            envelope.event.eventId,
            REVERSAL_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount,
          );
        });

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: REVERSAL_CONSUMER_GROUP,
        });
        timer();

        await reversalConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      } catch (error: any) {
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: REVERSAL_CONSUMER_GROUP,
        });
        timer();

        logger.error("Reversal event processing failed", {
          eventId: envelope.event.eventId,
          topic,
        });

        await failIdempotency(
          envelope.event.eventId,
          REVERSAL_CONSUMER_GROUP,
          topic,
          envelope.meta.retryCount,
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });

        await reversalConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      }
    },
  });
}

export async function stopReversalConsumer() {
  await reversalConsumer.disconnect();
  logger.info("✅ Reversal consumer disconnected");
}

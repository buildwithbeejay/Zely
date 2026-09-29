import { completeIdempotency, initIdempotency } from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { pinProcessor } from "@/events/pinProcessor.evt";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience";
import { kafka } from "@/kafka/config/kafka.config";
import { TOPICS } from "@/kafka/config/kafka.topics";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import { retryOrDLQ } from "@/kafka/retry.helpers/retry.handler";
import { PinEventSchema } from "@/kafka/schema/pin.schema";
import { validateWithSchema } from "@/kafka/schema/zod.helper";
import { logger } from "@/shared/utils/logger";

export const PIN_CONSUMER_GROUP = "pin-consumer";
const pinConsumer = kafka.consumer({ groupId: PIN_CONSUMER_GROUP });

export async function runPinConsumer() {
  await pinConsumer.connect();

  await pinConsumer.subscribe({
    topic: TOPICS.PIN_EVENTS,
    fromBeginning: false,
  });

  await pinConsumer.run({
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
        consumer_group: PIN_CONSUMER_GROUP,
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
            originalConsumerGroup: PIN_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "pin",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse PIN Kafka message", {
          topic,
          partition,
          offset: message.offset,
        });
        timer();
        await pinConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const validatedEvent = validateWithSchema(PinEventSchema, envelope.event);

      const validatedEnvelope: RetryEnvelope = {
        meta: envelope.meta,
        event: validatedEvent as any,
      };

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        PIN_CONSUMER_GROUP,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PIN_CONSUMER_GROUP,
        });
        timer();
        await pinConsumer.commitOffsets([
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
          await pinProcessor(topic, validatedEnvelope);

          await completeIdempotency(
            envelope.event.eventId,
            PIN_CONSUMER_GROUP,
            IdmChks.version,
            session,
          );
        });

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: PIN_CONSUMER_GROUP,
        });
        timer();

        await pinConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
      } catch (error: any) {
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: PIN_CONSUMER_GROUP,
        });
        timer();

        logger.error("PIN event processing failed", {
          topic,
          eventId: envelope.event.eventId,
          error: error.message,
        });

        await retryOrDLQ({ topic, message: envelope, error });

        await pinConsumer.commitOffsets([
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

export async function stopPinConsumer() {
  await pinConsumer.disconnect();
  logger.info("✅ PIN consumer disconnected");
}

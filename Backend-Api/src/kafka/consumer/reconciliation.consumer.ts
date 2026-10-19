import {
  completeIdempotency,
  failIdempotency,
  initIdempotency,
} from "@/events/idempotency";
import { withMongoTransaction } from "@/events/mongo.wrapper";
import { processReconciliationEvents } from "@/events/reconciliationProcessor.evt";
import {
  kafkaMessagesFailedTotal,
  kafkaMessagesProcessedTotal,
  kafkaProcessingDuration,
} from "@/infrastructure/resilience/metrics";
import { onEventConfirmed } from "@/kafka/producer/event.producer";
import { logger } from "@/shared/utils/logger";
import { kafka } from "../config/kafka.config";
import { TOPICS } from "../config/kafka.topics";
import { RetryEnvelope } from "../retry.helpers/retry.envelope";
import { retryOrDLQ } from "../retry.helpers/retry.handler";
import { ReconciliationEventSchema } from "../schema/reconciliation.schema";
import { validateWithSchema } from "../schema/zod.helper";

const RECONCILIATION_CONSUMER_GROUP = "reconciliation-consumer";
const reconciliationConsumer = kafka.consumer({
  groupId: RECONCILIATION_CONSUMER_GROUP,
});

export async function runReconciliationConsumer() {
  await reconciliationConsumer.connect();

  await reconciliationConsumer.subscribe({
    topic: TOPICS.RECONCILIATION_EVENTS,
    fromBeginning: false,
  });

  await reconciliationConsumer.run({
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
        consumer_group: RECONCILIATION_CONSUMER_GROUP,
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
            originalConsumerGroup: RECONCILIATION_CONSUMER_GROUP,
            originalTopic: topic,
            lastError: raw.lastError ?? parsedPayload.meta?.lastError,
            processor: "reconciliation",
          },
          event: {
            ...parsedPayload.event,
            action: raw.action,
            status: raw.status,
          },
        };
      } catch (e) {
        logger.error("Failed to parse reconciliation Kafka message", {
          topic,
          partition,
          offset: message.offset,
        });
        timer();
        await reconciliationConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      const IdmChks = await initIdempotency(
        envelope.event.eventId,
        topic,
        RECONCILIATION_CONSUMER_GROUP,
        envelope.meta.retryCount,
      );

      if (IdmChks.decision === "SKIP") {
        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: RECONCILIATION_CONSUMER_GROUP,
        });
        timer();
        await reconciliationConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);
        return;
      }

      try {
        const validatedEvent = validateWithSchema(
          ReconciliationEventSchema,
          envelope.event,
        ) as {
          eventId: string;
          eventType: string;
          version: 1;
          aggregateType: string;
          aggregateId: string;
          payload: any;
          occurredAt?: string;
          action: string;
          status: string;
          context: object;
        };

        const validatedEnvelope: RetryEnvelope = {
          meta: envelope.meta,
          event: validatedEvent,
        };

        await withMongoTransaction(async (session) => {
          await processReconciliationEvents(topic, validatedEnvelope, session);

          await completeIdempotency(
            envelope.event.eventId,
            RECONCILIATION_CONSUMER_GROUP,
            IdmChks.version,
            session,
            topic,
            envelope.meta.retryCount,
          );
        });

        kafkaMessagesProcessedTotal.inc({
          topic,
          consumer_group: RECONCILIATION_CONSUMER_GROUP,
        });
        timer();

        await reconciliationConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("Reconciliation event committed successfully", {
          eventType: envelope.event.eventType,
          eventId: envelope.event.eventId,
        });

        // await onEventConfirmed(validatedEnvelope, TOPICS.RECONCILIATION_EVENTS);
      } catch (error: any) {
        kafkaMessagesFailedTotal.inc({
          topic,
          consumer_group: RECONCILIATION_CONSUMER_GROUP,
        });
        timer();

        logger.error("Reconciliation event processing failed", {
          eventType: envelope.event?.eventType,
          eventId: envelope.event?.eventId,
          error: error.message,
        });

        await failIdempotency(
          envelope.event.eventId,
          RECONCILIATION_CONSUMER_GROUP,
          topic,
          envelope.meta.retryCount,
          IdmChks.version,
        );

        await retryOrDLQ({ topic, message: envelope, error });

        await reconciliationConsumer.commitOffsets([
          {
            topic,
            partition,
            offset: (parseInt(message.offset) + 1).toString(),
          },
        ]);

        logger.info("Offset committed after failure", {
          eventId: envelope.event?.eventId,
          offset: (parseInt(message.offset) + 1).toString(),
        });
      }
    },
  });
}

export async function stopReconciliationConsumer() {
  await reconciliationConsumer.disconnect();
  logger.info("✅ Reconciliation consumer disconnected");
}

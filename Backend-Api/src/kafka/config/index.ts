import { admin, producer } from "@/kafka/config/kafka.config";
import { logger } from "@/shared/utils/logger";
import { connectAdmin, createTopic, disconnectAdmin } from "./kafka.config";
import { TOPICS } from "./kafka.topics";

import {
  AUTH_RETRY_LEVELS,
  FUNDING_RETRY_LEVELS,
  KYC_RETRY_LEVELS,
  PAYMENT_RETRY_LEVELS,
  PIN_RETRY_LEVELS,
  RECONCILIATION_RETRY_LEVELS,
  REVERSAL_RETRY_LEVELS,
  TRANSFER_RETRY_LEVELS,
  VAULT_RETRY_LEVELS,
} from "../retry.helpers/retry.policy";

const PARTITIONS = 6;
const REPLICATION_FACTOR = 2;

export async function ensureTopicPartitions(
  topic: string,
  numPartitions = PARTITIONS,
): Promise<void> {
  const metadata = await admin.fetchTopicMetadata({
    topics: [topic],
  });

  const existingTopic = metadata.topics.find(
    (item: { name: string }) => item.name === topic,
  );

  if (!existingTopic) {
    throw new Error(`Kafka topic not found: ${topic}`);
  }

  const currentPartitions = existingTopic.partitions.length;

  if (currentPartitions < numPartitions) {
    await admin.createPartitions({
      topicPartitions: [
        {
          topic,
          count: numPartitions,
        },
      ],
    });

    console.info(
      `✅ Increased ${topic} from ${currentPartitions} to ${numPartitions} partitions`,
    );
  } else if (currentPartitions > numPartitions) {
    console.warn(
      `${topic} has ${currentPartitions} partitions; expected ${numPartitions}. Kafka cannot decrease partitions in place.`,
    );
  }
}

export const ALL_RETRY_LEVELS = [
  ...AUTH_RETRY_LEVELS,
  ...TRANSFER_RETRY_LEVELS,
  ...KYC_RETRY_LEVELS,
  ...PAYMENT_RETRY_LEVELS,
  ...FUNDING_RETRY_LEVELS,
  ...VAULT_RETRY_LEVELS,
  ...REVERSAL_RETRY_LEVELS,
  ...PIN_RETRY_LEVELS,
  ...RECONCILIATION_RETRY_LEVELS,
];

export async function setupKafkaTopics(): Promise<void> {
  await connectAdmin();

  try {
    const allTopics = new Set([
      ...Object.values(TOPICS),
      ...ALL_RETRY_LEVELS.map((level) => level.topic),
    ]);

    for (const topic of allTopics) {
      await createTopic(topic, PARTITIONS, REPLICATION_FACTOR);

      await ensureTopicPartitions(topic, PARTITIONS);
    }

    console.info(`✅ Kafka setup completed: ${allTopics.size} topics checked`);
  } finally {
    await disconnectAdmin();
  }
}

let isConnected = false;

export async function startKafkaProducer() {
  const p = producer;
  if (isConnected) return;
  try {
    await p.connect();
    isConnected = true;
    logger.info("=== ⚒️Kafka producer connected ===");
  } catch (err) {
    isConnected = false;
    throw new Error(
      `Kafka producer connection failed: ${(err as Error).message}`,
    );
  }
}

export async function shutdownKafkaProducer() {
  if (producer && isConnected) {
    try {
      await producer.disconnect();
      logger.info("Kafka producer disconnected gracefully");
      isConnected = false;
    } catch (err) {
      logger.error("Kafka producer disconnect failed", {
        error: (err as Error).message,
      });
    }
  }
}

export { producer };

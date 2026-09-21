import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import NotificationService from "@/modules/notification/notification.service";
import { NotificationType } from "@/modules/notification/notification.model";
import mongoose from "mongoose";

const notificationService = new NotificationService();

export async function kycEvent(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession,
) {
  const { payload, version, eventType } = envelope.event;

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("kyc.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      case "KYC_SUBMITTED":
        logger.info("KYC submission received — pending review", {
          email: payload.email,
        });
        break;

      case "KYC_APPROVED": {
        const { userId, newTier } = payload;

        await notificationService.createAndEmit({
          userId,
          type: NotificationType.KYC_APPROVED,
          title: "KYC Approved 🎉",
          message: `Your KYC submission has been approved. You are now ${newTier.replace("_", " ")}.`,
          referenceId: envelope.event.eventId,
        });

        logger.info("KYC approved — user notified", { userId, newTier });
        break;
      }

      case "KYC_REJECTED": {
        const { userId, targetTier, reason } = payload;

        await notificationService.createAndEmit({
          userId,
          type: NotificationType.KYC_REJECTED,
          title: "KYC Rejected",
          message: `Your KYC submission was rejected. Reason: ${reason ?? "No reason provided"}.`,
          referenceId: envelope.event.eventId,
        });

        logger.info("KYC rejected — user notified", {
          userId,
          targetTier,
          reason,
        });
        break;
      }

      default:
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }
    throw new TransientError(`[v${version}] Kyc event failed: ${err.message}`);
  }
}

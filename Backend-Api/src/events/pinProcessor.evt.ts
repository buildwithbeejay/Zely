import emailQueue from "@/infrastructure/queues/email.queue";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import OTPManager, {
  OTPConfigs,
  OTPPurpose,
  OTPThrottleError,
} from "@/modules/helpers/otp.manager";
import { logger } from "@/shared/utils/logger";

export async function pinProcessor(topic: string, envelope: RetryEnvelope) {
  const { payload, version, eventType, eventId } = envelope.event;
  const { email, name, userId } = payload ?? {};

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("pin.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      case "PIN_RESET_REQUESTED": {
        if (!email) throw new PermanentError("Missing required field: email");

        const otpManager = new OTPManager();

        try {
          const { code, expiryMinutes } = await otpManager.create(
            email,
            OTPPurpose.PIN_RESET,
            OTPConfigs.pinReset,
          );

          await emailQueue.add(
            "sendPinReset",
            {
              email,
              name,
              otp: code,
              expiryMinutes,
              type: "PIN_RESET_REQUEST",
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              jobId: `pin_reset_${email}_${code}`,
            },
          );

          logger.info("PIN reset OTP queued", { email });
        } catch (err) {
          if (err instanceof OTPThrottleError) {
            // User requested too recently — drop silently
            logger.info("PIN reset throttled at consumer", { email });
            break;
          }
          throw err;
        }

        break;
      }

      case "PIN_SETUP":
      case "PIN_CHANGE":
      case "PIN_RESET_SUCCESS": {
        // Emit confirmation email
        await emailQueue.add(
          "sendPinNotification",
          {
            email,
            name,
            type: eventType, // worker handles each type
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            jobId: `pin_notification_${email}_${eventId}`,
          },
        );

        logger.info(`PIN notification queued for ${eventType}`, { email });
        break;
      }

      case "PIN_LOCKED": {
        if (!email) throw new PermanentError("Missing required field: email");

        await emailQueue.add(
          "sendPinLockNotification",
          {
            email,
            name,
            type: "PIN_LOCKED",
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            jobId: `pin_locked_${email}_${eventId}`,
          },
        );

        logger.info("PIN lock notification queued", { email });
        break;
      }

      default:
        throw new PermanentError(`Unhandled PIN eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError)
      throw err;
    throw new TransientError(`PIN processor failed: ${err.message}`);
  }
}

import emailQueue from "@/infrastructure/queues/email.queue";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import { completeIdempotency, initIdempotency } from "./idempotency";
import OTPManager, {
  OTPConfigs,
  OTPPurpose,
  OTPThrottleError,
} from "@/modules/helpers/otp.manager";

export async function resetPasswordProcessor(
  topic: string,
  envelope: RetryEnvelope,
) {
  const { payload, version, eventType } = envelope.event;
  const { email, name } = payload ?? {};

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("password.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    if (!email) {
      throw new PermanentError(`Missing required field: email`);
    }

    switch (eventType) {
      case "PASSWORD_RESET_REQUESTED": {
        const OtpManager = new OTPManager();

        try {
          const { code, expiryMinutes } = await OtpManager.create(
            payload.email,
            OTPPurpose.PASSWORD_RESET,
            OTPConfigs.passwordReset,
          );

          // Enqueue BEFORE committing Kafka offset
          // If this throws, Kafka will redeliver and OTPManager throttle
          // will block a duplicate OTP from being created

          await emailQueue.add(
            "sendPasswordReset",
            {
              email: payload.email,
              name: payload.name,
              otp: code,
              expiryMinutes,
              type: "PASSWORD_RESET_REQUEST",
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              jobId: `pwd_reset_${payload.email}_${code}`,
            },
          );
        } catch (err) {
          if (err instanceof OTPThrottleError) {
            // User already got one recently. Drop silently.
            logger.info("Password reset throttled at consumer", {
              email: payload.email,
            });
            break;
          }
          throw err; // ← rethrow so Kafka does NOT commit offset and redelivers
        }

        logger.info("Password reset code queued", { email });
        break;
      }

      case "PASSWORD_RESET_CODE_VERIFIED": {
        logger.info("Password reset code verified", { email });
        break;
      }

      case "PASSWORD_RESET_SUCCESS": {
        await emailQueue.add(
          "passwordResetSuccess",
          {
            email,
            name,
            type: "PASSWORD_RESET_SUCCESS",
          },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            jobId: `pwd_success_${email}_${Date.now()}`,
          },
        );
        break;
      }

      default:
        // Unknown event type = contract mismatch → permanent
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] Password reset processor failed: ${err.message}`,
    );
  }
}

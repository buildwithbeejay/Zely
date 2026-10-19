import emailQueue from "@/infrastructure/queues/email.queue";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import OTPManager, {
  OTPConfigs,
  OTPPurpose,
  OTPThrottleError,
} from "@/modules/helpers/otp.manager";

export async function resetPasswordProcessor(
  topic: string,
  envelope: RetryEnvelope,
) {
  try {
    // Guarded + moved inside the try: a malformed envelope now becomes
    // a classified PermanentError instead of an uncaught TypeError that
    // escapes the retry-error contract entirely.
    if (!envelope?.event) {
      throw new PermanentError("Missing envelope.event");
    }

    const { payload, version, eventType } = envelope.event;
    const { email, name } = payload ?? {};

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

        // Phase 1: create the OTP. A throttle hit HERE means a genuine
        // duplicate request arrived while a still-valid OTP exists -
        // safe to drop.
        let code: string;
        let expiryMinutes: number;

        try {
          ({ code, expiryMinutes } = await OtpManager.create(
            email,
            OTPPurpose.PASSWORD_RESET,
            OTPConfigs.passwordReset,
          ));
        } catch (err) {
          if (err instanceof OTPThrottleError) {
            logger.info("Password reset throttled at consumer", { email });
            break;
          }
          throw err; // real creation failure -> TransientError -> redeliver
        }

        // Phase 2: enqueue the email. If THIS fails, the OTP already
        // exists, so a naive redelivery would hit the throttle above and
        // get dropped as a "duplicate" - even though the user never got
        // an email. Invalidate the OTP so the retry gets a clean slate.
        try {
          await emailQueue.add(
            "sendPasswordReset",
            {
              email,
              name,
              otp: code,
              expiryMinutes,
              type: "PASSWORD_RESET_REQUEST",
            },
            {
              attempts: 3,
              backoff: { type: "exponential", delay: 2000 },
              jobId: `pwd_reset_${email}_${code}`,
            },
          );
        } catch (err) {
          // invalidate() hard-deletes the unconsumed OTP row. That matters
          // because enforceRateLimit's cooldown check isn't filtered by
          // consumedAt - it just looks at the most recently *created* row
          // for this identifier+purpose. Without this call, a redelivery
          // that lands inside throttleSeconds (60s default) hits
          // OTPThrottleError and gets dropped as a "duplicate" - even
          // though no email ever went out the first time.
          await OtpManager.invalidate(email, OTPPurpose.PASSWORD_RESET).catch(
            (invalidateErr: any) =>
              logger.error(
                "Failed to invalidate OTP after enqueue failure - retry " +
                  "will be silently throttled and the user will never " +
                  "get an email",
                { email, error: invalidateErr?.message },
              ),
          );
          throw err; // still surfaces as TransientError for visibility/alerting
        }

        logger.info("Password reset code queued", { email });
        break;
      }

      case "PASSWORD_RESET_CODE_VERIFIED": {
        logger.info("Password reset code verified", { email });
        break;
      }

      case "PASSWORD_RESET_SUCCESS": {
        // Date.now() made this jobId different on every delivery attempt,
        // so a Kafka redelivery (crash/rebalance before offset commit,
        // etc.) could queue a second "your password changed" email.
        // Use something stable across redeliveries of the SAME event -
        // ideally an id or offset the envelope already carries. Swap in
        // whatever RetryEnvelope actually exposes here; the email/eventType
        // fallback is better than Date.now() but will also dedupe two
        // genuinely separate resets if they land in the same window.
        const dedupeKey =
          (envelope.event as any).id ??
          (envelope.event as any).offset ??
          `${email}_${eventType}`;

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
            jobId: `pwd_success_${dedupeKey}`,
          },
        );
        break;
      }

      default:
        // Unknown event type = contract mismatch -> permanent
        throw new PermanentError(`Unhandled eventType: ${eventType}`);
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(`Password reset processor failed: ${err.message}`);
  }
}

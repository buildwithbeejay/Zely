// shared, e.g. provisioning.helpers.ts
import User from "@/modules/auth/authmodel";
import { accountStatus } from "@/modules/auth/authinterface";
import { logger } from "@/shared/utils/logger";

export const markProvisioningFailedForEvent = async (event: any) => {
  logger.warn("markProvisioningFailedForEvent called", {
    eventType: event?.eventType,
    payload: event?.payload,
  });
  if (event?.eventType !== "USER_VERIFY_EMAIL_SUCCESS") return;

  const userId = event.payload?.userId;
  if (!userId) return;

  try {
    await User.updateOne(
      {
        userId,
        // never overwrite a completed account
        accountStatus: {
          $in: [
            accountStatus.EMAIL_VERIFIED,
            accountStatus.ACCOUNT_PROVISIONING,
            accountStatus.PROVISIONING_RETRYING,
          ],
        },
      },
      { $set: { accountStatus: accountStatus.PROVISIONING_FAILED } },
    );
  } catch (err: any) {
    logger.error("Failed to mark user PROVISIONING_FAILED", {
      userId,
      error: err.message,
    });
  }
};

import { generateActivityId } from "@/shared/utils/id.generator";
import { AdminActivity, AdminActivityType } from "./admin.activity.model";
import { logger } from "@/shared/utils/logger";

export async function recordAdminActivity(params: {
  adminUserId: string;
  adminEmail: string;
  type: AdminActivityType;
  description: string;
  targetUserId?: string;
  metadata?: Record<string, any>;
}) {
  try {
    await AdminActivity.create({
      activityId: generateActivityId(),
      ...params,
    });
  } catch (err: any) {
    // Non-fatal — never block the main action because of activity logging
    logger.warn("Failed to record admin activity", {
      type: params.type,
      error: err.message,
    });
  }
}

import mongoose, { Schema, Document } from "mongoose";

export enum AdminActivityType {
  USER_CREDITED = "USER_CREDITED",
  USER_SUSPENDED = "USER_SUSPENDED",
  USER_UNSUSPENDED = "USER_UNSUSPENDED",
  FEE_WAIVED = "FEE_WAIVED",
  FEE_WAIVED_AND_REFUNDED = "FEE_WAIVED_AND_REFUNDED",
  FEE_SWEPT = "FEE_SWEPT",
  TRANSFER_REVERSED = "TRANSFER_REVERSED",
  MANUAL_CREDIT = "MANUAL_CREDIT",
  KYC_APPROVED = "KYC_APPROVED",
  KYC_REJECTED = "KYC_REJECTED",
  TREASURY_TOPPED_UP = "TREASURY_TOPPED_UP",
  FEE_SCHEDULE_UPDATED = "FEE_SCHEDULE_UPDATED",
  SESSION_KILLED = "SESSION_KILLED",
  DLQ_EVENT_REPLAYED = "DLQ_EVENT_REPLAYED",
  DLQ_EVENT_DISMISSED = "DLQ_EVENT_DISMISSED",
}

export interface IAdminActivity extends Document {
  activityId: string;
  adminUserId: string;
  adminEmail: string;
  type: AdminActivityType;
  description: string;
  targetUserId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AdminActivitySchema = new Schema<IAdminActivity>(
  {
    activityId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    adminUserId: {
      type: String,
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(AdminActivityType),
      required: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
    },
    targetUserId: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AdminActivity = mongoose.model<IAdminActivity>(
  "AdminActivity",
  AdminActivitySchema,
);

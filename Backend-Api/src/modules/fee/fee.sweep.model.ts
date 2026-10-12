import mongoose, { Schema, Document } from "mongoose";

export enum FeeSweepStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export interface IFeeSweep extends Document {
  sweepId: string;
  initiatedBy: string;
  totalAmount: number;
  currency: string;
  accrualCount: number;
  status: FeeSweepStatus;
  completedAt?: Date;
  note?: string;
  createdAt: Date;
}

const FeeSweepSchema = new Schema<IFeeSweep>(
  {
    sweepId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    initiatedBy: {
      type: String,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    accrualCount: {
      type: Number,
      required: true,
      default: 0,
    },
    status: {
      type: String,
      enum: Object.values(FeeSweepStatus),
      default: FeeSweepStatus.PENDING,
    },
    completedAt: { type: Date, default: null },
    note: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FeeSweep = mongoose.model<IFeeSweep>("FeeSweep", FeeSweepSchema);

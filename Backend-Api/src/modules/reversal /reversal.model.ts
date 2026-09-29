import mongoose, { Schema, Document, Types } from "mongoose";
import { generateEventId } from "@/shared/utils/id.generator";

export enum ReversalStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum ReversalType {
  TRANSFER_REVERSAL = "TRANSFER_REVERSAL",
  MANUAL_CREDIT = "MANUAL_CREDIT",
}

export enum ReversalReason {
  FRAUD = "FRAUD",
  USER_DISPUTE = "USER_DISPUTE",
  COMPLIANCE = "COMPLIANCE",
  DUPLICATE_TRANSACTION = "DUPLICATE_TRANSACTION",
  TECHNICAL_ERROR = "TECHNICAL_ERROR",
  MANUAL_CREDIT_WEBHOOK_FAILURE = "MANUAL_CREDIT_WEBHOOK_FAILURE",
  OTHER = "OTHER",
}

export interface ReversalDocument extends Document {
  reversalId: string;
  type: ReversalType;
  status: ReversalStatus;

  originalTransactionRef: string;
  originalAmount: number;
  originalCurrency: string;
  originalFee: number;
  reverseFee: boolean;

  senderPublicId: string;
  receiverPublicId: string;

  reversalTransactionRef?: string;

  initiatedBy: string;
  initiatedAt: Date;

  reason: ReversalReason;
  notes: string;
  completedAt?: Date;
  failureReason?: string;

  receiverWentNegative: boolean;
  receiverFrozen: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const ReversalSchema = new Schema<ReversalDocument>(
  {
    reversalId: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      index: true,
      default: () => `REV_${generateEventId()}`,
    },
    type: {
      type: String,
      enum: Object.values(ReversalType),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReversalStatus),
      default: ReversalStatus.PENDING,
      index: true,
    },
    originalTransactionRef: {
      type: String,
      required: true,
      index: true,
    },
    originalAmount: { type: Number, required: true },
    originalCurrency: { type: String, required: true, uppercase: true },
    originalFee: { type: Number, default: 0 },
    reverseFee: { type: Boolean, default: true },
    senderPublicId: { type: String, required: true, index: true },
    receiverPublicId: { type: String, required: true, index: true },
    reversalTransactionRef: { type: String, index: true },
    initiatedBy: { type: String, required: true },
    initiatedAt: { type: Date, default: Date.now },
    reason: {
      type: String,
      enum: Object.values(ReversalReason),
      required: true,
    },
    notes: { type: String, required: true },
    completedAt: { type: Date },
    failureReason: { type: String },
    receiverWentNegative: { type: Boolean, default: false },
    receiverFrozen: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Critical — prevents two reversals on the same original transaction
ReversalSchema.index(
  { originalTransactionRef: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: ReversalType.TRANSFER_REVERSAL,
      status: { $in: [ReversalStatus.PENDING, ReversalStatus.COMPLETED] },
    },
  },
);

export const ReversalModel = mongoose.model<ReversalDocument>(
  "Reversal",
  ReversalSchema,
);

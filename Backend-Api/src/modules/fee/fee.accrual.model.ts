import mongoose, { Schema, Document, Types } from "mongoose";

export enum FeeAccrualStatus {
  ACCRUED = "ACCRUED",
  SWEPT = "SWEPT",
  WAIVED = "WAIVED",
}

export enum FeeCategory {
  P2P_TRANSFER = "P2P_TRANSFER",
  PAYSTACK_INGRESS = "PAYSTACK_INGRESS",
  VAULT_TRANSFER = "VAULT_TRANSFER",
  INTERNAL_TRANSFER = "INTERNAL_TRANSFER",
  STAMP_DUTY_ETL = "STAMP_DUTY_ETL",
}

export interface IFeeAccrual extends Document {
  accrualId: string;
  transactionRef: string;
  feeTransactionRef: string;
  ledgerEntryId: Types.ObjectId;
  payerUserId: string;
  payerName: string;
  category: FeeCategory;
  amount: number;
  currency: string;
  transitAccount: string;
  status: FeeAccrualStatus;
  sweepId?: Types.ObjectId;
  waivedBy?: string;
  waivedAt?: Date;
  waiverReason?: string;
  createdAt: Date;
}

const FeeAccrualSchema = new Schema<IFeeAccrual>(
  {
    accrualId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    transactionRef: {
      type: String,
      required: true,
      index: true,
    },
    feeTransactionRef: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    payerUserId: {
      type: String,
      required: true,
      index: true,
    },
    payerName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: Object.values(FeeCategory),
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
    },
    transitAccount: {
      type: String,
      required: true,
      default: "sys_fees_pool",
    },
    status: {
      type: String,
      enum: Object.values(FeeAccrualStatus),
      default: FeeAccrualStatus.ACCRUED,
      index: true,
    },
    sweepId: {
      type: Types.ObjectId,
      ref: "FeeSweep",
      default: null,
    },
    waivedBy: { type: String, default: null },
    waivedAt: { type: Date, default: null },
    waiverReason: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const FeeAccrual = mongoose.model<IFeeAccrual>(
  "FeeAccrual",
  FeeAccrualSchema,
);

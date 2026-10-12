import z from "zod";
import { BaseEventSchema } from "./index.schema";

export const TransferReversedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("TRANSFER_REVERSED"),
  version: z.literal(1),
  aggregateType: z.literal("REVERSAL"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    reversalId: z.string(),
    originalTransactionRef: z.string(),
    reversalTransactionRef: z.string(),
    senderPublicId: z.string(),
    receiverPublicId: z.string(),
    originalAmount: z.number(),
    originalFee: z.number(),
    reverseFee: z.boolean(),
    reversalAmount: z.number(),
    reason: z.string(),
    notes: z.string(),
    receiverWentNegative: z.boolean(),
    receiverFrozen: z.boolean(),
    adminPublicId: z.string(),
  }),
});

export const WalletNegativeBalanceV1Schema = BaseEventSchema.extend({
  eventType: z.literal("WALLET_NEGATIVE_BALANCE"),
  version: z.literal(1),
  aggregateType: z.literal("WALLET"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    walletId: z.string(),
    userPublicId: z.string(),
    balance: z.number(),
    reversalId: z.string(),
    requiresCollectionAction: z.boolean(),
  }),
});

export const ReconciliationDriftDetectedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_DRIFT_DETECTED"),
  version: z.literal(1),
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    ledgerAccountPublicId: z.string().optional(),
    ownerType: z.string().optional(),
    ownerPublicId: z.string().optional(),
    cachedBalance: z.number().optional(),
    trueBalance: z.number().optional(),
    drift: z.number().optional(),
    severity: z.string().optional(),
    action: z.string().optional(),
    autoFrozen: z.boolean().optional(),
    type: z.string().optional(), // for SYSTEM_INVARIANT_BREACH etc.
  }),
});

export const ReversalEventSchema = z.union([
  TransferReversedV1Schema,
  WalletNegativeBalanceV1Schema,
  ReconciliationDriftDetectedV1Schema,
]);

export type ReversalEvent = z.infer<typeof ReversalEventSchema>;

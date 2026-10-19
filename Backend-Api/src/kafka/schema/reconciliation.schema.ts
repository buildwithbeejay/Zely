import { z } from "zod";
import { BaseEventSchema } from "./index.schema";

// ─── RECONCILIATION_DRIFT_DETECTED ───────────────────────────────────────────
// This event is emitted in four different situations, each with a different
// payload shape. We discriminate on payload.type.

const LedgerDriftPayloadSchema = z.object({
  type: z.literal("LEDGER_DRIFT"),
  ledgerAccountPublicId: z.string(),
  ownerType: z.string(),
  ownerPublicId: z.string(),
  currency: z.string(),
  cachedBalance: z.number(),
  trueBalance: z.number(),
  drift: z.number(),
  severity: z.string(),
  action: z.string(),
  autoFrozen: z.boolean(),
});

const SystemInvariantPayloadSchema = z.object({
  type: z.literal("SYSTEM_INVARIANT_BREACH"),
  totalWalletBalance: z.number(),
  totalLedgerNet: z.number(),
  invariantDrift: z.number(),
  severity: z.literal("CRITICAL"),
});

const PaymentSettlementPayloadSchema = z.object({
  type: z.literal("PAYMENT_SETTLEMENT"),
  date: z.string(),
  totalChecked: z.number(),
  driftsFound: z.number(),
  drifts: z.array(z.any()),
});

const DriftEscalationPayloadSchema = z.object({
  type: z.literal("DRIFT_ESCALATION"),
  runId: z.string(),
  unresolvedCount: z.number(),
  oldestDetectedAt: z.union([z.string(), z.date()]).optional(),
  severity: z.literal("HIGH"),
  message: z.string(),
});

export const ReconciliationDriftDetectedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_DRIFT_DETECTED"),
  version: z.literal(1),
  aggregateType: z.string(),
  aggregateId: z.string(),
  payload: z.discriminatedUnion("type", [
    LedgerDriftPayloadSchema,
    SystemInvariantPayloadSchema,
    PaymentSettlementPayloadSchema,
    DriftEscalationPayloadSchema,
  ]),
});

// ─── RECONCILIATION_RUN_COMPLETED ────────────────────────────────────────────

export const ReconciliationRunCompletedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_RUN_COMPLETED"),
  version: z.literal(1),
  aggregateType: z.literal("RECONCILIATION_RUN"),
  aggregateId: z.string(),
  payload: z.object({
    runId: z.string(),
    accountsChecked: z.number(),
    driftsFound: z.number(),
    durationMs: z.number(),
    triggeredBy: z.enum(["SCHEDULED", "MANUAL"]),
  }),
});

// ─── RECONCILIATION_DRIFT_RESOLVED ───────────────────────────────────────────

export const ReconciliationDriftResolvedV1Schema = BaseEventSchema.extend({
  eventType: z.literal("RECONCILIATION_DRIFT_RESOLVED"),
  version: z.literal(1),
  aggregateType: z.literal("RECONCILIATION_RESOLUTION"),
  aggregateId: z.string(),
  payload: z.object({
    runId: z.string(),
    ledgerAccountPublicId: z.string(),
    resolutionType: z.string(),
    notes: z.string().optional(),
    resolvedBy: z.string(),
    correctionMethod: z.string().optional(),
    compensatingEntryRef: z.string().optional(),
    selfHealed: z.boolean().optional(),
    recordedDrift: z.number().optional(),
    liveStateAtResolution: z
      .object({
        liveCachedBalance: z.number(),
        liveTrueBalance: z.number(),
        liveDrift: z.number(),
      })
      .optional(),
  }),
});

// ─── UNION ───────────────────────────────────────────────────────────────────

export const ReconciliationEventSchema = z.discriminatedUnion("eventType", [
  ReconciliationDriftDetectedV1Schema,
  ReconciliationRunCompletedV1Schema,
  ReconciliationDriftResolvedV1Schema,
]);

export type ReconciliationEvent = z.infer<typeof ReconciliationEventSchema>;

import { EmailOutboxModel } from "@/kafka/emails/email.Outbox";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";

export async function processReconciliationEvents(
  topic: string,
  envelope: any,
  session: mongoose.ClientSession,
) {
  const { payload, version, eventType, eventId } = envelope.event;

  try {
    if (version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    if (!topic.startsWith("reconciliation.")) {
      throw new PermanentError(`Unsupported topic: ${topic}`);
    }

    switch (eventType) {
      // ─── Drift detected — could be ledger, invariant, payment, or escalation
      case "RECONCILIATION_DRIFT_DETECTED": {
        switch (payload.type) {
          case "LEDGER_DRIFT": {
            // A single wallet or vault drifted from its ledger backing.
            // Real-life: user's wallet shows ₦5,000 but ledger only backs ₦3,000.
            // → Alert admin so they can investigate and resolve via the dashboard.
            logger.warn("Ledger drift detected", {
              ledgerAccountPublicId: payload.ledgerAccountPublicId,
              ownerType: payload.ownerType,
              drift: payload.drift,
              severity: payload.severity,
              autoFrozen: payload.autoFrozen,
            });

            await EmailOutboxModel.create(
              [
                {
                  jobName: "reconciliationDriftAlert",
                  jobId: `${payload.ledgerAccountPublicId}_LEDGER_DRIFT_${eventId}`,
                  eventId,
                  aggregateType: "RECONCILIATION_DRIFT",
                  payload: {
                    type: "LEDGER_DRIFT_ALERT",
                    ledgerAccountPublicId: payload.ledgerAccountPublicId,
                    ownerType: payload.ownerType,
                    ownerPublicId: payload.ownerPublicId,
                    currency: payload.currency,
                    cachedBalance: payload.cachedBalance,
                    trueBalance: payload.trueBalance,
                    drift: payload.drift,
                    severity: payload.severity,
                    autoFrozen: payload.autoFrozen,
                  },
                  status: "PENDING",
                  attempts: 0,
                  envelope,
                },
              ],
              { session },
            );
            break;
          }

          case "SYSTEM_INVARIANT_BREACH": {
            // The sum of all wallet balances no longer equals the net of all
            // ledger entries system-wide. This is the most critical alert.
            // Real-life: like a bank's books not balancing at end of day.
            logger.error("CRITICAL — System invariant breached", {
              totalWalletBalance: payload.totalWalletBalance,
              totalLedgerNet: payload.totalLedgerNet,
              invariantDrift: payload.invariantDrift,
            });

            await EmailOutboxModel.create(
              [
                {
                  jobName: "reconciliationInvariantBreach",
                  jobId: `SYSTEM_INVARIANT_BREACH_${eventId}`,
                  eventId,
                  aggregateType: "RECONCILIATION_INVARIANT",
                  payload: {
                    type: "SYSTEM_INVARIANT_BREACH",
                    totalWalletBalance: payload.totalWalletBalance,
                    totalLedgerNet: payload.totalLedgerNet,
                    invariantDrift: payload.invariantDrift,
                    severity: payload.severity,
                  },
                  status: "PENDING",
                  attempts: 0,
                  envelope,
                },
              ],
              { session },
            );
            break;
          }

          case "PAYMENT_SETTLEMENT": {
            // Our records vs Paystack don't match for a given date.
            // Real-life: Paystack charged a user ₦10,000 but we recorded ₦8,000.
            logger.warn("Paystack settlement drift detected", {
              date: payload.date,
              totalChecked: payload.totalChecked,
              driftsFound: payload.driftsFound,
            });

            await EmailOutboxModel.create(
              [
                {
                  jobName: "reconciliationSettlementAlert",
                  jobId: `PAYMENT_SETTLEMENT_${payload.date}_${eventId}`,
                  eventId,
                  aggregateType: "RECONCILIATION_SETTLEMENT",
                  payload: {
                    type: "PAYMENT_SETTLEMENT_ALERT",
                    date: payload.date,
                    totalChecked: payload.totalChecked,
                    driftsFound: payload.driftsFound,
                    drifts: payload.drifts,
                  },
                  status: "PENDING",
                  attempts: 0,
                  envelope,
                },
              ],
              { session },
            );
            break;
          }

          case "DRIFT_ESCALATION": {
            // A drift was detected more than 7 days ago and still not resolved.
            // Real-life: like a fraud report sitting on someone's desk unread
            // for a week — now it gets escalated to senior staff.
            logger.error("Drift escalation — unresolved for 7+ days", {
              runId: payload.runId,
              unresolvedCount: payload.unresolvedCount,
              message: payload.message,
            });

            await EmailOutboxModel.create(
              [
                {
                  jobName: "reconciliationEscalation",
                  jobId: `DRIFT_ESCALATION_${payload.runId}_${eventId}`,
                  eventId,
                  aggregateType: "RECONCILIATION_ESCALATION",
                  payload: {
                    type: "DRIFT_ESCALATION_ALERT",
                    runId: payload.runId,
                    unresolvedCount: payload.unresolvedCount,
                    oldestDetectedAt: payload.oldestDetectedAt,
                    severity: payload.severity,
                    message: payload.message,
                  },
                  status: "PENDING",
                  attempts: 0,
                  envelope,
                },
              ],
              { session },
            );
            break;
          }

          default:
            throw new PermanentError(
              `Unknown RECONCILIATION_DRIFT_DETECTED subtype: ${(payload as any).type}`,
            );
        }
        break;
      }

      // ─── Full reconciliation run finished
      case "RECONCILIATION_RUN_COMPLETED": {
        // Real-life: like the auditor finishing their full stockroom check
        // and handing management a summary report.
        logger.info("✅ Reconciliation run completed", {
          runId: payload.runId,
          accountsChecked: payload.accountsChecked,
          driftsFound: payload.driftsFound,
          durationMs: payload.durationMs,
          triggeredBy: payload.triggeredBy,
        });

        // Only queue an email if drifts were actually found
        if (payload.driftsFound > 0) {
          await EmailOutboxModel.create(
            [
              {
                jobName: "reconciliationRunSummary",
                jobId: `RUN_COMPLETED_${payload.runId}`,
                eventId,
                aggregateType: "RECONCILIATION_RUN",
                payload: {
                  type: "RUN_SUMMARY",
                  runId: payload.runId,
                  accountsChecked: payload.accountsChecked,
                  driftsFound: payload.driftsFound,
                  durationMs: payload.durationMs,
                  triggeredBy: payload.triggeredBy,
                },
                status: "PENDING",
                attempts: 0,
                envelope,
              },
            ],
            { session },
          );
        }
        break;
      }

      // ─── A drift was manually resolved by an admin
      case "RECONCILIATION_DRIFT_RESOLVED": {
        // Real-life: admin investigated, confirmed the cache was wrong,
        // applied DIRECT_CACHE_SYNC, wallet is now unfrozen and back to normal.
        logger.info("✅ Drift resolved", {
          runId: payload.runId,
          ledgerAccountPublicId: payload.ledgerAccountPublicId,
          resolutionType: payload.resolutionType,
          resolvedBy: payload.resolvedBy,
          correctionMethod: payload.correctionMethod,
          selfHealed: payload.selfHealed,
        });
        break;
      }

      default:
        throw new PermanentError(
          `Unsupported reconciliation event type: ${eventType}`,
        );
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }

    throw new TransientError(
      `[v${version}] reconciliation event failed: ${err.message}`,
    );
  }
}

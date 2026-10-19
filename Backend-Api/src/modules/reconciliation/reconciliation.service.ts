import { config } from "@/config/index";
import { IRequestContext } from "@/config/interfaces/request.interface";
import redis from "@/infrastructure/cache/redis.cli";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "@/modules/ledger/ledger.account.model";
import {
  LedgerEntryNature,
  LedgerEntryType,
} from "@/modules/ledger/ledger.entry.model";
import TransactionBuilder from "@/modules/ledger/ledger.transaction.builder";
import {
  ReversalModel,
  ReversalStatus,
} from "@/modules/reversal /reversal.model";
import { Wallet, WalletStatus } from "@/modules/wallet/wallet.model";
import BadRequestError from "@/shared/errors/badRequest";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { logThrottled } from "@/shared/utils/throttled-log";
import { randomUUID } from "crypto";
import mongoose, { ClientSession } from "mongoose";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import {
  checkSystemBalanceInvariant,
  classifyDrift,
  computeTrueBalance,
  getCachedBalance,
  reconcileLedgerAccount,
  reconcilePaystackSettlements,
  updateCachedBalance,
} from "./reconciliation.helpers";
import {
  CorrectionMethod,
  DriftResolutionType,
  DriftSeverity,
  IDriftRecord,
  ReconciliationReport,
  ReconciliationStatus,
} from "./reconciliation.model";

const BATCH_SIZE = 100;

const token = randomUUID();

class ReconciliationService {
  // Public API: reconcile a single account
  public async reconcileSingleAccount(
    ledgerAccountId: string,
    context: IRequestContext,
    options: { freezeOnDrift?: boolean; triggeredByUserId?: string } = {},
  ) {
    const ledgerAccount = await LedgerAccount.findById(ledgerAccountId).lean();
    if (!ledgerAccount) throw new BadRequestError("ledger account not found");

    const report = await ReconciliationReport.create({
      status: ReconciliationStatus.RUNNING,
      startedAt: new Date(),
      accountsChecked: 0,
      driftsFound: 0,
      drifts: [],
      triggeredBy: "MANUAL",
      triggeredByUserId: options.triggeredByUserId
        ? (mongoose.Types.ObjectId.createFromHexString(
            options.triggeredByUserId,
          ) as any)
        : undefined,
    });

    try {
      const driftRecord = await reconcileLedgerAccount(ledgerAccount, context, {
        freezeOnDrift: options.freezeOnDrift ?? true,
      });

      const driftsFound =
        driftRecord.severity !== DriftSeverity.IN_SYNC ? 1 : 0;
      const finishedAt = new Date();

      report.status = ReconciliationStatus.COMPLETED;
      report.finishedAt = finishedAt;
      report.durationMs = finishedAt.getTime() - report.startedAt.getTime();
      report.accountsChecked = 1;
      report.driftsFound = driftsFound;
      report.drifts = [driftRecord];
      await report.save();

      return report.toJSON();
    } catch (err: any) {
      report.status = ReconciliationStatus.FAILED;
      report.finishedAt = new Date();
      report.errorMessage = err.message;
      await report.save();
      throw err;
    }
  }

  // ─── Public API: reconcile every active ledger account //Checked
  public async reconcileAllAccounts(
    context: IRequestContext,
    options: {
      freezeOnDrift?: boolean;
      triggeredBy?: "SCHEDULED" | "MANUAL";
      triggeredByUserId?: string;
    } = {},
  ) {
    const triggeredBy = options.triggeredBy ?? "SCHEDULED";

    // ── 1. Acquire lock BEFORE creating the report ──────────────────────────
    const lockKey = "reconciliation:global:lock";
    const lockTtl = 60 * 60; // 1 hour

    const acquired = await redis.execute<boolean>(
      async () =>
        (await redis.getClient().set(lockKey, token, "EX", lockTtl, "NX")) ===
        "OK",
      async () => false,
      "reconcile:lock",
    );

    if (!acquired) {
      logThrottled(
        "warn",
        "reconcile-lock-skip",
        "Reconciliation skipped: lock held elsewhere or Redis unavailable",
      );
      return; // no report created — nothing to clean up
    }

    // ── 2. Only create the report once we own the lock ──────────────────────
    const report = await ReconciliationReport.create({
      status: ReconciliationStatus.RUNNING,
      startedAt: new Date(),
      accountsChecked: 0,
      driftsFound: 0,
      drifts: [],
      triggeredBy,
      triggeredByUserId: options.triggeredByUserId
        ? (mongoose.Types.ObjectId.createFromHexString(
            options.triggeredByUserId,
          ) as any)
        : undefined,
    });

    logger.info("🔍 Reconciliation run started", {
      runId: report.runId,
      triggeredBy,
    });

    try {
      let accountsChecked = 0;
      let driftsFound = 0;
      const drifts: IDriftRecord[] = [];

      const cursor = LedgerAccount.find({}).lean().cursor();
      let batch: any[] = [];

      for await (const account of cursor) {
        batch.push(account);

        if (batch.length >= BATCH_SIZE) {
          const batchDrifts = await Promise.all(
            batch.map((acc) =>
              reconcileLedgerAccount(acc, context, {
                freezeOnDrift: options.freezeOnDrift ?? true,
              }),
            ),
          );

          for (const d of batchDrifts) {
            accountsChecked++;
            if (d.severity !== DriftSeverity.IN_SYNC) {
              driftsFound++;
              drifts.push(d);
            }
          }

          batch = [];
        }
      }

      if (batch.length > 0) {
        const batchDrifts = await Promise.all(
          batch.map((acc) =>
            reconcileLedgerAccount(acc, context, {
              freezeOnDrift: options.freezeOnDrift ?? true,
            }),
          ),
        );

        for (const d of batchDrifts) {
          accountsChecked++;
          if (d.severity !== DriftSeverity.IN_SYNC) {
            driftsFound++;
            drifts.push(d);
          }
        }
      }

      const finishedAt = new Date();
      report.status = ReconciliationStatus.COMPLETED;
      report.finishedAt = finishedAt;
      report.durationMs = finishedAt.getTime() - report.startedAt.getTime();
      report.accountsChecked = accountsChecked;
      report.driftsFound = driftsFound;
      report.drifts = drifts;
      await report.save();

      logger.info("✅ Reconciliation run completed", {
        runId: report.runId,
        accountsChecked,
        driftsFound,
        durationMs: report.durationMs,
      });

      await emitOutboxEvent({
        topic: "reconciliation.events",
        eventId: generateEventId(),
        eventType: AuditAction.RECONCILIATION_RUN_COMPLETED,
        action: AuditAction.RECONCILIATION_RUN_COMPLETED,
        status: AuditStatus.PENDING,
        payload: {
          runId: report.runId,
          accountsChecked,
          driftsFound,
          durationMs: report.durationMs,
          triggeredBy,
        },
        aggregateType: "RECONCILIATION_RUN",
        aggregateId: report.runId,
        version: 1,
        context,
      });

      return report.toJSON();
    } catch (err: any) {
      report.status = ReconciliationStatus.FAILED;
      report.finishedAt = new Date();
      report.errorMessage = err.message;
      await report.save();

      logger.error("❌ Reconciliation run failed", {
        runId: report.runId,
        error: err.message,
      });
      throw err;
    } finally {
      // ── 3. Only release the lock if this instance still owns it ───────────
      const currentToken = await redis.execute<string | null>(
        async () => redis.getClient().get(lockKey),
        async () => null,
        "reconcile:lock-check",
      );

      if (currentToken === token) {
        await redis.delete(lockKey);
      } else {
        logger.warn("Reconciliation lock not released — token mismatch", {
          expected: token,
          found: currentToken,
        });
      }
    }
  }

  // ─── Public API: list past reports (admin dashboard)
  public async getReports(
    filters: {
      status?: ReconciliationStatus;
      triggeredBy?: "SCHEDULED" | "MANUAL";
      onlyWithDrifts?: boolean;
      limit?: number;
      skip?: number;
    } = {},
  ) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.triggeredBy) query.triggeredBy = filters.triggeredBy;
    if (filters.onlyWithDrifts) query.driftsFound = { $gt: 0 };

    return ReconciliationReport.find(query)
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 50)
      .skip(filters.skip ?? 0)
      .lean();
  }

  // ─── Public API: get one report by runId
  public async getReportById(runId: string) {
    const report = await ReconciliationReport.findOne({ runId }).lean();
    if (!report) throw new BadRequestError("Report not found");
    return report;
  }

  //Checked
  public async resolveDrift(params: {
    runId: string;
    ledgerAccountPublicId: string;
    resolutionType: DriftResolutionType;
    notes: string;
    adminId: string;
    adminPublicId: string;
    applyCorrection: boolean;
    correctionMethod?: CorrectionMethod;
    context: IRequestContext;
  }) {
    const {
      runId,
      ledgerAccountPublicId,
      resolutionType,
      notes,
      adminPublicId,
      applyCorrection,
      context,
    } = params;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    try {
      const report = await ReconciliationReport.findOne({ runId }).session(
        session,
      );
      if (!report) throw new BadRequestError("Report not found");

      const driftIndex = report.drifts.findIndex(
        (d) => d.ledgerAccountPublicId === ledgerAccountPublicId,
      );
      if (driftIndex === -1) throw new BadRequestError("Drift not found");

      const driftDoc = report.drifts[driftIndex];
      if (driftDoc.resolvedAt)
        throw new BadRequestError("Drift already resolved");

      // ── 1. Recompute live drift inside the transaction ─────────────────────
      // The drift in the report was snapshotted at detection time. The ledger
      // may have moved since then. Always correct against the live state, never
      // against the stale snapshot.
      const ledgerAccount = await LedgerAccount.findOne({
        ledgerAccountId: ledgerAccountPublicId,
      }).session(session);

      if (!ledgerAccount) throw new BadRequestError("Ledger account not found");

      const liveTrueBalance = await computeTrueBalance(
        ledgerAccount._id,
        session,
      );
      const { balance: liveCachedBalance } = await getCachedBalance(
        ledgerAccount.ownerId,
        ledgerAccount.ownerType,
        ledgerAccount._id,
        session,
      );
      const { drift: liveDrift, severity: liveSeverity } = classifyDrift(
        liveCachedBalance,
        liveTrueBalance,
      );

      // ── 2. If drift self-healed, skip correction ───────────────────────────
      let compensatingEntryRef: string | undefined;
      let selfHealed = false;

      if (applyCorrection && resolutionType === DriftResolutionType.CORRECTED) {
        if (liveSeverity === DriftSeverity.IN_SYNC) {
          selfHealed = true;
          logger.info("Drift self-healed before correction — skipping write", {
            runId,
            ledgerAccountPublicId,
            recordedDrift: driftDoc.drift,
            liveState: { liveCachedBalance, liveTrueBalance },
          });
        } else {
          // Build a fresh drift record from live numbers so correction methods
          // never see the stale snapshot
          const liveDriftRecord: IDriftRecord = {
            // Identity — all from live fetch, never the stored subdoc
            ledgerAccountId: ledgerAccount._id,
            ledgerAccountPublicId: ledgerAccount.ledgerAccountId,
            ownerId: ledgerAccount.ownerId,
            ownerType: ledgerAccount.ownerType,
            currency: ledgerAccount.currency,

            // Live state
            cachedBalance: liveCachedBalance,
            trueBalance: liveTrueBalance,
            drift: liveDrift,
            severity: liveSeverity,

            // From stored drift — fields correction methods don't use but IDriftRecord requires
            ownerPublicId: driftDoc.ownerPublicId,
            action: driftDoc.action,
            category: driftDoc.category,
            detectedAt: driftDoc.detectedAt,
            notes: driftDoc.notes,
          };

          switch (params.correctionMethod) {
            case "DIRECT_CACHE_SYNC":
              await this.applyDirectCacheCorrection(
                liveDriftRecord,
                adminPublicId,
                session,
              );
              break;

            case "LEDGER_ENTRY":
              compensatingEntryRef = await this.applyCompensatingEntry(
                liveDriftRecord,
                adminPublicId,
                context,
                session,
              );
              break;

            default:
              throw new BadRequestError("Correction method is required");
          }

          // ── 3. Post-correction sanity check ─────────────────────────────────
          // Recompute inside the same session — if ledger and cache still
          // disagree after the correction, abort rather than commit bad state.
          const postTrueBalance = await computeTrueBalance(
            ledgerAccount._id,
            session,
          );
          const { balance: postCachedBalance } = await getCachedBalance(
            ledgerAccount.ownerId,
            ledgerAccount.ownerType,
            ledgerAccount._id,
            session,
          );
          const { severity: postSeverity } = classifyDrift(
            postCachedBalance,
            postTrueBalance,
          );

          if (postSeverity !== DriftSeverity.IN_SYNC) {
            throw new BadRequestError(
              `Correction did not resolve drift — aborting. ` +
                `Post-correction state: cached=${postCachedBalance} ledger=${postTrueBalance}`,
            );
          }

          logger.info("Post-correction sanity check passed", {
            runId,
            ledgerAccountPublicId,
            postTrueBalance,
            postCachedBalance,
          });
        }
      }

      driftDoc.resolvedAt = new Date();
      driftDoc.resolvedBy = adminPublicId;
      driftDoc.resolutionType = resolutionType;
      driftDoc.resolutionNotes = selfHealed ? `[SELF_HEALED] ${notes}` : notes;
      driftDoc.correctionMethod = params.correctionMethod;
      driftDoc.compensatingEntryRef = compensatingEntryRef;

      await report.save({ session });

      if (resolutionType !== DriftResolutionType.ESCALATED) {
        const wallet = await Wallet.findOne({
          ledgerAccountId: ledgerAccount._id,
        }).session(session);

        if (wallet?.status === WalletStatus.RECONCILING) {
          await Wallet.updateOne(
            { _id: wallet._id, "freezeHistory.unfrozenAt": null },
            {
              $set: {
                status: WalletStatus.ACTIVE,
                freezeReason: null,
                freezeUntil: null,
                "freezeHistory.$.unfrozenAt": new Date(),
                "freezeHistory.$.unfrozenBy": adminPublicId,
                "freezeHistory.$.unfreezeReason": `DRIFT_RESOLVED:${resolutionType}`,
              },
            },
            { session },
          );
        }
      }

      await emitOutboxEvent(
        {
          topic: "reconciliation.events",
          eventId: generateEventId(),
          eventType: AuditAction.RECONCILIATION_DRIFT_RESOLVED,
          action: AuditAction.RECONCILIATION_DRIFT_RESOLVED,
          status: AuditStatus.PENDING,
          payload: {
            runId,
            ledgerAccountPublicId,
            resolutionType,
            notes: driftDoc.resolutionNotes,
            resolvedBy: adminPublicId,
            correctionMethod: params.correctionMethod,
            compensatingEntryRef,
            selfHealed,
            recordedDrift: driftDoc.drift,
            liveStateAtResolution: {
              liveCachedBalance,
              liveTrueBalance,
              liveDrift,
            },
          },
          aggregateType: "RECONCILIATION_RESOLUTION",
          aggregateId: runId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();
      committed = true;

      logger.info("Drift resolution committed", {
        runId,
        ledgerAccountPublicId,
        selfHealed,
      });

      return driftDoc;
    } catch (err) {
      if (!committed) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Write compensating ledger entry //Checked
  private async applyCompensatingEntry(
    drift: IDriftRecord,
    adminPublicId: string,
    context: IRequestContext,
    session: ClientSession,
  ): Promise<string> {
    try {
      /**
       * LEDGER_ENTRY semantic: admin has confirmed the CACHE is truth.
       * The ledger missed an entry. This method writes the missing entry
       * to bring the ledger into agreement with the cache.
       *
       * OVERSTATED  (cache > ledger): ledger missed a CREDIT → credit the
       *   drifted account, debit RECONCILIATION_ADJUSTMENTS as counterparty.
       *
       * UNDERSTATED (cache < ledger): ledger has a phantom entry → debit the
       *   drifted account, credit RECONCILIATION_ADJUSTMENTS as counterparty.
       *
       * ⚠️  If the ledger is trusted and the cache drifted, use
       *     DIRECT_CACHE_SYNC instead — this method is the wrong tool for that.
       */
      const compensatingRef = `RECON_CORRECTION_${generateEventId()}`;
      const correctionAmount = Math.abs(drift.drift);
      const isOverstated = drift.severity === DriftSeverity.OVERSTATED;

      const adjustmentLedger = await LedgerAccount.findOne({
        ownerType: LedgerOwnerType.SYSTEM,
        type: LedgerAccountType.RECONCILIATION_ADJUSTMENTS,
        currency: drift.currency,
      }).session(session);

      if (!adjustmentLedger) {
        throw new BadRequestError(
          "Reconciliation adjustments ledger not found",
        );
      }

      const builder = new TransactionBuilder("RECONCILIATION_CORRECTION");

      if (isOverstated) {
        // cache > ledger — ledger missed a CREDIT.
        // Credit the drifted account to bring ledger UP to cache.
        builder.addCredit({
          ledgerAccountId: drift.ledgerAccountId,
          amount: correctionAmount,
          currency: drift.currency,
          nature: LedgerEntryNature.CREDIT,
          transactionRef: compensatingRef,
          referenceId: compensatingRef,
          referenceType: LedgerEntryType.ADJUSTMENT,
        });

        builder.addDebit({
          ledgerAccountId: adjustmentLedger._id,
          amount: correctionAmount,
          currency: drift.currency,
          nature: LedgerEntryNature.DEBIT,
          transactionRef: compensatingRef,
          referenceId: compensatingRef,
          referenceType: LedgerEntryType.ADJUSTMENT,
        });
      } else {
        // cache < ledger — ledger has a phantom entry.
        // Debit the drifted account to bring ledger DOWN to cache.
        builder.addDebit({
          ledgerAccountId: drift.ledgerAccountId,
          amount: correctionAmount,
          currency: drift.currency,
          nature: LedgerEntryNature.DEBIT,
          transactionRef: compensatingRef,
          referenceId: compensatingRef,
          referenceType: LedgerEntryType.ADJUSTMENT,
        });

        builder.addCredit({
          ledgerAccountId: adjustmentLedger._id,
          amount: correctionAmount,
          currency: drift.currency,
          nature: LedgerEntryNature.CREDIT,
          transactionRef: compensatingRef,
          referenceId: compensatingRef,
          referenceType: LedgerEntryType.ADJUSTMENT,
        });
      }

      await builder.commit(session);

      // Post-correction sanity: recompute and stamp the cache.
      // Since LEDGER_ENTRY assumed cache was truth, this should be a no-op
      // on availableBalance — but it guarantees ledger and cache are in sync
      // regardless of any concurrent write.
      const trueBalance = await computeTrueBalance(
        drift.ledgerAccountId,
        session,
      );

      await updateCachedBalance(drift, trueBalance, session);

      logger.info("Compensating adjustment entry written", {
        compensatingRef,
        ledgerAccountId: drift.ledgerAccountId,
        drift: drift.drift,
        severity: drift.severity,
        correctionDirection: isOverstated ? "CREDITED_UP" : "DEBITED_DOWN",
        adminPublicId,
      });

      return compensatingRef;
    } catch (err) {
      throw err;
    }
  }

  // ─── Paystack settlement reconciliation
  public async reconcilePaystackSettlementsForDate(
    date: Date,
    context: IRequestContext,
  ) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const result = await reconcilePaystackSettlements(
      startOfDay,
      endOfDay,
      config.payment.paystack.secretKey as string,
    );

    logger.info("Paystack settlement reconciliation complete", {
      date: date.toISOString().split("T")[0],
      totalChecked: result.totalChecked,
      driftsFound: result.driftsFound,
    });

    if (result.driftsFound > 0) {
      await emitOutboxEvent({
        topic: "reconciliation.events",
        eventId: generateEventId(),
        eventType: AuditAction.RECONCILIATION_DRIFT_DETECTED,
        action: AuditAction.RECONCILIATION_DRIFT_DETECTED,
        status: AuditStatus.PENDING,
        payload: {
          type: "PAYMENT_SETTLEMENT",
          date: date.toISOString().split("T")[0],
          totalChecked: result.totalChecked,
          driftsFound: result.driftsFound,
          drifts: result.drifts,
        },
        aggregateType: "RECONCILIATION_SETTLEMENT",
        aggregateId: generateEventId(),
        version: 1,
        context,
      });
    }

    return result;
  }

  // ─── System balance invariant check //Checked
  public async checkSystemInvariant(context: IRequestContext) {
    const result = await checkSystemBalanceInvariant();

    if (!result.isBalanced) {
      await emitOutboxEvent({
        topic: "reconciliation.events",
        eventId: generateEventId(),
        eventType: AuditAction.RECONCILIATION_DRIFT_DETECTED,
        action: AuditAction.RECONCILIATION_DRIFT_DETECTED,
        status: AuditStatus.PENDING,
        payload: {
          type: "SYSTEM_INVARIANT_BREACH",
          totalWalletBalance: result.totalWalletBalance,
          totalLedgerNet: result.totalLedgerNet,
          invariantDrift: result.invariantDrift,
          severity: "CRITICAL",
        },
        aggregateType: "RECONCILIATION_INVARIANT",
        aggregateId: "SYSTEM",
        version: 1,
        context,
      });
    }

    return result;
  }

  private async applyDirectCacheCorrection(
    drift: IDriftRecord,
    adminPublicId: string,
    session: ClientSession,
  ): Promise<void> {
    const trueBalance = await computeTrueBalance(
      drift.ledgerAccountId,
      session,
    );

    await updateCachedBalance(drift, trueBalance, session);

    logger.info("Direct cache correction applied", {
      ledgerAccountId: drift.ledgerAccountId,
      trueBalance,
      adminPublicId,
    });
  }

  // Service
  public async getSummary() {
    const [
      lastReport,
      negativeBalanceCount,
      frozenWalletCount,
      failedReversalCount,
      openDriftCount,
    ] = await Promise.all([
      ReconciliationReport.findOne({ status: ReconciliationStatus.COMPLETED })
        .sort({ createdAt: -1 })
        .select(
          "runId status driftsFound accountsChecked finishedAt triggeredBy",
        )
        .lean(),
      Wallet.countDocuments({ availableBalance: { $lt: 0 } }),
      Wallet.countDocuments({ status: WalletStatus.FROZEN }),
      ReversalModel.countDocuments({ status: ReversalStatus.FAILED }),
      ReconciliationReport.countDocuments({
        status: ReconciliationStatus.COMPLETED,
        driftsFound: { $gt: 0 },
        "drifts.resolvedAt": { $exists: false },
      }),
    ]);

    return {
      lastRun: lastReport,
      negativeBalanceCount,
      frozenWalletCount,
      failedReversalCount,
      openDriftCount,
    };
  }
}
export default ReconciliationService;

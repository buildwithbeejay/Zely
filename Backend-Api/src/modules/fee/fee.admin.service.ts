import { FeeAccrual, FeeAccrualStatus } from "./fee.accrual.model";
import { FeeSweep, FeeSweepStatus } from "./fee.sweep.model";
import { NotFoundError } from "@/shared/errors/notFoundError";
import BadRequestError from "@/shared/errors/badRequest";
import { generateSweepId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { FeeConfig } from "@/modules/fee/fee.model";
import { clearFeeConfigCache } from "@/modules/fee/transfer.fee.engine";
import { Wallet } from "@/modules/wallet/wallet.model";
import { LedgerEntryNature } from "@/modules/ledger/ledger.entry.model";
import { IRequestContext } from "@/config/interfaces/request.interface";
import {
  LedgerAccount,
  LedgerOwnerType,
  LedgerAccountType,
} from "@/modules/ledger/ledger.account.model";
import TransactionBuilder from "@/modules/ledger/ledger.transaction.builder";
import mongoose from "mongoose";
import User from "@/modules/auth/authmodel";
import { recordAdminActivity } from "@/modules/admin/admin.activity.helper";
import { AdminActivityType } from "@/modules/admin/admin.activity.model";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { AuditAction, AuditStatus } from "@/modules/audit/audit.interface";

class FeeAdminService {
  private userModel = User;
  // ─── Stats
  public getStats = async (currency: string = "NGN") => {
    const [grossResult, unsweptResult, sweptResult, waivedResult] =
      await Promise.all([
        FeeAccrual.aggregate([
          { $match: { currency } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        FeeAccrual.aggregate([
          { $match: { currency, status: FeeAccrualStatus.ACCRUED } },
          {
            $group: {
              _id: null,
              total: { $sum: "$amount" },
              count: { $sum: 1 },
            },
          },
        ]),
        FeeAccrual.aggregate([
          { $match: { currency, status: FeeAccrualStatus.SWEPT } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        FeeAccrual.aggregate([
          { $match: { currency, status: FeeAccrualStatus.WAIVED } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
      ]);

    return {
      grossAccruals: {
        amount: grossResult[0]?.total ?? 0,
        count: grossResult[0]?.count ?? 0,
      },
      unswept: {
        amount: unsweptResult[0]?.total ?? 0,
        count: unsweptResult[0]?.count ?? 0,
      },
      sweptToTreasury: {
        amount: sweptResult[0]?.total ?? 0,
      },
      reversedAndWaived: {
        amount: waivedResult[0]?.total ?? 0,
      },
    };
  };

  // ─── List Accruals
  public listAccruals = async (query: {
    search?: string;
    status?: string;
    category?: string;
    page?: number | string;
    limit?: number | string;
  }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));

    const filter: Record<string, any> = {};
    if (
      query.status &&
      Object.values(FeeAccrualStatus).includes(query.status as any)
    ) {
      filter.status = query.status;
    }
    if (query.category) filter.category = query.category;

    if (query.search) {
      const escaped = query.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [
        { accrualId: rx },
        { transactionRef: rx },
        { feeTransactionRef: rx },
        { payerName: rx },
        { payerUserId: rx },
      ];
    }

    const [docs, total] = await Promise.all([
      FeeAccrual.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FeeAccrual.countDocuments(filter),
    ]);

    return {
      accruals: docs,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  };

  // ─── Waive Fee
  public waiveFee = async (
    accrualId: string,
    adminUserId: string,
    reason: string,
    adminEmail: string,
  ) => {
    const accrual = await FeeAccrual.findOne({ accrualId });
    if (!accrual) throw new NotFoundError("FEE_ACCRUAL_NOT_FOUND");

    if (accrual.status !== FeeAccrualStatus.ACCRUED) {
      throw new BadRequestError(
        `Cannot waive a fee with status: ${accrual.status}`,
      );
    }

    accrual.status = FeeAccrualStatus.WAIVED;
    accrual.waivedBy = adminUserId;
    accrual.waivedAt = new Date();
    accrual.waiverReason = reason;
    await accrual.save();

    await recordAdminActivity({
      adminUserId,
      adminEmail,
      type: AdminActivityType.FEE_WAIVED,
      description: `Waived ₦${accrual.amount} fee for transaction ${accrual.transactionRef}`,
      targetUserId: accrual.payerUserId,
      metadata: { accrualId, reason },
    });

    logger.info("Fee waived", { accrualId, adminUserId, reason });
    return accrual;
  };

  // ─── Sweep Accruals
  public sweepAccruals = async (
    adminUserId: string,
    currency: string = "NGN",
    adminEmail: string,
  ) => {
    const pending = await FeeAccrual.find({
      status: FeeAccrualStatus.ACCRUED,
      currency,
    }).lean();

    if (pending.length === 0) {
      throw new BadRequestError("NO_ACCRUALS_TO_SWEEP");
    }

    const totalAmount = pending.reduce((sum, a) => sum + a.amount, 0);
    const sweepId = generateSweepId();

    const sweep = await FeeSweep.create({
      sweepId,
      initiatedBy: adminUserId,
      totalAmount,
      currency,
      accrualCount: pending.length,
      status: FeeSweepStatus.PENDING,
    });

    try {
      await FeeAccrual.updateMany(
        { _id: { $in: pending.map((a) => a._id) } },
        {
          $set: {
            status: FeeAccrualStatus.SWEPT,
            sweepId: sweep._id,
          },
        },
      );

      sweep.status = FeeSweepStatus.COMPLETED;
      sweep.completedAt = new Date();
      await sweep.save();

      await recordAdminActivity({
        adminUserId,
        adminEmail,
        type: AdminActivityType.FEE_SWEPT,
        description: `Swept ${pending.length} fee accruals totalling ₦${totalAmount} to treasury`,
        metadata: { sweepId, accrualCount: pending.length, totalAmount },
      });

      logger.info("✅ Fee sweep completed", {
        sweepId,
        accrualCount: pending.length,
        totalAmount,
        currency,
      });

      return {
        sweepId,
        accrualCount: pending.length,
        totalAmount,
        currency,
      };
    } catch (err: any) {
      sweep.status = FeeSweepStatus.FAILED;
      await sweep.save();
      logger.error("❌ Fee sweep failed", { sweepId, error: err.message });
      throw err;
    }
  };

  // ─── List Sweep Runs
  public listSweeps = async (query: {
    page?: number | string;
    limit?: number | string;
  }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));

    const [docs, total] = await Promise.all([
      FeeSweep.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      FeeSweep.countDocuments(),
    ]);

    return { sweeps: docs, total, page, pages: Math.ceil(total / limit) };
  };

  // ─── Fee Schedules
  public listSchedules = async () => {
    const configs = await FeeConfig.find()
      .sort({ currency: 1, transferType: 1 })
      .lean();
    return { schedules: configs };
  };

  public updateSchedule = async (
    id: string,
    updates: { tiers?: any[]; isActive?: boolean },
    adminEmail: string,
    adminUserId: string,
  ) => {
    const config = await FeeConfig.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );
    if (!config) throw new NotFoundError("FEE_CONFIG_NOT_FOUND");

    await recordAdminActivity({
      adminUserId,
      adminEmail,
      type: AdminActivityType.FEE_SCHEDULE_UPDATED,
      description: `Updated fee schedule for ${config.transferType} (${config.currency})`,
      metadata: { id, updates },
    });

    // Invalidate cache so next transfer picks up new tiers
    clearFeeConfigCache();

    return config;
  };

  public waiveAndRefund = async (
    accrualId: string,
    adminUserId: string,
    reason: string,
    context: IRequestContext,
  ) => {
    const accrual = await FeeAccrual.findOne({ accrualId });
    if (!accrual) throw new NotFoundError("FEE_ACCRUAL_NOT_FOUND");

    if (accrual.status !== FeeAccrualStatus.ACCRUED) {
      throw new BadRequestError(
        `Cannot waive a fee with status: ${accrual.status}`,
      );
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Find user
      const user = await this.userModel
        .findOne({ userId: accrual.payerUserId })
        .select("_id userId")
        .session(session)
        .lean();

      if (!user) throw new NotFoundError("USER_NOT_FOUND");

      // 2. Find SYSTEM_REVENUE ledger account
      const revenueLedger = await LedgerAccount.findOne({
        ownerType: LedgerOwnerType.SYSTEM,
        type: LedgerAccountType.SYSTEM_REVENUE,
        currency: accrual.currency,
      }).session(session);

      if (!revenueLedger) throw new BadRequestError("REVENUE_LEDGER_NOT_FOUND");

      // 3. Find user MAIN_CHECKINGS ledger account
      const userLedger = await LedgerAccount.findOne({
        ownerId: user._id,
        ownerType: LedgerOwnerType.USER,
        currency: accrual.currency,
        type: LedgerAccountType.MAIN_CHECKINGS,
      }).session(session);

      if (!userLedger) throw new BadRequestError("USER_LEDGER_NOT_FOUND");

      // 4. Find revenue wallet
      const revenueWallet = await Wallet.findOne({
        userPublicId: "SYSTEM_USER",
        type: LedgerAccountType.SYSTEM_REVENUE,
        currency: accrual.currency,
      }).session(session);

      if (!revenueWallet) throw new BadRequestError("REVENUE_WALLET_NOT_FOUND");

      // 5. Check revenue wallet has enough
      if (revenueWallet.availableBalance < accrual.amount) {
        throw new BadRequestError("INSUFFICIENT_REVENUE_BALANCE_FOR_REFUND");
      }

      // 6. Find user wallet
      const userWallet = await Wallet.findOne({
        userPublicId: accrual.payerUserId,
        type: "MAIN_CHECKINGS",
        currency: accrual.currency,
      }).session(session);

      if (!userWallet) throw new BadRequestError("USER_WALLET_NOT_FOUND");

      // 7. Build reversal ledger entries
      const refundRef = `${accrual.feeTransactionRef}-WAIVER-REFUND`;

      const builder = new TransactionBuilder("REVERSAL");

      builder.addDebit({
        ledgerAccountId: revenueLedger._id,
        amount: accrual.amount,
        currency: accrual.currency,
        nature: LedgerEntryNature.DEBIT,
        transactionRef: refundRef,
        referenceId: accrual.accrualId,
        referenceType: "REVERSAL",
      });

      builder.addCredit({
        ledgerAccountId: userLedger._id,
        amount: accrual.amount,
        currency: accrual.currency,
        nature: LedgerEntryNature.CREDIT,
        transactionRef: refundRef,
        referenceId: accrual.accrualId,
        referenceType: "REVERSAL",
      });

      await builder.commit(session);

      // 8. Update wallet balances
      await Wallet.findOneAndUpdate(
        { _id: revenueWallet._id, version: revenueWallet.version },
        { $inc: { availableBalance: -accrual.amount, version: 1 } },
        { session, new: true },
      );

      await Wallet.findOneAndUpdate(
        { _id: userWallet._id, version: userWallet.version },
        { $inc: { availableBalance: accrual.amount, version: 1 } },
        { session, new: true },
      );

      // 9. Mark accrual as waived
      await FeeAccrual.findOneAndUpdate(
        { accrualId },
        {
          $set: {
            status: FeeAccrualStatus.WAIVED,
            waivedBy: adminUserId,
            waivedAt: new Date(),
            waiverReason: reason,
          },
        },
        { session },
      );

      // 10. Emit outbox event for projection
      const updatedUserWallet = await Wallet.findById(userWallet._id).session(
        session,
      );

      await emitOutboxEvent(
        {
          topic: "transfer.events",
          eventId: refundRef,
          eventType: AuditAction.TRANSACTION_COMPLETED,
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            transactionRef: refundRef,
            referenceId: accrual.accrualId,
            transferType: "FEE_REFUND",
            amount: accrual.amount,
            currency: accrual.currency,
            fee: 0,
            sender: {
              userId: "SYSTEM_USER",
              name: "Zely",
              email: "system@zely.app",
              accountType: "SYSTEM_REVENUE",
              accountNumber: "0000000000",
              walletId: revenueWallet.walletId,
              previousBalance: revenueWallet.availableBalance,
              currentBalance: revenueWallet.availableBalance - accrual.amount,
              version: revenueWallet.version,
            },
            receiver: {
              userId: accrual.payerUserId,
              name: accrual.payerName,
              email: "",
              accountType: "MAIN_CHECKINGS",
              accountNumber: "",
              walletId: userWallet.walletId,
              previousBalance: userWallet.availableBalance,
              currentBalance: updatedUserWallet?.availableBalance ?? 0,
              version: updatedUserWallet?.version ?? 0,
            },
          },
          aggregateType: "TRANSFER",
          aggregateId: refundRef,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      await recordAdminActivity({
        adminUserId,
        adminEmail: context.email ?? "",
        type: AdminActivityType.FEE_WAIVED_AND_REFUNDED,
        description: `Waived and refunded ₦${accrual.amount} fee to ${accrual.payerUserId} for transaction ${accrual.transactionRef}`,
        targetUserId: accrual.payerUserId,
        metadata: { accrualId, reason, refundRef },
      });

      logger.info("✅ Fee waived and refunded", {
        accrualId,
        amount: accrual.amount,
        payerUserId: accrual.payerUserId,
        adminUserId,
      });

      return {
        accrualId,
        refundRef,
        amount: accrual.amount,
        currency: accrual.currency,
        refundedTo: accrual.payerUserId,
      };
    } catch (err: any) {
      if (session.inTransaction()) await session.abortTransaction();
      logger.error("❌ Fee waiver refund failed", {
        accrualId,
        error: err.message,
      });
      throw err;
    } finally {
      session.endSession();
    }
  };
}

export default FeeAdminService;

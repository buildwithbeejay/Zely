import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import {
  extEnsureIdempotence,
  markCompleted,
} from "@/modules/helpers/ext.idempotence";
import {
  findVault,
  lockVaultToPreventConcurrency,
  mainWallet,
} from "@/modules/helpers/resolvers";
import {
  vaultCloseRequest,
  vaultWithrawalRequest,
} from "@/modules/transfer/transfer.interface";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import {
  generateAccrualId,
  generateEventId,
  generateVaultId,
} from "@/shared/utils/id.generator";
import mongoose, { Types } from "mongoose";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import User from "../auth/authmodel";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "../ledger/ledger.account.model";
import TransactionBuilder from "../ledger/ledger.transaction.builder";
import { Wallet } from "../wallet/wallet.model";
import vaultModel from "./vault.model";
import { logger } from "@/shared/utils/logger";
import {
  FeeAccrual,
  FeeAccrualStatus,
  FeeCategory,
} from "@/modules/fee/fee.accrual.model";

const DEFAULT_PENALTY_BASIS_POINTS = {
  FLEXIBLE: 0,
  LOCKED: 500, // 5%
  TARGET: 300, // 3%
};

class VaultService {
  // ─── Create vault ──────────────────────────────────────────────────────────
  public async createVault(params: {
    userId: string;
    title: string;
    vaultType: "FLEXIBLE" | "LOCKED" | "TARGET";
    targetAmountMinor?: number;
    lockedUntil?: Date;
    context: IRequestContext;
  }) {
    const {
      userId,
      title,
      vaultType,
      targetAmountMinor,
      lockedUntil,
      context,
    } = params;

    const vaultId = generateVaultId();
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ userId }).session(session);
      if (!user) throw new NotFoundError("User not found");

      // Check duplicate title
      const existing = await vaultModel
        .findOne({
          userId: user._id,
          title,
          status: "ACTIVE",
        })
        .session(session);

      if (existing) {
        throw new BadRequestError(
          "Active vault with this title already exists",
        );
      }

      const lockedUntilDate = lockedUntil ? new Date(lockedUntil) : undefined;

      if (lockedUntilDate && lockedUntilDate <= new Date()) {
        throw new BadRequestError("lockedUntil must be in the future");
      }

      // Resolve penalty rate
      const resolvedPenalty = DEFAULT_PENALTY_BASIS_POINTS[vaultType];

      // Build lock config based on type
      let lockConfig: any = { state: "UNLOCKED" };

      if (vaultType === "LOCKED" && lockedUntil) {
        lockConfig = {
          state: "LOCKED",
          lockedAt: new Date(),
          lockedUntil,
          penaltyBasisPoints: resolvedPenalty,
        };
      }

      if (vaultType === "TARGET") {
        lockConfig = {
          state: "LOCKED",
          lockedAt: new Date(),
          penaltyBasisPoints: resolvedPenalty,
        };
      }

      // Create ledger account for this vault
      const ledger = new LedgerAccount({
        ownerPublicId: vaultId,
        ownerId: new Types.ObjectId(),
        ownerType: LedgerOwnerType.VAULT,
        userPublicId: user.userId,
        userId: user._id,
        type: LedgerAccountType.VAULT,
        currency: "NGN",
      });

      await ledger.save({ session });

      // Create vault
      const vault = new vaultModel({
        userId: user._id,
        userPublicId: user.userId,
        vaultId,
        title,
        vaultType,
        currency: "NGN",
        targetAmountMinor: targetAmountMinor ?? 0,
        lockedUntil: vaultType === "LOCKED" ? lockedUntil : undefined,
        currentBalanceMinor: 0,
        lock: lockConfig,
        status: "ACTIVE",
        ledgerAccountId: ledger._id,
      });

      await vault.save({ session });

      await emitOutboxEvent(
        {
          topic: "vault.events",
          eventId: generateEventId(),
          eventType: AuditAction.VAULT_CREATED,
          action: AuditAction.VAULT_CREATED,
          status: AuditStatus.PENDING,
          payload: {
            vaultId: vault.vaultId,
            userId: user.userId,
            title: vault.title,
            vaultType,
            targetAmountMinor,
            ...(vaultType === "LOCKED" && lockedUntil ? { lockedUntil } : {}),
          },
          aggregateType: "VAULT",
          aggregateId: vault.vaultId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      return vault;
    } catch (err: any) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  public async withdrawFromVault(
    dto: vaultWithrawalRequest,
    context: IRequestContext,
  ) {
    const { userId, vaultId, amount, idempotencyKey, currency } = dto;

    // Idempotency check
    const { alreadyCompleted, response } =
      await extEnsureIdempotence(idempotencyKey);
    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // ─── Load user ───────────────────────────────────────────────────────
      const user = await User.findOne({ userId }).session(session);
      if (!user) throw new NotFoundError("User not found");

      // ─── Load vault ─────────────────────────────────────────────────────
      const vault = await findVault(vaultId, userId, currency, session);

      if (vault.status === "CANCELLED") {
        throw new BadRequestError("Cannot withdraw from a cancelled vault");
      }

      if (vault.currentBalanceMinor < amount) {
        throw new BadRequestError("Insufficient vault balance");
      }

      // ─── Lock vault for concurrency
      const vaultLocked = await lockVaultToPreventConcurrency(
        vault._id,
        session,
      );
      if (!vaultLocked) throw new BadRequestError("Vault is busy, try again");

      // ─── Load user main wallet
      const mainWlt = await mainWallet(
        user.userId,
        vault.currency,
        LedgerAccountType.MAIN_CHECKINGS,
        session,
      );

      if (!mainWlt) throw new NotFoundError("Main wallet not found");

      // ─── Load ledger accounts
      const vaultLedger = await LedgerAccount.findById(
        vault.ledgerAccountId,
      ).session(session);
      if (!vaultLedger) throw new NotFoundError("Vault ledger not found");

      const mainLedger = await LedgerAccount.findById(
        mainWlt.ledgerAccountId,
      ).session(session);
      if (!mainLedger) throw new NotFoundError("Main wallet ledger not found");

      // ─── Calculate penalty
      const penaltyInfo = this.calculatePenalty(vault, amount);
      const userReceives = amount - penaltyInfo.penaltyAmount;
      const revenueReceives = penaltyInfo.penaltyAmount;

      const transactionRef = `VAULT_WITHDRAW_${generateEventId()}`;

      const builder = new TransactionBuilder("VAULT_WITHDRAWAL");

      // Always debit vault
      builder.addDebit({
        transactionRef,
        ledgerAccountId: vaultLedger._id,
        amount,
        currency: vault.currency,
        referenceId: vaultId,
        referenceType: "VAULT_WITHDRAWAL",
        nature: "DEBIT",
      });

      if (revenueReceives > 0) {
        // ─── With penalty — three legs ──────────────────────────────────────
        const revenueWallet = await Wallet.findOne({
          type: LedgerAccountType.SYSTEM_REVENUE,
          currency: vault.currency,
        }).session(session);

        if (!revenueWallet) throw new NotFoundError("Revenue wallet not found");

        const revenueLedger = await LedgerAccount.findById(
          revenueWallet.ledgerAccountId,
        ).session(session);

        if (!revenueLedger) throw new NotFoundError("Revenue ledger not found");

        // Credit user
        builder.addCredit({
          transactionRef,
          ledgerAccountId: mainLedger._id,
          amount: userReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_WITHDRAWAL",
          nature: "CREDIT",
        });

        // Credit treasury (penalty)
        builder.addCredit({
          transactionRef,
          ledgerAccountId: revenueLedger._id,
          amount: revenueReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_PENALTY",
          nature: "CREDIT",
        });

        await builder.commit(session);

        // Update revenue wallet balance
        await Wallet.findOneAndUpdate(
          { _id: revenueWallet._id },
          { $inc: { availableBalance: revenueReceives }, version: 1 },
          { session },
        );
      } else {
        // ─── No penalty — two legs ──────────────────────────────────────────
        builder.addCredit({
          transactionRef,
          ledgerAccountId: mainLedger._id,
          amount: userReceives,
          currency: vault.currency,
          referenceId: vaultId,
          referenceType: "VAULT_WITHDRAWAL",
          nature: "CREDIT",
        });

        await builder.commit(session);
      }

      // ─── Update wallet balance ────────────────────────────────────────────
      await Wallet.findOneAndUpdate(
        { _id: mainWlt._id },
        { $inc: { availableBalance: userReceives, version: 1 } },
        { session },
      );

      // ─── Update vault balance ─────────────────────────────────────────────
      await vaultModel.updateOne(
        { _id: vault._id },
        { $inc: { currentBalanceMinor: -amount }, version: 1 },
        { session },
      );

      // ─── Emit outbox event ────────────────────────────────────────────────
      await emitOutboxEvent(
        {
          topic: "vault.events",
          eventId: generateEventId(),
          eventType: AuditAction.VAULT_WITHDRAWAL,
          action: AuditAction.VAULT_WITHDRAWAL,
          status: AuditStatus.PENDING,
          payload: {
            transactionRef,
            userId: user.userId,
            amount,
            userReceives,
            penaltyAmount: revenueReceives,
            penaltyApplied: penaltyInfo.penaltyApplied,
            penaltyReason: penaltyInfo.reason,
            newBalance: vault.currentBalanceMinor - amount,
            previousBalance: vault.currentBalanceMinor,
            currency: vault.currency,
            type: vault.vaultType,
          },
          aggregateType: "VAULT",
          aggregateId: vaultId,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();

      if (revenueReceives > 0) {
        try {
          await FeeAccrual.create({
            accrualId: generateAccrualId(),
            transactionRef,
            feeTransactionRef: `${transactionRef}-PENALTY`,
            payerUserId: user.userId,
            payerName: user.name,
            category: FeeCategory.VAULT_TRANSFER,
            amount: revenueReceives,
            currency: vault.currency,
            transitAccount: "sys_fees_pool",
            status: FeeAccrualStatus.ACCRUED,
          });
        } catch (err: any) {
          if (err.code !== 11000) {
            logger.warn(
              "FeeAccrual creation failed after vault penalty withdrawal",
              {
                transactionRef,
                error: err.message,
              },
            );
          }
        }
      }

      // 6. Mark idempotency completed — AFTER commit
      await markCompleted(dto.idempotencyKey, transactionRef, {
        transactionId: transactionRef,
        vaultId: dto.vaultId,
        amountWithdrawn: amount,
        amountReceived: userReceives,
        penaltyApplied: penaltyInfo.penaltyApplied,
      });

      return {
        vaultId,
        amountWithdrawn: amount,
        penaltyApplied: penaltyInfo.penaltyApplied,
        penaltyAmount: revenueReceives,
        penaltyReason: penaltyInfo.reason,
        amountReceived: userReceives,
        newVaultBalance: vault.currentBalanceMinor - amount,
      };
    } catch (err) {
      if (session.inTransaction()) await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  // // ─── Penalty calculator

  private calculatePenalty(
    vault: any,
    amount: number,
  ): {
    penaltyApplied: boolean;
    penaltyAmount: number;
    reason: string;
  } {
    const now = new Date();

    // FLEXIBLE — never any penalty
    if (vault.vaultType === "FLEXIBLE") {
      return {
        penaltyApplied: false,
        penaltyAmount: 0,
        reason: "FLEXIBLE_VAULT",
      };
    }

    // LOCKED — check maturity date
    if (vault.vaultType === "LOCKED") {
      const matured = vault.lock?.lockedUntil && vault.lock.lockedUntil <= now;

      if (matured || vault.lock?.state === "MATURED") {
        return {
          penaltyApplied: false,
          penaltyAmount: 0,
          reason: "VAULT_MATURED",
        };
      }

      const basisPoints =
        vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.LOCKED;
      const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

      return {
        penaltyApplied: true,
        penaltyAmount,
        reason: "EARLY_WITHDRAWAL_BEFORE_MATURITY",
      };
    }

    // TARGET — check if target reached
    if (vault.vaultType === "TARGET") {
      const targetReached =
        vault.lock?.state === "MATURED" ||
        vault.status === "COMPLETED" ||
        (vault.targetAmountMinor > 0 &&
          vault.currentBalanceMinor >= vault.targetAmountMinor);

      if (targetReached) {
        return {
          penaltyApplied: false,
          penaltyAmount: 0,
          reason: "TARGET_REACHED",
        };
      }

      const basisPoints =
        vault.lock?.penaltyBasisPoints ?? DEFAULT_PENALTY_BASIS_POINTS.TARGET;
      const penaltyAmount = Math.floor((amount * basisPoints) / 10000);

      return {
        penaltyApplied: true,
        penaltyAmount,
        reason: "EARLY_WITHDRAWAL_BEFORE_TARGET",
      };
    }

    return { penaltyApplied: false, penaltyAmount: 0, reason: "UNKNOWN" };
  }

  // // ─── Get vault
  public async getVault(userId: string, vaultId: string) {
    const user = await User.findOne({ userId });
    if (!user) throw new NotFoundError("User not found");

    const vault = await vaultModel
      .findOne({
        vaultId,
        userId: user._id,
      })
      .lean();

    if (!vault) throw new NotFoundError("Vault not found");

    return vault;
  }

  // // ─── List user vaults
  public async getUserVaults(userId: string) {
    const user = await User.findOne({ userId });
    if (!user) throw new NotFoundError("User not found");

    return vaultModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
  }

  // // ─── Close vault
  public async closeVault(params: {
    userId: string;
    vaultId: string;
    idempotencyKey: string;
    context: IRequestContext;
  }) {
    const { userId, vaultId, context, idempotencyKey } = params;

    // Withdraw everything (penalty applies if locked)
    const vault = await vaultModel.findOne({ vaultId });
    if (!vault) throw new NotFoundError("Vault not found");

    if (vault.status === "CANCELLED")
      throw new BadRequestError("Vault already closed");

    const dto: vaultCloseRequest = {
      userId,
      vaultId,
      amount: vault.currentBalanceMinor,
      currency: vault.currency,
      idempotencyKey: idempotencyKey,
    };

    let withdrawalResult = null;

    if (vault.currentBalanceMinor > 0) {
      withdrawalResult = await this.withdrawFromVault(dto, context);
    }

    await vaultModel.updateOne({ vaultId }, { $set: { status: "CANCELLED" } });

    await emitOutboxEvent({
      topic: "vault.events",
      eventId: generateEventId(),
      eventType: AuditAction.VAULT_CLOSED,
      action: AuditAction.VAULT_CLOSED,
      status: AuditStatus.PENDING,
      payload: {
        vaultId,
        userId,
        title: vault.title,
        vaultType: vault.vaultType,
        finalBalanceWithdrawn: vault.currentBalanceMinor,
        penaltyApplied: withdrawalResult?.penaltyApplied ?? false,
        penaltyAmount: withdrawalResult?.penaltyAmount ?? 0,
        closedAt: new Date(),
      },
      aggregateType: "VAULT",
      aggregateId: vaultId,
      version: 1,
      context,
    });

    return { vaultId, closed: true };
  }

  public async getWithdrawalPreview(
    userId: string,
    vaultId: string,
    amount: number,
  ) {
    const user = await User.findOne({ userId }).lean();

    if (!user) throw new NotFoundError("User not found");

    const vault = await vaultModel
      .findOne({
        vaultId,
        userId: user._id,
      })
      .lean();

    if (!vault) throw new NotFoundError("Vault not found");

    const penaltyInfo = this.calculatePenalty(vault, amount);

    return {
      amount,
      penalty: penaltyInfo.penaltyAmount,
      penaltyApplied: penaltyInfo.penaltyApplied,
      penaltyReason: penaltyInfo.reason,
      penaltyRate: vault.lock?.penaltyBasisPoints
        ? `${vault.lock.penaltyBasisPoints / 100}%`
        : "0%",
      netAmount: amount - penaltyInfo.penaltyAmount,
      vaultId,
    };
  }

  public async editVault(params: {
    userId: string;
    vaultId: string;
    title?: string;
    targetAmountMinor?: number;
    context: IRequestContext;
  }) {
    const { userId, vaultId, title, targetAmountMinor, context } = params;

    const vault = await vaultModel.findOne({
      vaultId: vaultId,
      userPublicId: userId,
    });

    if (!vault) {
      throw new NotFoundError("Vault not found");
    }

    // targetAmount is only valid for TARGET vaults
    if (targetAmountMinor !== undefined && vault.vaultType !== "TARGET") {
      throw new BadRequestError(
        `targetAmount can only be set for TARGET vaults`,
      );
    }

    // New target amount cannot be less than already-contributed balance
    if (
      targetAmountMinor !== undefined &&
      Number(targetAmountMinor) < vault.currentBalanceMinor
    ) {
      throw new BadRequestError(
        `targetAmount cannot be lower than current vault balance of ${vault.currentBalanceMinor}`,
      );
    }

    const updates: Record<string, unknown> = {};
    if (title) updates.title = title;

    if (targetAmountMinor !== undefined)
      updates.targetAmountMinor = Number(targetAmountMinor);

    const updatedVault = await vaultModel.findOneAndUpdate(
      { vaultId: vaultId },
      { $set: { ...updates, updatedAt: new Date() } },
      { new: true },
    );

    await emitOutboxEvent({
      topic: "vault.events",
      eventId: generateEventId(),
      eventType: AuditAction.EDIT_VAULT,
      action: AuditAction.EDIT_VAULT,
      status: AuditStatus.PENDING,
      payload: {
        vaultId,
      },
      aggregateType: "VAULT",
      aggregateId: vaultId,
      version: 1,
      context,
    });

    return {
      ok: true,
      data: updatedVault,
    };
  }
}

export default new VaultService();

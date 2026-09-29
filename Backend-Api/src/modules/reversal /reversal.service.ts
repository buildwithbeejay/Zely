import mongoose from "mongoose";
import {
  LedgerAccount,
  LedgerAccountType,
  LedgerOwnerType,
} from "../ledger/ledger.account.model";
import {
  LedgerEntry,
  LedgerEntryNature,
  LedgerEntryType,
} from "../ledger/ledger.entry.model";
import TransactionBuilder from "../ledger/ledger.transaction.builder";
import { PaymentInitialization } from "../payments/payment.initialization.model";
import { Wallet } from "../wallet/wallet.model";
import {
  ReversalModel,
  ReversalReason,
  ReversalStatus,
  ReversalType,
} from "./reversal.model";

import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import FundingService from "@/modules/fee/funding/funding.service";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { generateEventId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import { AuditAction, AuditStatus } from "../audit/audit.interface";

class ReversalService {
  // ─── Scenario 1: Admin reversal of completed transfer ──────────────────────
  public async initiateReversal(params: {
    originalTransactionRef: string;
    reason: ReversalReason;
    notes: string;
    reverseFee: boolean;
    adminPublicId: string;
    context: IRequestContext;
  }) {
    const {
      originalTransactionRef,
      reason,
      notes,
      reverseFee,
      adminPublicId,
      context,
    } = params;

    // ─── Guard: already reversed ──────────────────────────────────────────
    const existingReversal = await ReversalModel.findOne({
      originalTransactionRef,
      type: ReversalType.TRANSFER_REVERSAL,
      status: { $in: [ReversalStatus.PENDING, ReversalStatus.COMPLETED] },
    }).lean();

    if (existingReversal) {
      throw new BadRequestError(
        `Transfer already reversed — reversalId: ${existingReversal.reversalId}`,
      );
    }

    // ─── Guard: not a reversal reversing a reversal ───────────────────────
    const isAlreadyAReversal = await LedgerEntry.exists({
      transactionRef: originalTransactionRef,
      referenceType: LedgerEntryType.REVERSAL,
    });

    if (isAlreadyAReversal) {
      throw new BadRequestError(
        "Cannot reverse a transaction that is itself a reversal",
      );
    }

    // ─── Load original ledger entries ─────────────────────────────────────
    const originalEntries = await LedgerEntry.find({
      transactionRef: originalTransactionRef,
    }).lean();

    if (!originalEntries.length) {
      throw new NotFoundError(
        `No ledger entries found for transactionRef: ${originalTransactionRef}`,
      );
    }

    // Separate main transfer entries from fee entries
    const mainEntries = originalEntries.filter(
      (e) => e.referenceType !== LedgerEntryType.FEE,
    );
    const feeEntries = originalEntries.filter(
      (e) => e.referenceType === LedgerEntryType.FEE,
    );

    // ─── Find the sender (DEBIT entry) and receiver (CREDIT entry) ───────
    const senderEntry = mainEntries.find(
      (e) => e.type === LedgerEntryType.DEBIT,
    );
    const receiverEntry = mainEntries.find(
      (e) => e.type === LedgerEntryType.CREDIT,
    );

    if (!senderEntry || !receiverEntry) {
      throw new BadRequestError(
        "Could not identify sender and receiver from original ledger entries",
      );
    }

    // ─── Load wallets ─────────────────────────────────────────────────────
    const [senderWallet, receiverWallet] = await Promise.all([
      Wallet.findOne({ ledgerAccountId: senderEntry.ledgerAccountId }),
      Wallet.findOne({ ledgerAccountId: receiverEntry.ledgerAccountId }),
    ]);

    if (!senderWallet || !receiverWallet) {
      throw new NotFoundError("Could not load sender or receiver wallet");
    }

    const originalAmount = receiverEntry.amount;
    const originalFee = feeEntries.reduce((sum, e) => sum + e.amount, 0);
    const reversalAmount = reverseFee
      ? originalAmount + originalFee
      : originalAmount;

    // ─── Check receiver balance — will they go negative? ──────────────────
    const receiverWillGoNegative =
      receiverWallet.availableBalance - originalAmount < 0;

    if (receiverWillGoNegative) {
      logger.warn("Reversal will result in negative balance for receiver", {
        receiverPublicId: receiverWallet.userPublicId,
        currentBalance: receiverWallet.availableBalance,
        reversalAmount: originalAmount,
        deficit: originalAmount - receiverWallet.availableBalance,
      });
    }

    // ─── Create reversal record first (idempotency anchor) ────────────────
    const reversal = await ReversalModel.create({
      type: ReversalType.TRANSFER_REVERSAL,
      status: ReversalStatus.PENDING,
      originalTransactionRef,
      originalAmount,
      originalCurrency: senderEntry.currency,
      originalFee,
      reverseFee,
      senderPublicId: senderWallet.userPublicId,
      receiverPublicId: receiverWallet.userPublicId,
      initiatedBy: adminPublicId,
      reason,
      notes,
      receiverWentNegative: receiverWillGoNegative,
      receiverFrozen: false,
    });

    // ─── Execute inside a MongoDB transaction ──────────────────────────────
    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    try {
      const reversalTransactionRef = `REVERSAL_${originalTransactionRef}_${generateEventId()}`;

      // Load ledger accounts
      const senderLedger = await LedgerAccount.findById(
        senderEntry.ledgerAccountId,
      ).session(session);
      const receiverLedger = await LedgerAccount.findById(
        receiverEntry.ledgerAccountId,
      ).session(session);

      if (!senderLedger || !receiverLedger) {
        throw new NotFoundError("Could not load ledger accounts for reversal");
      }

      const builder = new TransactionBuilder("REVERSAL");

      // Reversal is the mirror of the original:
      // Original: DEBIT sender, CREDIT receiver
      // Reversal: DEBIT receiver, CREDIT sender
      builder.addDebit({
        ledgerAccountId: receiverLedger._id,
        amount: originalAmount,
        currency: senderEntry.currency,
        nature: LedgerEntryNature.DEBIT,
        transactionRef: reversalTransactionRef,
        referenceId: reversal.reversalId,
        referenceType: LedgerEntryType.REVERSAL,
      });

      builder.addCredit({
        ledgerAccountId: senderLedger._id,
        amount: originalAmount,
        currency: senderEntry.currency,
        nature: LedgerEntryNature.CREDIT,
        transactionRef: reversalTransactionRef,
        referenceId: reversal.reversalId,
        referenceType: LedgerEntryType.REVERSAL,
      });

      // Reverse the fee too if requested
      if (reverseFee && feeEntries.length > 0) {
        const treasuryLedger = await LedgerAccount.findOne({
          ownerType: LedgerOwnerType.SYSTEM,
          type: LedgerAccountType.SYSTEM_TREASURY,
          currency: senderEntry.currency,
        }).session(session);

        if (treasuryLedger) {
          // Debit treasury (reverse the fee it received)
          builder.addDebit({
            ledgerAccountId: treasuryLedger._id,
            amount: originalFee,
            currency: senderEntry.currency,
            nature: LedgerEntryNature.DEBIT,
            transactionRef: `${reversalTransactionRef}_FEE`,
            referenceId: reversal.reversalId,
            referenceType: LedgerEntryType.REVERSAL,
          });

          // Credit sender (return the fee they paid)
          builder.addCredit({
            ledgerAccountId: senderLedger._id,
            amount: originalFee,
            currency: senderEntry.currency,
            nature: LedgerEntryNature.CREDIT,
            transactionRef: `${reversalTransactionRef}_FEE`,
            referenceId: reversal.reversalId,
            referenceType: LedgerEntryType.REVERSAL,
          });
        }
      }

      await builder.commit(session);

      // ─── Update wallet balances ─────────────────────────────────────────
      const newReceiverBalance =
        receiverWallet.availableBalance - originalAmount;
      const newSenderBalance = senderWallet.availableBalance + reversalAmount;

      const updatedReceiver = await Wallet.findOneAndUpdate(
        { _id: receiverWallet._id, version: receiverWallet.version },
        { $inc: { availableBalance: -originalAmount, version: 1 } },
        { session, new: true },
      );

      if (!updatedReceiver) {
        throw new BadRequestError(
          "Wallet was modified by another operation — please retry the reversal",
        );
      }

      await Wallet.findOneAndUpdate(
        { _id: senderWallet._id, version: senderWallet.version },
        { $inc: { availableBalance: reversalAmount } },
        { session },
      );

      // ─── Update reversal record ─────────────────────────────────────────
      await ReversalModel.updateOne(
        { _id: reversal._id },
        {
          $set: {
            status: ReversalStatus.COMPLETED,
            reversalTransactionRef,
            receiverFrozen: newReceiverBalance < 0,
            completedAt: new Date(),
          },
        },
        { session },
      );

      // ─── Emit outbox events ─────────────────────────────────────────────
      await emitOutboxEvent(
        {
          topic: "reversal.events",
          eventId: generateEventId(),
          eventType: AuditAction.TRANSFER_REVERSED,
          action: AuditAction.TRANSFER_REVERSED,
          status: AuditStatus.PENDING,
          payload: {
            reversalId: reversal.reversalId,
            originalTransactionRef,
            reversalTransactionRef,
            senderPublicId: senderWallet.userPublicId,
            receiverPublicId: receiverWallet.userPublicId,
            originalAmount,
            originalFee,
            reverseFee,
            reversalAmount,
            reason,
            notes,
            receiverWentNegative: newReceiverBalance < 0,
            receiverFrozen: newReceiverBalance < 0,
            adminPublicId,
          },
          aggregateType: "REVERSAL",
          aggregateId: reversal.reversalId,
          version: 1,
          context,
        },
        { session },
      );

      // Emit negative balance alert if applicable
      if (newReceiverBalance < 0) {
        await emitOutboxEvent(
          {
            topic: "reconciliation.events",
            eventId: generateEventId(),
            eventType: AuditAction.WALLET_NEGATIVE_BALANCE,
            action: AuditAction.WALLET_NEGATIVE_BALANCE,
            status: AuditStatus.PENDING,
            payload: {
              walletId: receiverWallet.walletId,
              userPublicId: receiverWallet.userPublicId,
              balance: newReceiverBalance,
              reversalId: reversal.reversalId,
              requiresCollectionAction: true,
            },
            aggregateType: "WALLET",
            aggregateId: receiverWallet.walletId,
            version: 1,
            context,
          },
          { session },
        );
      }

      await session.commitTransaction();
      committed = true;

      logger.info("✅ Transfer reversal completed", {
        reversalId: reversal.reversalId,
        originalTransactionRef,
        reversalTransactionRef,
        receiverWentNegative: newReceiverBalance < 0,
      });

      return reversal;
    } catch (err: any) {
      if (!committed) await session.abortTransaction();

      // Mark reversal as failed
      await ReversalModel.updateOne(
        { _id: reversal._id },
        {
          $set: {
            status: ReversalStatus.FAILED,
            failureReason: err.message,
          },
        },
      );

      throw err;
    } finally {
      session.endSession();
    }
  }

  // ─── Scenario 2: Manual credit for missed Paystack webhook ─────────────────
  public async initiateManualCredit(params: {
    paymentRef: string;
    notes: string;
    adminPublicId: string;
    context: IRequestContext;
  }) {
    const { paymentRef, notes, adminPublicId, context } = params;

    // ─── Find the PaymentInitialization ──────────────────────────────────
    const payment = await PaymentInitialization.findOne({
      reference: paymentRef,
    }).lean();

    if (!payment) {
      throw new NotFoundError(`No payment found with reference: ${paymentRef}`);
    }

    if (payment.status !== "SUCCESS") {
      throw new BadRequestError(
        `Payment status is ${payment.status} — can only manually credit SUCCESS payments`,
      );
    }

    // ─── Guard: wallet already credited ──────────────────────────────────
    const alreadyCredited = await LedgerEntry.exists({
      referenceId: paymentRef,
      referenceType: LedgerEntryType.EXTERNAL_DEPOSIT,
    });

    if (alreadyCredited) {
      throw new BadRequestError(
        `Wallet already credited for payment: ${paymentRef}`,
      );
    }

    // ─── Guard: manual credit already attempted ───────────────────────────
    const existingManualCredit = await ReversalModel.findOne({
      originalTransactionRef: paymentRef,
      type: ReversalType.MANUAL_CREDIT,
      status: { $in: [ReversalStatus.PENDING, ReversalStatus.COMPLETED] },
    }).lean();

    if (existingManualCredit) {
      throw new BadRequestError(
        `Manual credit already exists for this payment — reversalId: ${existingManualCredit.reversalId}`,
      );
    }

    // ─── Create reversal record ───────────────────────────────────────────
    const reversal = await ReversalModel.create({
      type: ReversalType.MANUAL_CREDIT,
      status: ReversalStatus.PENDING,
      originalTransactionRef: paymentRef,
      originalAmount: payment.amount,
      originalCurrency: payment.currency,
      originalFee: 0,
      reverseFee: false,
      senderPublicId: "PAYSTACK",
      receiverPublicId: payment.initiatedByUserPublicId,
      initiatedBy: adminPublicId,
      reason: ReversalReason.MANUAL_CREDIT_WEBHOOK_FAILURE,
      notes,
      receiverWentNegative: false,
      receiverFrozen: false,
    });

    try {
      // ─── Reuse FundingService — same flow as a real webhook credit ──────
      const fundingResult = await (
        FundingService as typeof FundingService & {
          creditFromExternalSource: (params: {
            providerReference: string;
            source: string;
            amount: number;
            currency: string;
            targetWalletId: string;
            initiatedByUserId: string;
            context: IRequestContext;
            metadata: Record<string, string>;
          }) => Promise<{ transactionRef: string }>;
        }
      ).creditFromExternalSource({
        providerReference: paymentRef,
        source: "ADMIN_MANUAL_CREDIT",
        amount: payment.amount,
        currency: payment.currency,
        targetWalletId: payment.targetWalletId,
        initiatedByUserId: payment.initiatedByUserPublicId,
        context: {
          ...context,
          userId: adminPublicId,
        },
        metadata: {
          adminPublicId,
          originalPaymentRef: paymentRef,
          manualCreditReason: notes,
          reversalId: reversal.reversalId,
        },
      });

      // ─── Update reversal record ─────────────────────────────────────────
      await ReversalModel.updateOne(
        { _id: reversal._id },
        {
          $set: {
            status: ReversalStatus.COMPLETED,
            reversalTransactionRef: fundingResult.transactionRef,
            completedAt: new Date(),
          },
        },
      );

      logger.info("✅ Manual credit completed", {
        reversalId: reversal.reversalId,
        paymentRef,
        amount: payment.amount,
        transactionRef: fundingResult.transactionRef,
      });

      return reversal;
    } catch (err: any) {
      await ReversalModel.updateOne(
        { _id: reversal._id },
        {
          $set: {
            status: ReversalStatus.FAILED,
            failureReason: err.message,
          },
        },
      );

      throw err;
    }
  }

  // ─── Get a single reversal ──────────────────────────────────────────────────
  public async getReversal(reversalId: string) {
    const reversal = await ReversalModel.findOne({ reversalId }).lean();
    if (!reversal) throw new NotFoundError(`Reversal not found: ${reversalId}`);
    return reversal;
  }

  // ─── List reversals with filters ───────────────────────────────────────────
  public async listReversals(params: {
    type?: ReversalType;
    status?: ReversalStatus;
    reason?: ReversalReason;
    senderPublicId?: string;
    receiverPublicId?: string;
    limit?: number;
    page?: number;
  }) {
    const {
      type,
      status,
      reason,
      senderPublicId,
      receiverPublicId,
      limit = 20,
      page = 1,
    } = params;

    const filter: Record<string, any> = {};
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (reason) filter.reason = reason;
    if (senderPublicId) filter.senderPublicId = senderPublicId;
    if (receiverPublicId) filter.receiverPublicId = receiverPublicId;

    const skip = (page - 1) * limit;

    const [reversals, total] = await Promise.all([
      ReversalModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ReversalModel.countDocuments(filter),
    ]);

    return {
      reversals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new ReversalService();

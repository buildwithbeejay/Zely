import { IRequestContext } from "@/config/interfaces/request.interface";
import { emitOutboxEvent } from "@/infrastructure/helpers/emit.audit.helper";
import { Account } from "@/modules/account/account.model";
import {
  FeeAccrual,
  FeeAccrualStatus,
  FeeCategory,
} from "@/modules/fee/fee.accrual.model";
import {
  commitTransactionLimits,
  enforceReceiverBalanceCap,
  enforceTransactionLimits,
  Reservation,
  rollbackTransactionLimits,
} from "@/modules/transactionLimit/transactionLimit.service";
import { checkAndAutoRecoverWallet } from "@/modules/wallet/wallet.recovery";
import BadRequestError from "@/shared/errors/badRequest";
import { NotFoundError } from "@/shared/errors/notFoundError";
import { generateAccrualId } from "@/shared/utils/id.generator";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";
import { AuditAction, AuditStatus } from "../audit/audit.interface";
import UserModel from "../auth/authmodel";
import { calculateFeeBreakdown } from "../fee/transfer.fee.engine";
import { extEnsureIdempotence } from "../helpers/ext.idempotence";
import {
  deductWalletFunds,
  ensureWalletsAreActive,
  findVault,
  findWalletByType,
  lockVaultToPreventConcurrency,
  lockWalletFunds,
  lookUpAccounts,
  lookUpLedgerAccountForInternalTrx,
  lookUpLedgerAccountforP2P,
  lookUpPrimaryWallets,
  LookUpVaultLedger,
  resolveAccountByUserId,
  unlockVault,
} from "../helpers/resolvers";
import { LedgerOwnerType } from "../ledger/ledger.account.model";
import {
  KycTier,
  TransactionLimitConfig,
} from "../transactionLimit/transaction.limit.model";
import vaultModel, { VaultDocument } from "../vault/vault.model";
import { Wallet, WalletDocument, WalletType } from "../wallet/wallet.model";
import TransferEngine from "./transfer.engine";
import {
  internalTransferRequest,
  TransferRequestInput,
  vaultTransferRequest,
} from "./transfer.interface";

class TransferService {
  public async p2pTransfer(
    dto: TransferRequestInput,
    context: IRequestContext,
  ) {
    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(
      dto.idempotencyKey,
    );

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWallet: WalletDocument | null = null;
    let receiverWallet: WalletDocument | null = null;
    let reservation: Reservation | null = null;

    try {
      /** -------------------------
       * RESOLVE ACCOUNTS
       * ------------------------- */
      const { senderAccount, receiverAccount } = await lookUpAccounts(
        { senderId: dto.senderId, toAccountNumber: dto.toAccountNumber },
        session,
      );

      if (!senderAccount || !receiverAccount) {
        throw new NotFoundError("Account not found");
      }

      if (senderAccount.userId.equals(receiverAccount.userId)) {
        throw new BadRequestError("Use internal transfer");
      }

      if (
        !dto.toAccountNumber ||
        typeof dto.amount !== "number" ||
        dto.amount <= 0
      ) {
        throw new BadRequestError("Invalid transfer request");
      }

      /** -------------------------
       * LOAD WALLETS
       * ------------------------- */
      senderWallet = await lookUpPrimaryWallets(
        senderAccount.walletId,
        dto.currency,
        session,
      );
      receiverWallet = await lookUpPrimaryWallets(
        receiverAccount.walletId,
        dto.currency,
        session,
      );

      if (!senderWallet || !receiverWallet) {
        throw new NotFoundError("Wallets not found");
      }

      /** -------------------------
       * ENSURE ACTIVE WALLETS
       * ------------------------- */
      await ensureWalletsAreActive(
        senderWallet._id,
        receiverWallet._id,
        session,
      );

      /** -------------------------
       * TRANSACTION LIMITS
       * ------------------------- */
      const senderUser = await UserModel.findOne(
        { userId: dto.senderId },
        { kycTier: 1 },
      )
        .session(session)
        .lean();

      const receiverUser = await UserModel.findOne(
        { _id: receiverAccount.userId },
        { kycTier: 1 },
      )
        .session(session)
        .lean();

      const senderTier = senderUser?.kycTier ?? KycTier.TIER_1;
      const receiverTier = receiverUser?.kycTier ?? KycTier.TIER_1;

      const limitResult = await enforceTransactionLimits({
        userId: senderAccount.userId.toString(),
        userPublicId: dto.senderId,
        kycTier: senderTier,
        amount: dto.amount,
        currency: dto.currency,
        senderWallet,
        session,
      });
      reservation = limitResult.reservation;
      const tier = limitResult.kycTier;

      const config = await TransactionLimitConfig.findOne({ tier: tier });

      if (!config) {
        throw new NotFoundError(
          `Transaction limit config not found for tier: ${tier}`,
        );
      }

      await enforceReceiverBalanceCap({
        receiverWallet,
        receiverKycTier: receiverTier,
        amount: dto.amount,
        currency: dto.currency,
      });

      /** -------------------------
       * BALANCE SNAPSHOT
       * ------------------------- */
      const prevSenderBalance = senderWallet.availableBalance;
      const prevReceiverBalance = receiverWallet.availableBalance;

      /** -------------------------
       * LOCK SENDER WALLET
       * ------------------------- */
      const { fee, totalDeducted } = await calculateFeeBreakdown(
        dto.amount,
        dto.currency,
        "P2P_TRANSFER",
      );

      console.log(fee, totalDeducted);

      const senderWalletLocked = await lockWalletFunds(
        senderWallet._id,
        totalDeducted,
        session,
      );

      if (!senderWalletLocked) {
        throw new BadRequestError("SENDER_WALLET_LOCK_FAILED");
      }

      /** -------------------------
       * TRANSFER ENGINE
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } =
        await lookUpLedgerAccountforP2P(
          senderAccount.userId,
          LedgerOwnerType.USER,
          receiverAccount.userId,
          LedgerOwnerType.USER,
          dto.currency,
          session,
        );

      const result = await new TransferEngine({
        transferType: "P2P_TRANSFER",
        senderAccount,
        receiverAccount,
        senderWallet,
        receiverWallet,
        senderLedgerId,
        receiverLedgerId,
        fee,
        totalDeducted,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      }).transferEngines(context, session);

      /** -------------------------
       * APPLY BALANCE MUTATION
       * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(
        senderWallet._id,
        totalDeducted,
        session,
      );

      const updatedReceiverWallet = await Wallet.findOneAndUpdate(
        { _id: receiverWallet._id },
        { $inc: { availableBalance: dto.amount, version: 1 } },
        { session, new: true },
      );

      if (updatedReceiverWallet) {
        await checkAndAutoRecoverWallet({
          userPublicId: receiverWallet.userPublicId,
          walletId: receiverWallet.walletId,
          newBalance: updatedReceiverWallet.availableBalance,
          currentStatus: receiverWallet.status,
          freezeReason: receiverWallet.freezeReason,
          session,
        });
      }

      /** -------------------------
       * OUTBOX EVENT
       * ------------------------- */
      await emitOutboxEvent(
        {
          topic: "transfer.events",
          eventId: result.transactionRef,
          eventType: AuditAction.TRANSACTION_COMPLETED,
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            sender: {
              walletId: senderWallet.walletId,
              userId: senderWallet.userPublicId,
              name: senderWallet.userId.name,
              email: senderWallet.userId.email,
              accountType: senderAccount.type,
              accountNumber: senderAccount.accountNumber,
              previousBalance: prevSenderBalance,
              currentBalance: updatedSenderWallet?.availableBalance,
              version: updatedSenderWallet.version,
            },
            receiver: {
              walletId: receiverWallet.walletId,
              userId: receiverWallet.userPublicId,
              name: receiverWallet.userId.name,
              email: receiverWallet.userId.email,
              accountType: receiverAccount.type,
              accountNumber: receiverAccount.accountNumber,
              previousBalance: prevReceiverBalance,
              currentBalance: updatedReceiverWallet?.availableBalance,
              version: updatedReceiverWallet?.version,
            },
            amount: dto.amount,
            fee: result.fee, // ← add
            totalDeducted: result.totalDeducted,
            currency: dto.currency,
            referenceId: result.referenceId,
            transactionRef: result.transactionRef,
            transferType: "P2P_TRANSFER",
            limit: config?.maxPerDay,
          },
          aggregateType: "TRANSFER",
          aggregateId: result.transactionRef,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();
      committed = true;

      if (fee > 0) {
        try {
          await FeeAccrual.create({
            accrualId: generateAccrualId(),
            transactionRef: result.transactionRef,
            feeTransactionRef: `${result.transactionRef}-FEE`,
            payerUserId: senderAccount.userPublicId,
            payerName: senderWallet.userId.name,
            category: FeeCategory.P2P_TRANSFER,
            amount: fee,
            currency: dto.currency,
            transitAccount: "sys_fees_pool",
            status: FeeAccrualStatus.ACCRUED,
          });
        } catch (err: any) {
          if (err.code !== 11000) {
            logger.warn(
              "FeeAccrual creation failed after successful P2P transfer",
              {
                transactionRef: result.transactionRef,
                error: err.message,
              },
            );
          }
        }
      }

      // Commit limits to Redis after successful transaction
      try {
        await commitTransactionLimits({
          userPublicId: dto.senderId,
          amount: dto.amount,
          currency: dto.currency,
          reservation,
        });
      } catch (err: any) {
        logger.error("Limit usage commit failed after successful transfer", {
          transactionRef: result.transactionRef,
          userPublicId: dto.senderId,
          amount: dto.amount,
          message: err?.message,
        });
      }

      return {
        result,
        senderNewBalance: updatedSenderWallet?.availableBalance,
      };
    } catch (e) {
      if (!committed) {
        try {
          if (session.inTransaction()) await session.abortTransaction();
        } catch (abortErr: any) {
          logger.warn("Failed to abort transaction (may already be closed)", {
            message: abortErr?.message,
          });
        }

        // Give back the reservation even if the abort above threw.
        // If enforce itself failed, it already cleaned up and `reservation` is null.
        if (reservation) {
          try {
            await rollbackTransactionLimits({
              userPublicId: dto.senderId,
              amount: dto.amount,
              currency: dto.currency,
              reservation,
            });
          } catch (rbErr: any) {
            logger.error("Limit rollback failed", {
              userPublicId: dto.senderId,
              message: rbErr?.message,
            });
          }
        }
      }
      throw e;
    } finally {
      session.endSession();
    }
  }

  public async transferBetweenWallet(
    dto: internalTransferRequest,
    context: IRequestContext,
  ) {
    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(
      dto.idempotencyKey,
    );

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWalletLocked: WalletDocument | null = null;
    let senderWallet: WalletDocument | null = null;
    let receiverWallet: WalletDocument | null = null;

    try {
      /** -------------------------
       * RESOLVE ACCOUNTS
       * ------------------------- */

      const checkingAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.fromType,
        dto.currency,
        session,
      );

      const savingsAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.toType,
        dto.currency,
        session,
      );

      if (!checkingAccount || !savingsAccount) {
        throw new BadRequestError("ACCOUNT_NOT_FOUND");
      }

      if (!checkingAccount.userId.equals(savingsAccount.userId)) {
        throw new BadRequestError("CROSS_USER_INTERNAL_TRANSFER");
      }

      if (dto.fromType === dto.toType) {
        throw new BadRequestError("INVALID ACCOUNT TYPES");
      }

      /** -------------------------
       * WALLET LOAD
       * ------------------------- */
      senderWallet = await findWalletByType(
        checkingAccount.walletId,
        dto.fromType as WalletType,
        dto.currency,
        session,
      );

      receiverWallet = await findWalletByType(
        savingsAccount.walletId,
        dto.toType as WalletType,
        dto.currency,
        session,
      );

      const prevSenderBalance = senderWallet.availableBalance;
      const prevReceiverBalance = receiverWallet?.availableBalance;

      /** -------------------------
       * LOCK SENDER WALLET
       * ------------------------- */
      senderWalletLocked = await lockWalletFunds(
        senderWallet._id,
        dto.amount,
        session,
      );
      if (!senderWalletLocked) {
        throw new BadRequestError("SENDER_WALLET_LOCK_FAILED");
      }

      /** -------------------------
       * LEDGER RESOLUTION
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } =
        await lookUpLedgerAccountForInternalTrx(
          checkingAccount.ledgerAccountId,
          savingsAccount.ledgerAccountId,
          checkingAccount.userId,
          savingsAccount.userId,
          dto.fromType,
          dto.toType,
          session,
        );

      /** -------------------------
       * TRANSFER ENGINE
       * ------------------------- */

      const result = await new TransferEngine({
        transferType: "INTERNAL_TRANSFER",
        senderAccount: checkingAccount,
        receiverAccount: savingsAccount,
        senderWallet,
        receiverWallet,
        senderLedgerId,
        receiverLedgerId,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      }).transferEngines(context, session);

      /** -------------------------
       * DEDUCT FUNDS
       * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(
        senderWallet._id,
        dto.amount,
        session,
      );
      const updatedReceiverWallet = await Wallet.findOneAndUpdate(
        { _id: receiverWallet._id },
        { $inc: { availableBalance: dto.amount, version: 1 } },
        { session, new: true },
      );

      /** -------------------------
       * OUTBOX EVENT
       * ------------------------- */
      await emitOutboxEvent(
        {
          topic: "transfer.events",
          eventId: result.transactionRef,
          eventType: AuditAction.TRANSACTION_COMPLETED,
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            sender: {
              walletId: senderWallet.walletId,
              userId: senderWallet.userPublicId,
              name: senderWallet.userId.name,
              email: senderWallet.userId.email,
              accountType: checkingAccount.type,
              accountNumber: checkingAccount.accountNumber,
              previousBalance: prevSenderBalance,
              currentBalance: updatedSenderWallet?.availableBalance,
              version: updatedSenderWallet.version,
            },
            receiver: {
              walletId: receiverWallet.walletId,
              userId: receiverWallet?.userPublicId,
              name: receiverWallet?.userId.name,
              email: receiverWallet?.userId.email,
              accountType: savingsAccount.type,
              accountNumber: savingsAccount.accountNumber,
              previousBalance: prevReceiverBalance,
              currentBalance: updatedReceiverWallet?.availableBalance,
              version: updatedReceiverWallet?.version,
            },
            amount: dto.amount,
            currency: dto.currency,
            referenceId: result.referenceId,
            transactionRef: result.transactionRef,
            transferType: "INTERNAL_TRANSFER",
          },
          aggregateType: "TRANSFER",
          aggregateId: result.transactionRef,
          version: 1,
          context,
        },
        { session },
      );

      await session.commitTransaction();
      committed = true;
      return result;
    } catch (e) {
      if (!committed) {
        try {
          // The session/transaction may have already been closed by the driver
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
        } catch (abortErr) {
          // Log but don't rethrow — the original error is what matters
          logger.warn("Failed to abort transaction (may already be closed)", {
            abortErr,
          });
        }
      }
      throw e;
    } finally {
      await session.endSession();
    }
  }

  public async transferToVault(
    dto: vaultTransferRequest,
    context: IRequestContext,
  ) {
    // ✅ Idempotency check BEFORE any session/transaction
    const { alreadyCompleted, response } = await extEnsureIdempotence(
      dto.idempotencyKey,
    );

    if (alreadyCompleted) return response;

    const session = await mongoose.startSession();
    session.startTransaction();
    let committed = false;

    let senderWalletLocked: WalletDocument | null = null;
    let senderWallet: WalletDocument | null = null;
    let vault: VaultDocument | null = null;

    try {
      /** -------------------------
       * RESOLVE SENDER ACCOUNT
       * ------------------------- */
      const senderAccount = await resolveAccountByUserId(
        dto.senderId,
        dto.fromType,
        dto.currency,
        session,
      );

      if (!senderAccount) {
        throw new BadRequestError("Account not found");
      }

      if (senderAccount.userPublicId !== dto.senderId) {
        throw new BadRequestError("Unauthorized transfer from account");
      }

      /** -------------------------
       * RESOLVE VAULT
       * ------------------------- */
      vault = await findVault(dto.vaultId, dto.senderId, dto.currency, session);

      if (vault.userPublicId !== context.userId) {
        throw new BadRequestError("Unauthorized transfer to vault");
      }

      if (vault.currency !== dto.currency) {
        throw new BadRequestError("Vault currenct mismatch");
      }

      if (dto.amount <= 0) {
        throw new BadRequestError("Invalid amount");
      }

      /** -------------------------
       * LOCK VAULT FOR CONCURRENCY
       * ------------------------- */
      const vaultLocked = await lockVaultToPreventConcurrency(
        vault._id,
        session,
      );

      if (!vaultLocked) {
        throw new BadRequestError("Vault locked failed");
      }

      /** -------------------------
       * LOAD AND LOCK SENDER WALLET
       * ------------------------- */
      senderWallet = await findWalletByType(
        senderAccount.walletId,
        dto.fromType as WalletType,
        dto.currency,
        session,
      );

      senderWalletLocked = await lockWalletFunds(
        senderWallet._id,
        dto.amount,
        session,
      );

      if (!senderWalletLocked) {
        throw new BadRequestError("Sender wallet lock failed");
      }

      /** -------------------------
       * LEDGER RESOLUTION
       * ------------------------- */
      const { senderLedgerId, receiverLedgerId } = await LookUpVaultLedger(
        senderAccount.ledgerAccountId,
        vault.ledgerAccountId,
        dto.fromType,
        session,
      );

      if (!senderLedgerId || !receiverLedgerId) {
        throw new NotFoundError("SENDER_LEDGER_NOT_FOUND");
      }

      /** -------------------------
       * TRANSFER ENGINE
       * ------------------------- */
      const result = await new TransferEngine({
        transferType: "VAULT_TRANSFER",
        senderAccount,
        receiverAccount: vault,
        senderWallet,
        senderLedgerId: senderLedgerId._id,
        receiverLedgerId: vault.ledgerAccountId,
        amount: dto.amount,
        currency: dto.currency,
        idempotencyKey: dto.idempotencyKey,
      }).transferEngines(context, session);

      /** -------------------------
       * APPLY BALANCES
       * ------------------------- */
      const updatedSenderWallet = await deductWalletFunds(
        senderWallet._id,
        dto.amount,
        session,
      );
      const updatedVault = await vaultModel.findOneAndUpdate(
        { _id: vault._id },
        {
          $inc: {
            currentBalanceMinor: dto.amount,
            version: 1,
          },
        },
        { session, new: true },
      );

      await unlockVault(vault._id, session);

      if (
        vault.vaultType === "TARGET" &&
        vault.targetAmountMinor > 0 &&
        updatedVault &&
        updatedVault.currentBalanceMinor >= vault.targetAmountMinor
      ) {
        await vaultModel.updateOne(
          { _id: vault._id },
          {
            $set: {
              "lock.state": "MATURED",
              status: "COMPLETED",
            },
          },
          { session },
        );

        logger.info("Target vault goal reached");
      }

      /** -------------------------
       * OUTBOX / EVENT EMISSION
       * ------------------------- */
      await emitOutboxEvent(
        {
          topic: "transfer.events", // ← same topic as internal transfer, not vault.events
          eventId: result.transactionRef,
          eventType: AuditAction.TRANSACTION_COMPLETED, // ← reuse, not VAULT_TRANSFER_COMPLETED
          action: AuditAction.TRANSACTION_COMPLETED,
          status: AuditStatus.PENDING,
          payload: {
            sender: {
              walletId: senderWallet.walletId,
              userId: senderWallet.userPublicId,
              name: senderWallet.userId.name,
              email: senderWallet.userId.email,
              accountType: senderAccount.type,
              accountNumber: senderAccount.accountNumber,
              previousBalance: senderWallet.availableBalance,
              currentBalance: updatedSenderWallet?.availableBalance,
              version: updatedSenderWallet.version,
            },
            receiver: {
              walletId: vault.vaultId,
              userId: vault.userPublicId,
              name: vault.title,
              email: senderWallet.userId.email,
              accountType: vault.vaultType,
              accountNumber: vault.vaultId,
              previousBalance: vault.currentBalanceMinor,
              currentBalance: updatedVault?.currentBalanceMinor,
              version: updatedVault?.version,
            },
            amount: dto.amount,
            currency: dto.currency,
            referenceId: result.referenceId,
            transactionRef: result.transactionRef,
            transferType: "VAULT_TRANSFER",
          },
          aggregateType: "TRANSFER", // ← matches your existing router case
          aggregateId: result.transactionRef,
          version: 1,
          context,
        },
        { session },
      );

      /** -------------------------
       * COMMIT TRANSACTION
       * ------------------------- */
      await session.commitTransaction();
      return {
        vault,
        amount: dto.amount,
        newBalance: updatedVault?.currentBalanceMinor,
        targetReached:
          vault.vaultType === "TARGET" &&
          updatedVault &&
          updatedVault?.currentBalanceMinor >= vault.targetAmountMinor,
      };
    } catch (e) {
      if (!committed) {
        try {
          // The session/transaction may have already been closed by the driver
          if (session.inTransaction()) {
            await session.abortTransaction();
          }
        } catch (abortErr) {
          // Log but don't rethrow — the original error is what matters
          logger.warn("Failed to abort transaction (may already be closed)", {
            abortErr,
          });
        }
      }
      throw e;
    } finally {
      session.endSession();
    }
  }

  public lookupAccount = async (accountNumber: string) => {
    const account = await Account.findOne({
      accountNumber,
      status: "ACTIVE",
      isPublic: true,
    })
      .select("accountNumber type userPublicId")
      .lean();

    if (!account) {
      throw new NotFoundError("Account not found");
    }

    const user = await UserModel.findOne({ userId: account.userPublicId })
      .select("name userId")
      .lean();

    if (!user) {
      throw new NotFoundError("User not found");
    }

    return {
      accountNumber: account.accountNumber,
      name: user.name,
      userId: user.userId,
    };
  };
}

export default TransferService;

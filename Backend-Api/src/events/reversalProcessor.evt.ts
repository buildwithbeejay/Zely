import { writeToEmailOutbox } from "@/kafka/emails/write.email";
import {
  UserBalanceSummaryModel,
  UserTransactionModel,
  UserWalletModel,
} from "@/kafka/projections/models/projectionModels";
import { RetryEnvelope } from "@/kafka/retry.helpers/retry.envelope";
import {
  PermanentError,
  TransientError,
} from "@/kafka/retry.helpers/retry.error";
import { accountStatus } from "@/modules/auth/authinterface";
import User from "@/modules/auth/authmodel";
import { Wallet, WalletStatus } from "@/modules/wallet/wallet.model";
import { logger } from "@/shared/utils/logger";
import mongoose from "mongoose";
import { deriveOutboxEventId } from "./authProcessor.evt";
import {
  DriftAction,
  DriftSeverity,
} from "@/modules/reconciliation/reconciliation.model";
import { LedgerAccount } from "@/modules/ledger/ledger.account.model";
import { AuditAction } from "@/modules/audit/audit.interface";

export async function processReversalEvent(
  topic: string,
  envelope: RetryEnvelope,
  session: mongoose.ClientSession,
) {
  const { eventId, payload, version, eventType } = envelope.event;

  try {
    if (!version || version !== 1) {
      throw new PermanentError(`Unsupported event version: ${version}`);
    }

    switch (eventType) {
      case "TRANSFER_REVERSED": {
        const {
          reversalId,
          reversalTransactionRef,
          senderPublicId,
          receiverPublicId,
          reversalAmount,
          originalAmount,
          reason,
        } = payload;

        // ─── Load users OUTSIDE session — read-only ───────────────────────
        const [sender, receiver] = await Promise.all([
          User.findOne({ userId: senderPublicId }).select("userId name").lean(),
          User.findOne({ userId: receiverPublicId })
            .select("userId name")
            .lean(),
        ]);

        // ─── Load wallets OUTSIDE session — read-only ─────────────────────
        const [senderWallet, receiverWallet] = await Promise.all([
          Wallet.findOne({
            userPublicId: senderPublicId,
            type: "MAIN_CHECKINGS",
          })
            .select("walletId")
            .lean(),
          Wallet.findOne({
            userPublicId: receiverPublicId,
            type: "MAIN_CHECKINGS",
          })
            .select("walletId")
            .lean(),
        ]);

        const occurredAt = new Date();
        const baseEvent = {
          transactionRef: reversalTransactionRef,
          referenceId: reversalId,
          currency: "NGN",
          walletType: "MAIN_CHECKINGS",
          counterpartyWalletType: "MAIN_CHECKINGS",
          status: "TRANSACTION_COMPLETED",
          action: "REVERSAL",
          category: "REVERSAL",
          fee: 0,
          penaltyReason: reason,
          occurredAt,
        };

        // All writes go through session
        await UserTransactionModel.findOneAndUpdate(
          {
            eventId: `${reversalTransactionRef}_SENDER`,
            userId: senderPublicId,
            walletType: "MAIN_CHECKINGS",
          },
          {
            $setOnInsert: {
              ...baseEvent,
              eventId: `${reversalTransactionRef}_SENDER`,
              userId: senderPublicId,
              name: `Reversal from ${receiver?.name ?? receiverPublicId}`,
              direction: "credit",
              amount: reversalAmount,
              counterpartyUserId: receiverPublicId,
              counterpartyName: receiver?.name ?? receiverPublicId,
            },
          },
          { upsert: true, session },
        );

        await UserTransactionModel.findOneAndUpdate(
          {
            eventId: `${reversalTransactionRef}_RECEIVER`,
            userId: receiverPublicId,
            walletType: "MAIN_CHECKINGS",
          },
          {
            $setOnInsert: {
              ...baseEvent,
              eventId: `${reversalTransactionRef}_RECEIVER`,
              userId: receiverPublicId,
              name: `Reversal to ${sender?.name ?? senderPublicId}`,
              direction: "debit",
              amount: originalAmount,
              counterpartyUserId: senderPublicId,
              counterpartyName: sender?.name ?? senderPublicId,
            },
          },
          { upsert: true, session },
        );

        await Promise.all([
          UserBalanceSummaryModel.findOneAndUpdate(
            { userId: senderPublicId },
            {
              $inc: {
                mainBalance: reversalAmount,
                totalBalance: reversalAmount,
                totalCredit: reversalAmount,
              },
            },
            { session },
          ),
          UserBalanceSummaryModel.findOneAndUpdate(
            { userId: receiverPublicId },
            {
              $inc: {
                mainBalance: -originalAmount,
                totalBalance: -originalAmount,
                totalDebit: originalAmount,
              },
            },
            { session },
          ),
        ]);

        if (senderWallet) {
          await UserWalletModel.findOneAndUpdate(
            { walletId: senderWallet.walletId },
            { $inc: { balance: reversalAmount } },
            { session },
          );
        }

        if (receiverWallet) {
          await UserWalletModel.findOneAndUpdate(
            { walletId: receiverWallet.walletId },
            { $inc: { balance: -originalAmount } },
            { session },
          );
        }

        logger.info(`[v${version}] TRANSFER_REVERSED projections written`, {
          reversalId,
          senderPublicId,
          receiverPublicId,
        });

        break;
      }

      // ─── Negative balance — suspend the receiver ────────────────────────
      case "WALLET_NEGATIVE_BALANCE": {
        const { walletId, userPublicId, balance, reversalId } = payload;

        logger.warn(`[v${version}] Processing WALLET_NEGATIVE_BALANCE`, {
          userPublicId,
          balance,
          reversalId,
        });

        // 1. Suspend the user account
        const updatedUser = await User.findOneAndUpdate(
          {
            userId: userPublicId,
            // Only suspend if not already suspended/closed
            accountStatus: {
              $nin: [accountStatus.SUSPENDED, accountStatus.ACCOUNT_CLOSED],
            },
          },
          {
            $set: {
              accountStatus: accountStatus.SUSPENDED,
              "suspension.isSuspended": true,
              "suspension.reason": `Negative balance incurred from reversal ${reversalId} — pending collection`,
              "suspension.suspendedBy": "SYSTEM",
              "suspension.suspendedAt": new Date(),
            },
          },
          { session, new: true },
        );

        if (!updatedUser) {
          logger.warn(
            `[v${version}] User ${userPublicId} already suspended or not found — skipping`,
            { reversalId },
          );
          break;
        }

        // 2. Lock the wallet
        await Wallet.findOneAndUpdate(
          { walletId },
          {
            $set: {
              status: WalletStatus.FROZEN,
              freezeReason: `Negative balance from reversal ${reversalId}`,
              locked: true,
              lockUntil: null,
            },
            $push: {
              freezeHistory: {
                frozenAt: new Date(),
                frozenBy: "SYSTEM",
                freezeReason: `Negative balance from reversal ${reversalId} — balance: ${balance}`,
                reversalId,
              },
            },
          },
          { session },
        );

        logger.info(
          `[v${version}] User suspended and wallet frozen due to negative balance`,
          {
            userPublicId,
            reversalId,
            balance,
          },
        );

        // After the wallet lock, still inside the WALLET_NEGATIVE_BALANCE case
        await writeToEmailOutbox(
          {
            jobName: "sendAccountSuspendedEmail",
            jobId: deriveOutboxEventId(
              userPublicId,
              "ACCOUNT_SUSPENDED_EMAIL",
              eventId,
            ),
            eventId,
            aggregateType: "REVERSAL",
            envelope,
            payload: {
              email: updatedUser.email,
              name: updatedUser.name,
              reason: `Your account has been suspended due to a negative balance from reversal ${reversalId}. Please contact support to resolve this.`,
              reversalId,
              balance,
            },
          },
          session,
        );

        logger.info(
          `[v${version}] Account suspension email queued for user ${userPublicId}`,
          {
            reversalId,
          },
        );

        break;
      }

      // ─── Reversal failed — log and alert we are not handling that yet in the reversal processing
      case "REVERSAL_FAILED": {
        const { reversalId, reason } = payload;

        logger.error(`[v${version}] Processing REVERSAL_FAILED`, {
          reversalId,
          reason,
        });

        // Here you could add logic to alert the operations team, e.g., send an email or push notification

        logger.info(`[v${version}] REVERSAL_FAILED processing complete`, {
          reversalId,
        });
        break;
      }

      case AuditAction.RECONCILIATION_DRIFT_DETECTED: {
        const {
          ledgerAccountPublicId,
          ownerType,
          ownerPublicId,
          cachedBalance,
          trueBalance,
          drift,
          severity,
          action,
          autoFrozen,
        } = payload;

        // Only act on wallet-level drifts that weren't already auto-frozen
        // by reconcileLedgerAccount (it freezes synchronously during the run)
        if (autoFrozen) {
          logger.info(
            `[v${version}] Wallet already frozen during reconciliation run`,
            {
              ledgerAccountPublicId,
              ownerPublicId,
            },
          );
          break;
        }

        // Only freeze on OVERSTATED + ALERT_AND_FREEZE — same logic as reconcileLedgerAccount
        if (
          action !== DriftAction.ALERT_AND_FREEZE ||
          severity !== DriftSeverity.OVERSTATED
        ) {
          logger.info(
            `[v${version}] Drift does not require freeze — alerting only`,
            {
              ledgerAccountPublicId,
              severity,
              action,
            },
          );
          break;
        }

        // Find the wallet by ledger account public ID
        const ledgerAccount = await LedgerAccount.findOne({
          ledgerAccountId: ledgerAccountPublicId,
        }).lean();

        if (!ledgerAccount) {
          logger.warn(
            `[v${version}] Ledger account not found for drift event`,
            {
              ledgerAccountPublicId,
            },
          );
          break;
        }

        const wallet = await Wallet.findOne({
          ledgerAccountId: ledgerAccount._id,
        }).session(session);

        if (!wallet) {
          logger.warn(`[v${version}] Wallet not found for drift event`, {
            ledgerAccountPublicId,
          });
          break;
        }

        // Skip if already frozen or reconciling
        if (
          wallet.status === WalletStatus.FROZEN ||
          wallet.status === WalletStatus.RECONCILING
        ) {
          logger.info(`[v${version}] Wallet already frozen — skipping`, {
            walletId: wallet.walletId,
          });
          break;
        }

        await Wallet.findOneAndUpdate(
          { _id: wallet._id },
          {
            $set: {
              status: WalletStatus.RECONCILING,
              freezeReason: `RECONCILIATION_DRIFT: cached=${cachedBalance}, true=${trueBalance}, drift=${drift}`,
              locked: true,
            },
            $push: {
              freezeHistory: {
                frozenAt: new Date(),
                frozenBy: null,
                freezeReason: `RECONCILIATION_DRIFT_DETECTED: drift=${drift}, severity=${severity}`,
              },
            },
          },
          { session },
        );

        logger.warn(
          `[v${version}] Wallet frozen via reconciliation drift event`,
          {
            walletId: wallet.walletId,
            ownerPublicId,
            drift,
            severity,
          },
        );

        break;
      }

      default:
        throw new PermanentError(
          `Unsupported reversal event type: ${eventType}`,
        );
    }
  } catch (err: any) {
    if (err instanceof PermanentError || err instanceof TransientError) {
      throw err;
    }
    throw new TransientError(
      `[v${version}] Reversal event failed: ${err.message}`,
    );
  }
}

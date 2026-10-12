import {
  extEnsureIdempotence,
  markCompleted,
} from "@/modules/helpers/ext.idempotence";
import BadRequestError from "@/shared/errors/badRequest";
import mongoose, { Types } from "mongoose";

import { IRequestContext } from "@/config/interfaces/request.interface";
import {
  generateReferenceId,
  generateTransactionId,
} from "@/shared/utils/id.generator";
import TransactionBuilder from "../ledger/ledger.transaction.builder";

import { lockAccountToPreventConcurrency } from "../helpers/resolvers";

import { generateAccrualId } from "@/shared/utils/id.generator";
import { AccountDocument } from "../account/account.interface";
import { Account } from "../account/account.model";
import {
  LedgerAccount,
  LedgerAccountDocument,
  LedgerAccountType,
  LedgerOwnerType,
} from "../ledger/ledger.account.model";
import { LedgerEntryNature } from "../ledger/ledger.entry.model";
import { VaultDocument } from "../vault/vault.model";
import { Wallet, WalletDocument } from "../wallet/wallet.model";
import { FeeAccrual, FeeCategory } from "@/modules/fee/fee.accrual.model";

type BaseTransferInput = {
  senderAccount: AccountDocument;
  receiverAccount: AccountDocument | LedgerAccountDocument | VaultDocument;
  senderLedgerId: Types.ObjectId;
  receiverLedgerId: Types.ObjectId;

  amount: number;
  currency: string;
  idempotencyKey: string;
  fee?: number;
  totalDeducted?: number;
};

type WalletToWalletInput = BaseTransferInput & {
  transferType: "P2P_TRANSFER" | "INTERNAL_TRANSFER";
  senderWallet: WalletDocument;
  receiverWallet: WalletDocument;
};

type WalletToVaultInput = BaseTransferInput & {
  transferType: "VAULT_TRANSFER";
  senderWallet: WalletDocument;
  receiverWallet?: never;
};

export type TransferEngineInput = WalletToWalletInput | WalletToVaultInput;

class TransferEngine {
  constructor(private readonly input: TransferEngineInput) {}

  async transferEngines(
    context: IRequestContext,
    session: mongoose.ClientSession,
  ) {
    if (!session.inTransaction()) {
      throw new BadRequestError("Transfers must run inside a DB transaction");
    }

    const {
      senderAccount,
      receiverAccount,
      senderLedgerId,
      receiverLedgerId,
      amount,
      currency,
      idempotencyKey,
    } = this.input;

    const transactionRef = generateTransactionId();
    const referenceId = generateReferenceId();

    let accountNumber: string;
    if ("accountNumber" in receiverAccount) {
      accountNumber = receiverAccount.accountNumber;
    } else {
      accountNumber = receiverAccount.ledgerAccountId.toString();
    }

    /** -------------------------
     * IDEMPOTENCY
     * ------------------------- */
    const { alreadyCompleted, response } =
      await extEnsureIdempotence(idempotencyKey);

    if (alreadyCompleted) return response;

    const fee = this.input.fee ?? 0;
    const totalDeducted = this.input.totalDeducted ?? amount;

    /** -------------------------
     * CONCURRENCY LOCKING
     * ------------------------- */
    if ("accountNumber" in receiverAccount) {
      const [first, second] =
        senderAccount._id.toHexString() < receiverAccount._id.toHexString()
          ? [senderAccount, receiverAccount]
          : [receiverAccount, senderAccount];

      if (!(await lockAccountToPreventConcurrency(first._id, session))) {
        throw new BadRequestError("LOCK_FAILED");
      }

      if (!(await lockAccountToPreventConcurrency(second._id, session))) {
        throw new BadRequestError("LOCK_FAILED");
      }
    }

    // Case 2: Wallet → Vault (receiver is ledger account)
    else {
      if (
        !(await lockAccountToPreventConcurrency(senderAccount._id, session))
      ) {
        throw new BadRequestError("LOCK_FAILED");
      }
    }

    /** -------------------------
     * LEDGER ENTRIES
     * ------------------------- */
    const builder = new TransactionBuilder(this.input.transferType);

    builder.addDebit({
      ledgerAccountId: senderLedgerId,
      amount,
      currency,
      nature: LedgerEntryNature.DEBIT,
      transactionRef,
      referenceId,
      referenceType: this.input.transferType,
    });

    builder.addCredit({
      ledgerAccountId: receiverLedgerId,
      amount,
      currency,
      nature: LedgerEntryNature.CREDIT,
      transactionRef,
      referenceId,
      referenceType: this.input.transferType,
    });

    const txn = await builder.commit(session);

    // ─── FEE LEDGER ENTRIES ────────────────────────────────────────────────
    if (fee > 0) {
      // Look up revenue ledger account
      const revenueLedgerAccount = await LedgerAccount.findOne({
        ownerType: LedgerOwnerType.SYSTEM,
        type: LedgerAccountType.SYSTEM_REVENUE,
        currency,
      }).session(session);

      if (!revenueLedgerAccount) {
        throw new BadRequestError("Revenue ledger account not found");
      }

      const feeBuilder = new TransactionBuilder("FEE");

      feeBuilder.addDebit({
        ledgerAccountId: senderLedgerId,
        amount: fee,
        currency,
        nature: LedgerEntryNature.DEBIT,
        transactionRef: `${transactionRef}-FEE`,
        referenceId,
        referenceType: "FEE",
      });

      feeBuilder.addCredit({
        ledgerAccountId: revenueLedgerAccount._id,
        amount: fee,
        currency,
        nature: LedgerEntryNature.CREDIT,
        transactionRef: `${transactionRef}-FEE`,
        referenceId,
        referenceType: "FEE",
      });

      await feeBuilder.commit(session);

      await Wallet.findOneAndUpdate(
        {
          userPublicId: revenueLedgerAccount.userPublicId,
          type: revenueLedgerAccount.type,
          currency,
        },
        { $inc: { availableBalance: fee, version: 1 } },
        { session, new: true },
      );
    }

    /** -------------------------
     * UNLOCK ACCOUNTS
     * ------------------------- */
    const accountIdsToUnlock = [senderAccount._id];

    if ("accountNumber" in receiverAccount) {
      accountIdsToUnlock.push(receiverAccount._id);
    }

    await Account.updateMany(
      { _id: { $in: accountIdsToUnlock } },
      { $set: { locked: false, lockUntil: null } },
      { session },
    );

    /** -------------------------
     * IDEMPOTENCY FINALIZE
     * ------------------------- */
    await markCompleted(idempotencyKey, transactionRef, {
      transactionId: txn.transactionRef,
    });

    return {
      transactionRef,
      referenceId,
      amount,
      fee,
      totalDeducted,
    };
  }
}

export default TransferEngine;

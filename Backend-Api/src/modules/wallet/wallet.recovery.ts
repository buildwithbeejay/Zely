import mongoose from "mongoose";
import { Wallet, WalletStatus } from "@/modules/wallet/wallet.model";
import { accountStatus } from "@/modules/auth/authinterface";
import User from "@/modules/auth/authmodel";
import { logger } from "@/shared/utils/logger";

// In wallet.recovery.ts, update the function signature:
export async function checkAndAutoRecoverWallet(params: {
  userPublicId: string;
  walletId: string;
  newBalance: number;
  currentStatus: string;
  freezeReason: string | null;
  session: mongoose.ClientSession;
}) {
  const { userPublicId, walletId, newBalance, currentStatus, freezeReason, session } = params;

  // Only act if balance is now >= 0
  if (newBalance < 0) return;

  // Only act if frozen due to negative balance
  const isFrozenForNegativeBalance =
    currentStatus === WalletStatus.FROZEN &&
    (
      freezeReason?.includes("Negative balance from reversal") ||
      freezeReason === null
    );

  if (!isFrozenForNegativeBalance) return;

  // ─── Unfreeze wallet ──────────────────────────────────────────────
  await Wallet.findOneAndUpdate(
    { walletId },
    {
      $set: {
        status: WalletStatus.ACTIVE,
        locked: false,
        freezeReason: null,
        freezeUntil: null,
        unfreezeReason: "Balance restored — auto-recovered after deposit",
        unfrozenAt: new Date(),
        unfrozenBy: "SYSTEM",
      },
    },
    { session },
  );

  // ─── Unsuspend user ───────────────────────────────────────────────
  await User.findOneAndUpdate(
    {
      userId: userPublicId,
      "suspension.isSuspended": true,
      "suspension.suspendedBy": "SYSTEM",
    },
    {
      $set: {
        accountStatus: accountStatus.ACCOUNT_READY,
        "suspension.isSuspended": false,
        "suspension.reason": null,
        "suspension.suspendedBy": null,
        "suspension.suspendedAt": null,
      },
    },
    { session },
  );

  logger.info("✅ Wallet and user auto-recovered after balance restored", {
    userPublicId,
    walletId,
    newBalance,
  });
}

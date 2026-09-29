// admin.user.service.ts
import User from "@/modules/auth/authmodel";
import { accountStatus, UserRole } from "@/modules/auth/authinterface";
import { KycTier } from "@/modules/transactionLimit/transaction.limit.model";
import { NotFoundError } from "@/shared/errors/notFoundError";
import userService from "@/modules/users/user.service";
import { UserTransactionModel } from "@/kafka/projections/models/projectionModels";

const SORT_MAP: Record<string, string> = {
  name: "name",
  status: "accountStatus",
  role: "role",
  kycTier: "kycTier",
  joinedDate: "createdAt",
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

class AdminUserService {
  private users = new userService();

  public listUsers = async (query: {
    search?: string;
    sort?: string;
    order?: string;
    page?: number | string;
    limit?: number | string;
    status?: string;
    role?: string;
    kycTier?: string;
  }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sortField = SORT_MAP[query.sort ?? ""] ?? "createdAt";
    const sortOrder = query.order === "asc" ? 1 : -1;

    const filter: Record<string, any> = { role: { $ne: UserRole.SYSTEM } };

    if (Object.values(accountStatus).includes(query.status as any))
      filter.accountStatus = query.status;
    if (Object.values(KycTier).includes(query.kycTier as any))
      filter.kycTier = query.kycTier;
    if (
      query.role &&
      query.role !== UserRole.SYSTEM &&
      Object.values(UserRole).includes(query.role as any)
    )
      filter.role = query.role;

    const search = (query.search ?? "").trim().slice(0, 100);
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ name: rx }, { email: rx }, { userId: rx }];
    }

    const [docs, total] = await Promise.all([
      User.find(filter)
        .select(
          "userId name email phone accountStatus role kycTier isEmailVerified mfaEnabled security.lockedUntil createdAt",
        )
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const now = new Date();
    return {
      users: docs.map((u: any) => ({
        id: String(u._id),
        userId: u.userId,
        name: u.name,
        email: u.email,
        phone: u.phone,
        status: u.accountStatus,
        role: u.role,
        kycTier: u.kycTier,
        isEmailVerified: u.isEmailVerified,
        mfaEnabled: u.mfaEnabled,
        isLocked: !!u.security?.lockedUntil && u.security.lockedUntil > now,
        joinedDate: u.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  };

  public getUserDetail = async (userPublicId: string) => {
    const user: any = await User.findOne({
      userId: userPublicId,
      role: { $ne: UserRole.SYSTEM },
    })
      .select(
        "userId name email phone address accountStatus role kycTier isEmailVerified mfaEnabled security.lockedUntil security.lockReason security.failedLoginAttempts transactionPin.setAt transactionPin.lockedUntil provisioningRetryCount lastProvisioningRetryAt passwordChangedAt createdAt updatedAt",
      )
      .lean();

    if (!user) throw new NotFoundError("USER_NOT_FOUND");

    const [summary, wallets, transactions] = await Promise.all([
      this.users.getDashboardSummary(userPublicId),
      this.users.getWallets(userPublicId),
      this.users.getTransactions(userPublicId, { limit: 10, page: 1 }),
    ]);

    const now = new Date();
    return {
      user: {
        id: String(user._id),
        userId: user.userId,
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        status: user.accountStatus,
        role: user.role,
        kycTier: user.kycTier,
        isEmailVerified: user.isEmailVerified,
        mfaEnabled: user.mfaEnabled,
        hasTransactionPin: !!user.transactionPin?.setAt,
        isLocked:
          !!user.security?.lockedUntil && user.security.lockedUntil > now,
        lockReason: user.security?.lockReason ?? null,
        failedLoginAttempts: user.security?.failedLoginAttempts ?? 0,
        provisioningRetryCount: user.provisioningRetryCount ?? 0,
        lastProvisioningRetryAt: user.lastProvisioningRetryAt ?? null,
        passwordChangedAt: user.passwordChangedAt ?? null,
        joinedDate: user.createdAt,
      },
      summary,
      wallets,
      transactions,
    };
  };

  public listTransactions = async (query: {
    search?: string;
    userId?: string;
    direction?: "debit" | "credit";
    walletType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number | string;
    limit?: number | string;
    sort?: string;
    order?: string;
  }) => {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const sortField = query.sort === "amount" ? "amount" : "occurredAt";
    const sortOrder = query.order === "asc" ? 1 : -1;

    const filter: Record<string, any> = {};
    if (query.userId) filter.userId = query.userId;
    if (query.direction) filter.direction = query.direction;
    if (query.walletType) filter.walletType = query.walletType;
    if (query.status) filter.status = query.status;

    if (query.dateFrom || query.dateTo) {
      filter.occurredAt = {};
      if (query.dateFrom) filter.occurredAt.$gte = new Date(query.dateFrom);
      if (query.dateTo) filter.occurredAt.$lte = new Date(query.dateTo);
    }

    // Search by transaction ref, reference ID, or counterparty name —
    // and, if it looks like a name/email, resolve it to matching user IDs first
    const search = (query.search ?? "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");

      const matchingUsers = await User.find({
        $or: [{ name: rx }, { email: rx }],
      })
        .select("userId")
        .limit(50)
        .lean();

      filter.$or = [
        { transactionRef: rx },
        { referenceId: rx },
        { counterpartyName: rx },
        { userId: search }, // exact match if they paste a user ID
        { counterpartyUserId: search }, // exact match on the other side of a transfer
        ...(matchingUsers.length
          ? [{ userId: { $in: matchingUsers.map((u) => u.userId) } }]
          : []),
      ];
    }

    const [docs, total] = await Promise.all([
      UserTransactionModel.find(filter)
        .sort({ [sortField]: sortOrder, _id: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      UserTransactionModel.countDocuments(filter),
    ]);

    // Batch-resolve user names for the page of results (avoids N+1 queries)
    const userIds = [...new Set(docs.map((d: any) => d.userId))];
    const users = await User.find({ userId: { $in: userIds } })
      .select("userId name email")
      .lean();
    const userMap = new Map(users.map((u: any) => [u.userId, u]));

    return {
      transactions: docs.map((t: any) => ({
        transactionId: t.transactionRef ?? t.eventId,
        userId: t.userId,
        userName: userMap.get(t.userId)?.name ?? "Unknown user",
        userEmail: userMap.get(t.userId)?.email ?? null,
        direction: t.direction,
        amount: t.amount,
        currency: t.currency,
        walletType: t.walletType,
        status: t.status,
        action: t.action,
        referenceId: t.referenceId,
        category: t.category,
        counterpartyUserId: t.counterpartyUserId ?? null,
        counterpartyName: t.counterpartyName,
        counterpartyWalletType: t.counterpartyWalletType,
        name: t.name,
        fee: t.fee,
        penaltyReason: t.penaltyReason,
        occurredAt: t.occurredAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  };

  public getTransactionDetail = async (transactionId: string) => {
    const t: any = await UserTransactionModel.findOne({
      $or: [{ transactionRef: transactionId }, { eventId: transactionId }],
    }).lean();

    if (!t) throw new NotFoundError("TRANSACTION_NOT_FOUND");

    const user = await User.findOne({ userId: t.userId })
      .select("userId name email phone")
      .lean();

    return {
      transactionId: t.transactionRef ?? t.eventId,
      user: user
        ? {
            userId: user.userId,
            name: user.name,
            email: user.email,
            //phone: user.phone,
          }
        : null,
      direction: t.direction,
      amount: t.amount,
      currency: t.currency,
      walletType: t.walletType,
      status: t.status,
      referenceId: t.referenceId,
      category: t.category,
      counterpartyName: t.counterpartyName,
      counterpartyWalletType: t.counterpartyWalletType,
      name: t.name,
      fee: t.fee,
      penaltyReason: t.penaltyReason,
      occurredAt: t.occurredAt,
      raw: t, // keep everything else visible for an admin debugging a specific transaction
      action: t.action,
      counterpartyUserId: t.counterpartyUserId ?? null,
    };
  };
}

export default AdminUserService;

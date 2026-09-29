import { axiosPrivate } from "../api/client";

export interface AdminUserRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  role: string;
  kycTier: string;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  isLocked: boolean;
  joinedDate: string;
}

export interface AdminTransactionRow {
  transactionId: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  walletType: string;
  status: string;
  action?: string;
  referenceId: string;
  category?: string;
  counterpartyUserId?: string | null;
  counterpartyName?: string;
  counterpartyWalletType?: string;
  name?: string;
  fee?: number;
  penaltyReason?: string;
  occurredAt: string;
  rowKey: string;
}

export interface AdminTransactionsQuery {
  search?: string;
  userId?: string;
  direction?: string;
  walletType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
}

export interface AdminUsersQuery {
  search?: string;
  sort?: string;
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  kycTier?: string;
}

export interface AdminUsersResponse {
  ok: boolean;
  users: AdminUserRow[];
  total: number;
  page: number;
  pages: number;
}

export interface AdminSessionRow {
  sessionId: string;
  deviceName: string;
  ipAddress: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface AdminUserDetail {
  user: AdminUserRow & {
    address: string | null;
    hasTransactionPin: boolean;
    lockReason: string | null;
    failedLoginAttempts: number;
    provisioningRetryCount: number;
    lastProvisioningRetryAt: string | null;
    passwordChangedAt: string | null;
  };
  summary: {
    totalBalance: number;
    mainBalance: number;
    savingsBalance: number;
    vaultBalance: number;
    totalDebit: number;
    totalCredit: number;
    currency: string;
  };
  wallets: Array<{
    walletId: string;
    walletType: string;
    balance: number;
    currency: string;
    status: string;
    accountNumber: string | null;
    totalCredit: number;
    totalDebit: number;
  }>;
  transactions: {
    transactions: Array<{
      transactionId: string;
      direction: "debit" | "credit";
      amount: number;
      currency: string;
      walletType: string;
      status: string;
      counterpartyName?: string;
      name?: string;
      category?: string;
      occurredAt: string;
    }>;
  };
}

export interface AdminAuditLogRow {
  id: string;
  action: string;
  status: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  trackedEmail: string;
  userId: string | null;
  ip: string;
  userAgent: string;
  attemptCount: number;
  metadata: Record<string, any>;
  createdAt: string;
  lastAttempt: string;
}

export interface AdminAuditLogsQuery {
  search?: string;
  action?: string;
  status?: string;
  severity?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export const adminService = {
  getUsers: async (
    params: AdminUsersQuery,
    signal?: AbortSignal,
  ): Promise<AdminUsersResponse> => {
    const response = await axiosPrivate.get("/admin/users", { params, signal });
    return response.data;
  },

  getUserDetail: async (
    userId: string,
    signal?: AbortSignal,
  ): Promise<{ ok: boolean; data: AdminUserDetail }> => {
    const response = await axiosPrivate.get(
      `/admin/users/${encodeURIComponent(userId)}`,
      { signal },
    );
    return response.data;
  },

  getSessions: async (userId: string, signal?: AbortSignal) => {
    const response = await axiosPrivate.get(
      `/admin/users/${encodeURIComponent(userId)}/sessions`,
      { signal },
    );
    return response.data as { ok: boolean; data: AdminSessionRow[] };
  },

  killSession: async (userId: string, sessionId: string) => {
    const response = await axiosPrivate.delete(
      `/admin/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`,
    );
    return response.data as { ok: boolean; message: string };
  },

  killAllSessions: async (userId: string) => {
    const response = await axiosPrivate.delete(
      `/admin/users/${encodeURIComponent(userId)}/sessions`,
    );
    return response.data as { ok: boolean; message: string };
  },
};

export const adminTransactionService = {
  getAll: async (params: AdminTransactionsQuery, signal?: AbortSignal) => {
    const response = await axiosPrivate.get("/admin/transactions", {
      params,
      signal,
    });
    return response.data as {
      ok: boolean;
      transactions: AdminTransactionRow[];
      total: number;
      page: number;
      pages: number;
    };
  },

  getDetail: async (transactionId: string, signal?: AbortSignal) => {
    const response = await axiosPrivate.get(
      `/admin/transactions/${encodeURIComponent(transactionId)}`,
      { signal },
    );
    return response.data as {
      ok: boolean;
      data: AdminTransactionRow & {
        user: {
          userId: string;
          name: string;
          email: string;
          phone: string;
        } | null;
        raw: any;
      };
    };
  },
};

export const adminAuditService = {
  getAll: async (params: AdminAuditLogsQuery, signal?: AbortSignal) => {
    const response = await axiosPrivate.get("/admin/audit-logs", {
      params,
      signal,
    });
    return response.data as {
      ok: boolean;
      logs: AdminAuditLogRow[];
      total: number;
      page: number;
      pages: number;
    };
  },
};

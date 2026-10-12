import { axiosPrivate } from "../api/client";

export interface DashboardStats {
  totalUsers: number;
  totalVolume: number;
  userGrowthTrend: string;
  volumeTrend: string;
  systemHealthPercent: number;
  pendingKyc: number;
}

export interface DashboardOverview {
  stats: {
    totalUsers: number;
    userGrowthTrend: string;
    totalVolume: number;
    volumeTrend: string;
    systemHealthPercent: number;
    pendingKyc: number;
  };
  userGrowth: {
    labels: string[];
    values: number[];
  };
  systemMetrics: {
    activeSessions: { value: number; max: number };
    transactionRate: { value: number; max: number };
    apiLatency: { value: number; max: number };
  };
  recentLogs: Array<{
    timestamp: string;
    level: "INFO" | "WARN" | "CRIT";
    message: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    adminName: string;
    timestamp: string;
  }>;
  toggles: Array<{
    key: string;
    label: string;
    active: boolean;
  }>;
}

export interface AdminUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  role: string;
  kycTier: string;
  isEmailVerified: boolean;
  mfaEnabled: boolean;
  isLocked: boolean;
  joinedDate: string;
  accountNumber: string | null;
}

export interface FundUsersPayload {
  users: Array<{ userId: string; amount: number }>;
}

// export const adminDashboardService = {
//   getOverview: (signal?: AbortSignal): Promise<DashboardOverview> =>
//     axiosPrivate
//       .get("/admin/dashboard/overview", { signal })
//       .then((res) => res.data),

//   saveToggles: (
//     toggles: Array<{ key: string; active: boolean }>,
//   ): Promise<void> =>
//     axiosPrivate.patch("/admin/dashboard/toggles", { toggles }).then(() => {}),
// };

export interface TreasuryTopUpPayload {
  amount: number;
  currency: string;
  reason: string;
}

export interface FeeStats {
  grossAccruals: { amount: number; count: number };
  unswept: { amount: number; count: number };
  sweptToTreasury: { amount: number };
  reversedAndWaived: { amount: number };
}

export interface FeeAccrualRow {
  accrualId: string;
  transactionRef: string;
  feeTransactionRef: string;
  payerUserId: string;
  payerName: string;
  category: string;
  amount: number;
  currency: string;
  transitAccount: string;
  status: "ACCRUED" | "SWEPT" | "WAIVED";
  waivedBy?: string;
  waivedAt?: string;
  waiverReason?: string;
  createdAt: string;
}

export interface FeeSweepRow {
  sweepId: string;
  initiatedBy: string;
  totalAmount: number;
  currency: string;
  accrualCount: number;
  status: "PENDING" | "COMPLETED" | "FAILED";
  completedAt?: string;
  createdAt: string;
}

export interface FeeSchedule {
  _id: string;
  currency: string;
  transferType: string;
  tiers: Array<{ min: number; max: number; fee: number }>;
  isActive: boolean;
}

export const adminDashboardService = {
  getStats: (signal?: AbortSignal): Promise<DashboardStats> =>
    axiosPrivate
      .get("/admin/dashboard/stats", { signal })
      .then((res) => res.data.data),

  // add these to the existing adminDashboardService object
  getUsers: (
    signal?: AbortSignal,
    params?: { role?: string; limit?: number },
  ): Promise<{ users: AdminUser[]; total: number }> =>
    axiosPrivate
      .get("/admin/users", {
        params: { limit: 100, ...params },
        signal,
      })
      .then((res) => res.data),

  fundUsers: (payload: FundUsersPayload): Promise<any> =>
    axiosPrivate.post("/fund/users", payload).then((res) => res.data),

  topUpTreasury: (payload: TreasuryTopUpPayload): Promise<any> =>
    axiosPrivate
      .post("/admin/funding/topup-treasury", payload)
      .then((res) => res.data),

  getFeeStats: (currency?: string): Promise<FeeStats> =>
    axiosPrivate
      .get("/admin/fees/stats", { params: { currency } })
      .then((res) => res.data.data),

  listFeeAccruals: (
    params: {
      search?: string;
      status?: string;
      category?: string;
      page?: number;
      limit?: number;
    },
    signal?: AbortSignal,
  ): Promise<{ accruals: FeeAccrualRow[]; total: number; pages: number }> =>
    axiosPrivate
      .get("/admin/fees/accruals", { params, signal })
      .then((res) => res.data),

  waiveFee: (accrualId: string, reason: string): Promise<any> =>
    axiosPrivate
      .post(`/admin/fees/accruals/${accrualId}/waive`, { reason })
      .then((res) => res.data),

  sweepAccruals: (currency?: string): Promise<any> =>
    axiosPrivate
      .post("/admin/fees/sweep", { currency: currency ?? "NGN" })
      .then((res) => res.data),

  listFeeSweeps: (params: {
    page?: number;
    limit?: number;
  }): Promise<{ sweeps: FeeSweepRow[]; total: number; pages: number }> =>
    axiosPrivate.get("/admin/fees/sweeps", { params }).then((res) => res.data),

  listFeeSchedules: (): Promise<{ schedules: FeeSchedule[] }> =>
    axiosPrivate.get("/admin/fees/schedules").then((res) => res.data),

  updateFeeSchedule: (
    id: string,
    updates: { tiers?: any[]; isActive?: boolean },
  ): Promise<any> =>
    axiosPrivate
      .put(`/admin/fees/schedules/${id}`, updates)
      .then((res) => res.data),

  waiveAndRefundFee: (accrualId: string, reason: string): Promise<any> =>
    axiosPrivate
      .post(`/admin/fees/accruals/${accrualId}/waive-and-refund`, { reason })
      .then((res) => res.data),
};

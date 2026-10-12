import { axiosPrivate } from "@/api/client";

export interface ReconReport {
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  accountsChecked: number;
  driftsFound: number;
  triggeredBy: "SCHEDULED" | "MANUAL";
  errorMessage?: string;
}

export interface ReconSummary {
  lastRun: ReconReport | null;
  negativeBalanceCount: number;
  frozenWalletCount: number;
  failedReversalCount: number;
  openDriftCount: number;
}

export interface SystemInvariantResult {
  totalWalletBalance: number;
  totalLedgerNet: number;
  totalLedgerCredits: number;
  totalLedgerDebits: number;
  invariantDrift: number;
  isBalanced: boolean;
  driftedWallets: any[];
  checkedAt: string;
}

export interface IDriftRecord {
  ledgerAccountId: string;
  ledgerAccountPublicId: string;
  ownerType: string;
  ownerPublicId: string;
  currency: string;
  cachedBalance: number;
  trueBalance: number;
  drift: number;
  severity: "IN_SYNC" | "OVERSTATED" | "UNDERSTATED";
  action: "NONE" | "ALERT_ONLY" | "ALERT_AND_FREEZE";
  category:
    | "MISSING_CREDIT"
    | "MISSING_DEBIT"
    | "DUPLICATE_ENTRY"
    | "AMOUNT_MISMATCH"
    | "ROUNDING_ERROR"
    | "NORMAL";
  detectedAt: string;
  notes?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionType?: "CORRECTED" | "FALSE_POSITIVE" | "ESCALATED";
  correctionMethod?: "LEDGER_ENTRY" | "DIRECT_CACHE_SYNC";
  resolutionNotes?: string;
  compensatingEntryRef?: string;
}

export interface ReconReportDetail {
  runId: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  accountsChecked: number;
  driftsFound: number;
  triggeredBy: "SCHEDULED" | "MANUAL";
  errorMessage?: string;
  drifts: IDriftRecord[];
}

export const reconciliationService = {
  getSummary: async (): Promise<ReconSummary> => {
    const res = await axiosPrivate.get("/admin/reconciliation/summary");
    return res.data.data;
  },

  getReports: async (params?: {
    status?: string;
    triggeredBy?: string;
    onlyWithDrifts?: boolean;
    limit?: number;
    skip?: number;
  }): Promise<ReconReport[]> => {
    const res = await axiosPrivate.get("/admin/reconciliation/reports", {
      params,
    });
    return res.data.data;
  },

  getReportById: async (runId: string): Promise<ReconReportDetail> => {
    const res = await axiosPrivate.get(
      `/admin/reconciliation/reports/${runId}`,
    );
    return res.data.data;
  },

  runReconciliation: async (): Promise<ReconReport> => {
    const res = await axiosPrivate.post("/admin/reconciliation/run");
    return res.data.data;
  },

  checkSystemInvariant: async (): Promise<SystemInvariantResult> => {
    const res = await axiosPrivate.get(
      "/admin/reconciliation/system-invariant",
    );
    return res.data.data;
  },

  resolveDrift: async (params: {
    runId: string;
    ledgerAccountPublicId: string;
    resolutionType: "CORRECTED" | "FALSE_POSITIVE" | "ESCALATED";
    notes: string;
    applyCorrection?: boolean;
    correctionMethod?: "LEDGER_ENTRY" | "DIRECT_CACHE_SYNC";
  }) => {
    const { runId, ledgerAccountPublicId, ...body } = params;
    const res = await axiosPrivate.post(
      `/admin/reconciliation/reports/${runId}/drifts/${ledgerAccountPublicId}/resolve`,
      body,
    );
    return res.data.data;
  },

  reconcilePaystack: async (
    date?: string,
  ): Promise<{
    totalChecked: number;
    driftsFound: number;
    drifts: Array<{
      reference: string;
      providerReference: string;
      category: string;
      ourAmount?: number;
      providerAmount?: number;
      ourStatus?: string;
      providerStatus?: string;
      detectedAt: string;
      requiresManualReview: boolean;
    }>;
  }> => {
    const res = await axiosPrivate.post(
      "/admin/reconciliation/settlements/paystack",
      {
        date: date ?? new Date().toISOString().split("T")[0],
      },
    );
    return res.data.data;
  },
};

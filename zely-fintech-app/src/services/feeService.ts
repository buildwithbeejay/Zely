import { axiosPrivate } from "../api/client";

export type FeeCategory =
  | "P2P_TRANSFER"
  | "PAYSTACK_INGRESS"
  | "NIP_INTERBANK"
  | "STAMP_DUTY_ETL"
  | "SAVINGS_BREAK_LOCK"
  | "CARD_ISSUANCE"
  | "SMS_OTP_SURCHARGE";

export type FeeAccrualStatus =
  | "ACCRUED"
  | "SWEPT_TO_TREASURY"
  | "REVERSED"
  | "WAIVED";

export interface FeeAccrualRecord {
  accrualId: string;
  feeCategory: FeeCategory;
  categoryLabel: string;
  amount: number;
  currency: "NGN" | "USD";
  originalTransactionRef: string;
  reversalId?: string | null;
  payerUserId: string;
  payerName: string;
  payerEmail: string;
  sourceAccount: string;
  transitPoolAccount: string;
  status: FeeAccrualStatus;
  accruedAt: string;
  sweptAt?: string | null;
  sweepBatchRef?: string | null;
  notes?: string;
}

export interface FeeSchedule {
  id: string;
  category: FeeCategory;
  name: string;
  description: string;
  type: "FLAT" | "PERCENTAGE" | "TIERED" | "STATUTORY";
  rate: string;
  rateValue: number;
  unit: "NGN" | "PERCENT" | "USD";
  active: boolean;
  waiverEligible: boolean;
  targetAccount: string;
  updatedAt: string;
}

export interface TreasurySweepRecord {
  sweepId: string;
  sweepBatchRef: string;
  totalAmount: number;
  accrualCount: number;
  sourceTransitAccount: string;
  destinationAccount: string;
  initiatedBy: string;
  executedAt: string;
  status: "SUCCESS" | "PROCESSING";
}

const STORAGE_ACCRUALS_KEY = "zely_admin_fee_accruals";
const STORAGE_SCHEDULES_KEY = "zely_admin_fee_schedules";
const STORAGE_SWEEPS_KEY = "zely_admin_fee_sweeps";

const INITIAL_SCHEDULES: FeeSchedule[] = [
  {
    id: "fee_p2p_std",
    category: "P2P_TRANSFER",
    name: "Peer-to-Peer Transfer Fee",
    description:
      "Flat internal platform transfer processing fee debited from sender wallet",
    type: "FLAT",
    rate: "₦100.00 flat",
    rateValue: 100,
    unit: "NGN",
    active: true,
    waiverEligible: true,
    targetAccount: "sys_fees_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "fee_paystack_ingress",
    category: "PAYSTACK_INGRESS",
    name: "Card & Bank Funding Gateway Ingress",
    description:
      "Paystack payment card processing surcharge capped at ₦2,000 for standard accounts",
    type: "PERCENTAGE",
    rate: "1.5% (Capped at ₦2,000)",
    rateValue: 1.5,
    unit: "PERCENT",
    active: true,
    waiverEligible: false,
    targetAccount: "sys_gateway_rebate_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
  },
  {
    id: "fee_nip_switch",
    category: "NIP_INTERBANK",
    name: "NIBSS Instant Payment (NIP) Interbank Switch",
    description:
      "Tiered interbank clearing cost (₦10 under ₦5k, ₦25 under ₦50k, ₦50 above ₦50k)",
    type: "TIERED",
    rate: "₦10 – ₦50 Tiered",
    rateValue: 50,
    unit: "NGN",
    active: true,
    waiverEligible: false,
    targetAccount: "sys_fees_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
  },
  {
    id: "fee_stamp_duty",
    category: "STAMP_DUTY_ETL",
    name: "CBN Electronic Money Transfer Levy (EMTL)",
    description:
      "Mandatory statutory government levy on electronic inflows of ₦10,000 or greater",
    type: "STATUTORY",
    rate: "₦50.00 Statutory",
    rateValue: 50,
    unit: "NGN",
    active: true,
    waiverEligible: false,
    targetAccount: "sys_cbn_stamp_duty_escrow",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "fee_savings_break",
    category: "SAVINGS_BREAK_LOCK",
    name: "Early Vault Lock Liquidation Surcharge",
    description:
      "Penalty for breaking a fixed lock duration savings plan prior to target maturity",
    type: "PERCENTAGE",
    rate: "5.0% of Vault Principal",
    rateValue: 5.0,
    unit: "PERCENT",
    active: true,
    waiverEligible: true,
    targetAccount: "sys_savings_reserve_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
  {
    id: "fee_card_issuance",
    category: "CARD_ISSUANCE",
    name: "Virtual Dollar/Naira Mastercard Issuance",
    description:
      "One-off card minting and interbank card tokenization setup fee",
    type: "FLAT",
    rate: "₦1,500.00 ($2.00)",
    rateValue: 1500,
    unit: "NGN",
    active: true,
    waiverEligible: true,
    targetAccount: "sys_card_ops_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
  {
    id: "fee_sms_otp",
    category: "SMS_OTP_SURCHARGE",
    name: "Telco SMS Out-of-Band Notification Delivery",
    description:
      "Operator SMS delivery cost recovery for transaction threshold text notifications",
    type: "FLAT",
    rate: "₦4.00 per SMS",
    rateValue: 4,
    unit: "NGN",
    active: false,
    waiverEligible: true,
    targetAccount: "sys_telco_pass_pool",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
  },
];

const INITIAL_ACCRUALS: FeeAccrualRecord[] = [
  {
    accrualId: "ACCR-2026-9921",
    feeCategory: "P2P_TRANSFER",
    categoryLabel: "P2P Transfer Fee",
    amount: 100,
    currency: "NGN",
    originalTransactionRef: "TRF-NGN-20260928-110294",
    payerUserId: "usr_001_john",
    payerName: "John Doe",
    payerEmail: "john@example.com",
    sourceAccount: "wal_chk_01_ngn",
    transitPoolAccount: "sys_fees_pool",
    status: "ACCRUED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    notes: "Ledger debited standard P2P platform service fee.",
  },
  {
    accrualId: "ACCR-2026-9884",
    feeCategory: "PAYSTACK_INGRESS",
    categoryLabel: "Card Funding Fee",
    amount: 750,
    currency: "NGN",
    originalTransactionRef: "PAYSTACK-CHG-99214-SUCCESS",
    payerUserId: "usr_002_alice",
    payerName: "Alice Smith",
    payerEmail: "alice@company.com",
    sourceAccount: "pstk_chg_ingress",
    transitPoolAccount: "sys_gateway_rebate_pool",
    status: "ACCRUED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    notes: "1.5% fee on ₦50,000 wallet top-up via Paystack Mastercard.",
  },
  {
    accrualId: "ACCR-2026-9740",
    feeCategory: "STAMP_DUTY_ETL",
    categoryLabel: "CBN Stamp Duty (EMTL)",
    amount: 50,
    currency: "NGN",
    originalTransactionRef: "NIP-CR-20260928-882190",
    payerUserId: "usr_005_michael",
    payerName: "Michael Brown",
    payerEmail: "m.brown@corp.org",
    sourceAccount: "wal_chk_05_ngn",
    transitPoolAccount: "sys_cbn_stamp_duty_escrow",
    status: "ACCRUED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    notes:
      "Statutory EMTL levy for inward interbank transfer above ₦10,000 threshold.",
  },
  {
    accrualId: "ACCR-2026-9612",
    feeCategory: "NIP_INTERBANK",
    categoryLabel: "NIP Outbound Switch Fee",
    amount: 50,
    currency: "NGN",
    originalTransactionRef: "TRF-NGN-20260928-331002",
    payerUserId: "usr_006_sarah",
    payerName: "Sarah Connor",
    payerEmail: "sarah@skynet.com",
    sourceAccount: "wal_chk_06_ngn",
    transitPoolAccount: "sys_fees_pool",
    status: "ACCRUED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    notes: "Outward interbank transfer to GTBank account 0129482910.",
  },
  {
    accrualId: "ACCR-2026-9504",
    feeCategory: "SAVINGS_BREAK_LOCK",
    categoryLabel: "Early Vault Liquidation Fee",
    amount: 6000,
    currency: "NGN",
    originalTransactionRef: "VAULT-LIQ-20260927-4401",
    payerUserId: "usr_004_emma",
    payerName: "Emma Wilson",
    payerEmail: "emma.w@studio.io",
    sourceAccount: "vault_tgt_emma_q3",
    transitPoolAccount: "sys_savings_reserve_pool",
    status: "ACCRUED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    notes:
      "5% penalty fee assessed on ₦120,000 premature locked savings liquidation.",
  },
  {
    accrualId: "ACCR-2026-9411",
    feeCategory: "P2P_TRANSFER",
    categoryLabel: "P2P Transfer Fee",
    amount: 100,
    currency: "NGN",
    originalTransactionRef: "TRF-NGN-20260920-881920",
    reversalId: "REV-2026-9041",
    payerUserId: "usr_001_john",
    payerName: "John Doe",
    payerEmail: "john@example.com",
    sourceAccount: "wal_chk_01_ngn",
    transitPoolAccount: "sys_fees_pool",
    status: "REVERSED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 480).toISOString(),
    notes:
      "Transfer fee reversed and refunded to sender under reversal REV-2026-9041 (reverseFee=true).",
  },
  {
    accrualId: "ACCR-2026-9320",
    feeCategory: "CARD_ISSUANCE",
    categoryLabel: "Virtual Card Creation Fee",
    amount: 1500,
    currency: "NGN",
    originalTransactionRef: "CARD-ISSUE-20260926-8819",
    payerUserId: "usr_001_john",
    payerName: "John Doe",
    payerEmail: "john@example.com",
    sourceAccount: "wal_chk_01_ngn",
    transitPoolAccount: "sys_card_ops_pool",
    status: "SWEPT_TO_TREASURY",
    accruedAt: new Date(Date.now() - 1000 * 60 * 1200).toISOString(),
    sweptAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    sweepBatchRef: "SWEEP-BATCH-20260927-01",
    notes: "Virtual USD Mastercard token issuance.",
  },
  {
    accrualId: "ACCR-2026-9210",
    feeCategory: "P2P_TRANSFER",
    categoryLabel: "P2P Transfer Fee",
    amount: 100,
    currency: "NGN",
    originalTransactionRef: "TRF-NGN-20260926-440192",
    payerUserId: "usr_003_bob",
    payerName: "Bob Johnson",
    payerEmail: "bob.j@provider.net",
    sourceAccount: "wal_chk_03_ngn",
    transitPoolAccount: "sys_fees_pool",
    status: "SWEPT_TO_TREASURY",
    accruedAt: new Date(Date.now() - 1000 * 60 * 1500).toISOString(),
    sweptAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    sweepBatchRef: "SWEEP-BATCH-20260927-01",
    notes: "Internal P2P transfer settled and swept.",
  },
  {
    accrualId: "ACCR-2026-9115",
    feeCategory: "PAYSTACK_INGRESS",
    categoryLabel: "Card Funding Fee",
    amount: 1500,
    currency: "NGN",
    originalTransactionRef: "PAYSTACK-CHG-88190-SUCCESS",
    payerUserId: "usr_005_michael",
    payerName: "Michael Brown",
    payerEmail: "m.brown@corp.org",
    sourceAccount: "pstk_chg_ingress",
    transitPoolAccount: "sys_gateway_rebate_pool",
    status: "SWEPT_TO_TREASURY",
    accruedAt: new Date(Date.now() - 1000 * 60 * 1800).toISOString(),
    sweptAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    sweepBatchRef: "SWEEP-BATCH-20260927-01",
    notes: "1.5% fee on ₦100,000 top up.",
  },
  {
    accrualId: "ACCR-2026-9008",
    feeCategory: "P2P_TRANSFER",
    categoryLabel: "P2P Transfer Fee",
    amount: 100,
    currency: "NGN",
    originalTransactionRef: "TRF-NGN-20260925-771920",
    payerUserId: "usr_006_sarah",
    payerName: "Sarah Connor",
    payerEmail: "sarah@skynet.com",
    sourceAccount: "wal_chk_06_ngn",
    transitPoolAccount: "sys_fees_pool",
    status: "WAIVED",
    accruedAt: new Date(Date.now() - 1000 * 60 * 2400).toISOString(),
    notes: "Waived under Tier 3 promotional zero-fee campaign.",
  },
];

const INITIAL_SWEEPS: TreasurySweepRecord[] = [
  {
    sweepId: "SWP-001",
    sweepBatchRef: "SWEEP-BATCH-20260927-01",
    totalAmount: 184500,
    accrualCount: 42,
    sourceTransitAccount: "sys_fees_pool",
    destinationAccount: "sys_treasury_revenue_vault",
    initiatedBy: "System Auto-Sweep Cron",
    executedAt: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    status: "SUCCESS",
  },
  {
    sweepId: "SWP-002",
    sweepBatchRef: "SWEEP-BATCH-20260920-01",
    totalAmount: 312000,
    accrualCount: 78,
    sourceTransitAccount: "sys_fees_pool",
    destinationAccount: "sys_treasury_revenue_vault",
    initiatedBy: "Alice Smith (Lead Compliance)",
    executedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    status: "SUCCESS",
  },
];

const loadAccruals = (): FeeAccrualRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_ACCRUALS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse fee accruals", e);
  }
  localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(INITIAL_ACCRUALS));
  return INITIAL_ACCRUALS;
};

const saveAccruals = (data: FeeAccrualRecord[]) => {
  try {
    localStorage.setItem(STORAGE_ACCRUALS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save fee accruals", e);
  }
};

const loadSchedules = (): FeeSchedule[] => {
  try {
    const raw = localStorage.getItem(STORAGE_SCHEDULES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse fee schedules", e);
  }
  localStorage.setItem(
    STORAGE_SCHEDULES_KEY,
    JSON.stringify(INITIAL_SCHEDULES),
  );
  return INITIAL_SCHEDULES;
};

const saveSchedules = (data: FeeSchedule[]) => {
  try {
    localStorage.setItem(STORAGE_SCHEDULES_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save fee schedules", e);
  }
};

const loadSweeps = (): TreasurySweepRecord[] => {
  try {
    const raw = localStorage.getItem(STORAGE_SWEEPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Failed to parse fee sweeps", e);
  }
  localStorage.setItem(STORAGE_SWEEPS_KEY, JSON.stringify(INITIAL_SWEEPS));
  return INITIAL_SWEEPS;
};

const saveSweeps = (data: TreasurySweepRecord[]) => {
  try {
    localStorage.setItem(STORAGE_SWEEPS_KEY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save fee sweeps", e);
  }
};

export const feeService = {
  /**
   * Get all fee accruals with optional filtering
   */
  getAccruals: async (filters?: {
    category?: string;
    status?: string;
    search?: string;
  }): Promise<FeeAccrualRecord[]> => {
    try {
      const res = await axiosPrivate.get("/admin/fees/accruals", {
        params: filters,
      });
      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch (e) {
      // fallback
    }

    let records = loadAccruals();

    if (filters) {
      if (filters.category && filters.category !== "ALL") {
        records = records.filter((r) => r.feeCategory === filters.category);
      }
      if (filters.status && filters.status !== "ALL") {
        records = records.filter((r) => r.status === filters.status);
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        records = records.filter(
          (r) =>
            r.accrualId.toLowerCase().includes(q) ||
            r.originalTransactionRef.toLowerCase().includes(q) ||
            r.payerName.toLowerCase().includes(q) ||
            r.payerEmail.toLowerCase().includes(q) ||
            r.payerUserId.toLowerCase().includes(q) ||
            r.categoryLabel.toLowerCase().includes(q) ||
            r.sourceAccount.toLowerCase().includes(q),
        );
      }
    }

    return records;
  },

  /**
   * Get all active system fee schedules
   */
  getSchedules: async (): Promise<FeeSchedule[]> => {
    try {
      const res = await axiosPrivate.get("/admin/fees/schedules");
      if (res.data?.data && Array.isArray(res.data.data)) {
        return res.data.data;
      }
    } catch (e) {
      // fallback
    }
    return loadSchedules();
  },

  /**
   * Update a fee schedule configuration
   */
  updateSchedule: async (
    id: string,
    updates: Partial<FeeSchedule>,
  ): Promise<FeeSchedule> => {
    try {
      const res = await axiosPrivate.put(
        `/admin/fees/schedules/${id}`,
        updates,
      );
      if (res.data?.data) {
        return res.data.data;
      }
    } catch (e) {
      // fallback
    }

    const schedules = loadSchedules();
    const idx = schedules.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Fee schedule not found");

    const updated = {
      ...schedules[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    schedules[idx] = updated;
    saveSchedules(schedules);
    return updated;
  },

  /**
   * Sweep accrued fees in sys_fees_pool into platform revenue treasury
   */
  sweepAccruals: async (
    adminName = "Alice Smith (Lead Compliance)",
  ): Promise<{
    success: boolean;
    sweptAmount: number;
    sweptCount: number;
    batchRef: string;
  }> => {
    const accruals = loadAccruals();
    const pending = accruals.filter((a) => a.status === "ACCRUED");

    if (pending.length === 0) {
      throw new Error("No pending fee accruals available to sweep.");
    }

    const sweptAmount = pending.reduce((sum, item) => sum + item.amount, 0);
    const batchRef = `SWEEP-BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}`;

    const updatedAccruals = accruals.map((item) => {
      if (item.status === "ACCRUED") {
        return {
          ...item,
          status: "SWEPT_TO_TREASURY" as FeeAccrualStatus,
          sweptAt: new Date().toISOString(),
          sweepBatchRef: batchRef,
        };
      }
      return item;
    });

    saveAccruals(updatedAccruals);

    // Save sweep record
    const sweeps = loadSweeps();
    const newSweep: TreasurySweepRecord = {
      sweepId: `SWP-${Math.floor(1000 + Math.random() * 9000)}`,
      sweepBatchRef: batchRef,
      totalAmount: sweptAmount,
      accrualCount: pending.length,
      sourceTransitAccount: "sys_fees_pool",
      destinationAccount: "sys_treasury_revenue_vault",
      initiatedBy: adminName,
      executedAt: new Date().toISOString(),
      status: "SUCCESS",
    };
    saveSweeps([newSweep, ...sweeps]);

    return {
      success: true,
      sweptAmount,
      sweptCount: pending.length,
      batchRef,
    };
  },

  /**
   * Waive a specific fee accrual
   */
  waiveAccrual: async (
    accrualId: string,
    notes: string,
  ): Promise<FeeAccrualRecord> => {
    const accruals = loadAccruals();
    const idx = accruals.findIndex((a) => a.accrualId === accrualId);
    if (idx === -1) throw new Error("Fee accrual record not found");

    const updated = {
      ...accruals[idx],
      status: "WAIVED" as FeeAccrualStatus,
      notes: notes || "Waived by administrative override",
    };
    accruals[idx] = updated;
    saveAccruals(accruals);
    return updated;
  },

  /**
   * Get sweep history
   */
  getSweeps: async (): Promise<TreasurySweepRecord[]> => {
    return loadSweeps();
  },

  /**
   * Get aggregate metrics
   */
  getFeeMetrics: async () => {
    const accruals = loadAccruals();
    const totalAccrued = accruals.reduce((sum, item) => sum + item.amount, 0);
    const pendingInTransit = accruals
      .filter((a) => a.status === "ACCRUED")
      .reduce((sum, item) => sum + item.amount, 0);
    const realizedSwept = accruals
      .filter((a) => a.status === "SWEPT_TO_TREASURY")
      .reduce((sum, item) => sum + item.amount, 0);
    const reversedOrWaived = accruals
      .filter((a) => a.status === "REVERSED" || a.status === "WAIVED")
      .reduce((sum, item) => sum + item.amount, 0);

    return {
      totalAccrued,
      pendingInTransit,
      realizedSwept,
      reversedOrWaived,
      totalCount: accruals.length,
      pendingCount: accruals.filter((a) => a.status === "ACCRUED").length,
    };
  },
};

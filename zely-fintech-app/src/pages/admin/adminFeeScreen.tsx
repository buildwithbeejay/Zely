import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  RefreshCw,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Sliders,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Loader2,
  FileText,
  Zap,
  Layers,
  Building,
  Wallet,
  Settings,
  HelpCircle,
  TrendingUp,
  Tag,
  Ban,
  ArrowRight,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { FeeAccrualRecord, FeeAccrualStatus, FeeCategory, FeeSchedule, feeService, TreasurySweepRecord } from "@/services/feeService";

export const AdminFeesScreen: React.FC = () => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<
    "accruals" | "schedules" | "sweeps"
  >("accruals");
  const [accruals, setAccruals] = useState<FeeAccrualRecord[]>([]);
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [sweeps, setSweeps] = useState<TreasurySweepRecord[]>([]);
  const [metrics, setMetrics] = useState({
    totalAccrued: 0,
    pendingInTransit: 0,
    realizedSwept: 0,
    reversedOrWaived: 0,
    totalCount: 0,
    pendingCount: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isSweeping, setIsSweeping] = useState(false);
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | FeeCategory>(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<"ALL" | FeeAccrualStatus>(
    "ALL",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination for accruals
  const [visibleCount, setVisibleCount] = useState(15);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Edit Schedule Modal
  const [editingSchedule, setEditingSchedule] = useState<FeeSchedule | null>(
    null,
  );
  const [editRate, setEditRate] = useState("");
  const [editActive, setEditActive] = useState(true);

  // Load data
  const loadAll = async () => {
    setLoading(true);
    try {
      const [accrualsData, schedulesData, sweepsData, metricsData] =
        await Promise.all([
          feeService.getAccruals(),
          feeService.getSchedules(),
          feeService.getSweeps(),
          feeService.getFeeMetrics(),
        ]);
      setAccruals(accrualsData);
      setSchedules(schedulesData);
      setSweeps(sweepsData);
      setMetrics(metricsData);
    } catch (err: any) {
      showToast("error", "Failed to load system fee records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Filtered accruals
  const filteredAccruals = useMemo(() => {
    return accruals.filter((item) => {
      if (categoryFilter !== "ALL" && item.feeCategory !== categoryFilter) {
        return false;
      }
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.accrualId.toLowerCase().includes(q) ||
          item.originalTransactionRef.toLowerCase().includes(q) ||
          item.payerName.toLowerCase().includes(q) ||
          item.payerEmail.toLowerCase().includes(q) ||
          item.payerUserId.toLowerCase().includes(q) ||
          item.categoryLabel.toLowerCase().includes(q) ||
          item.sourceAccount.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [accruals, categoryFilter, statusFilter, searchQuery]);

  const displayedAccruals = useMemo(() => {
    return filteredAccruals.slice(0, visibleCount);
  }, [filteredAccruals, visibleCount]);

  const handleShowMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 15);
      setIsLoadingMore(false);
    }, 400);
  };

  const handleSweepToTreasury = async () => {
    setIsSweeping(true);
    try {
      const res = await feeService.sweepAccruals();
      showToast(
        "success",
        `₦${res.sweptAmount.toLocaleString("en-NG")} swept into Treasury Vault (${res.batchRef})`,
      );
      setIsSweepModalOpen(false);
      await loadAll();
    } catch (err: any) {
      showToast("error", err.message || "Failed to sweep fee accruals");
    } finally {
      setIsSweeping(false);
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;

    try {
      await feeService.updateSchedule(editingSchedule.id, {
        rate: editRate,
        active: editActive,
      });
      showToast(
        "success",
        `Fee schedule "${editingSchedule.name}" updated successfully`,
      );
      setEditingSchedule(null);
      await loadAll();
    } catch (err: any) {
      showToast("error", "Failed to update fee schedule");
    }
  };

  const handleExportCSV = () => {
    if (filteredAccruals.length === 0) return;
    const headers = [
      "Accrual ID",
      "Fee Category",
      "Amount (NGN)",
      "Status",
      "Payer",
      "Original Tx Ref",
      "Transit Pool",
      "Accrued At",
      "Notes",
    ];
    const rows = filteredAccruals.map((a) => [
      `"${a.accrualId}"`,
      `"${a.categoryLabel}"`,
      `"${a.amount}"`,
      `"${a.status}"`,
      `"${a.payerName} (${a.payerUserId})"`,
      `"${a.originalTransactionRef}"`,
      `"${a.transitPoolAccount}"`,
      `"${new Date(a.accruedAt).toISOString()}"`,
      `"${(a.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_fee_accruals_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatNaira = (amt: number) => {
    return `₦${amt.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: FeeAccrualStatus) => {
    switch (status) {
      case "ACCRUED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            Accrued (In Transit)
          </span>
        );
      case "SWEPT_TO_TREASURY":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Swept To Treasury
          </span>
        );
      case "REVERSED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <RotateCcw className="w-3 h-3 text-rose-600" />
            Fee Reversed
          </span>
        );
      case "WAIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Ban className="w-3 h-3 text-slate-500" />
            Waived
          </span>
        );
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[#7C3AED]">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                System Fee Accruals & Schedules
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Central ledger accounting for transaction fee accruals in{" "}
                <code className="font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-1 py-0.5 rounded">
                  sys_fees_pool
                </code>
                , statutory levies, and platform fee rate schedules.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/admin/reversals"
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-purple-600" />
            <span>Reversals Desk</span>
          </Link>

          <button
            onClick={() => setIsSweepModalOpen(true)}
            disabled={metrics.pendingCount === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50 hover:shadow"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Sweep Accruals to Treasury ({metrics.pendingCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Accruals */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Gross Fee Accruals
            </span>
            <Coins className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white">
            {formatNaira(metrics.totalAccrued)}
          </p>
          <p className="text-[11px] text-slate-500">
            {metrics.totalCount} ledger fee entries recorded
          </p>
        </div>

        {/* Card 2: Pending in Transit Pool */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/20 dark:bg-amber-950/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
              Unswept in sys_fees_pool
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {formatNaira(metrics.pendingInTransit)}
          </p>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
            {metrics.pendingCount} pending vault settlement sweep
          </p>
        </div>

        {/* Card 3: Realized Swept Revenue */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
              Swept To Treasury Vault
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {formatNaira(metrics.realizedSwept)}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
            Realized operational revenue
          </p>
        </div>

        {/* Card 4: Reversed / Waived */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Reversed & Waived
            </span>
            <RotateCcw className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {formatNaira(metrics.reversedOrWaived)}
          </p>
          <p className="text-[11px] text-slate-500">
            Clawed back or promotional waivers
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-6 text-sm">
        <button
          onClick={() => setActiveTab("accruals")}
          className={`pb-3 font-bold transition-all relative flex items-center gap-2 ${
            activeTab === "accruals"
              ? "text-[#7C3AED] border-b-2 border-[#7C3AED]"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Fee Accruals Ledger ({accruals.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("schedules")}
          className={`pb-3 font-bold transition-all relative flex items-center gap-2 ${
            activeTab === "schedules"
              ? "text-[#7C3AED] border-b-2 border-[#7C3AED]"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>System Fee Schedules & Configuration ({schedules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("sweeps")}
          className={`pb-3 font-bold transition-all relative flex items-center gap-2 ${
            activeTab === "sweeps"
              ? "text-[#7C3AED] border-b-2 border-[#7C3AED]"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Treasury Sweep Runs ({sweeps.length})</span>
        </button>
      </div>

      {/* TAB 1: FEE ACCRUALS LEDGER */}
      {activeTab === "accruals" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by accrual ID, transaction ref, payer name, user ID..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                />
              </div>

              {/* Dropdowns */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Category Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Category:
                  </span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="P2P_TRANSFER">P2P Transfer Fees</option>
                    <option value="PAYSTACK_INGRESS">
                      Paystack Gateway Ingress
                    </option>
                    <option value="NIP_INTERBANK">
                      NIP Interbank Outbound
                    </option>
                    <option value="STAMP_DUTY_ETL">CBN Stamp Duty EMTL</option>
                    <option value="SAVINGS_BREAK_LOCK">
                      Early Savings Break
                    </option>
                    <option value="CARD_ISSUANCE">Virtual Card Issuance</option>
                  </select>
                </div>

                {/* Status Dropdown */}
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Status:
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="ACCRUED">Accrued (Pending)</option>
                    <option value="SWEPT_TO_TREASURY">Swept to Treasury</option>
                    <option value="REVERSED">Reversed</option>
                    <option value="WAIVED">Waived</option>
                  </select>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Accruals Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
                <p className="text-xs font-semibold">
                  Loading fee accrual ledger...
                </p>
              </div>
            ) : filteredAccruals.length === 0 ? (
              <div className="py-16 text-center text-slate-500 space-y-2">
                <Coins className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No fee accruals match filter criteria
                </p>
                <p className="text-xs text-slate-400">
                  Try changing the category or status filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3.5 px-4">Accrual ID</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Fee Amount</th>
                      <th className="py-3.5 px-4">Payer / Source</th>
                      <th className="py-3.5 px-4">Original Transaction Ref</th>
                      <th className="py-3.5 px-4">Transit Account</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Accrued At</th>
                      <th className="py-3.5 px-4 text-right">
                        Audit / Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {displayedAccruals.map((item) => (
                      <tr
                        key={item.accrualId}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Accrual ID */}
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {item.accrualId}
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                            {item.categoryLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.feeCategory}
                          </span>
                        </td>

                        {/* Fee Amount */}
                        <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {formatNaira(item.amount)}
                        </td>

                        {/* Payer */}
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-slate-800 dark:text-slate-200 block truncate max-w-[150px]">
                            {item.payerName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.payerUserId}
                          </span>
                        </td>

                        {/* Original Tx Ref */}
                        <td
                          className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-[170px] truncate"
                          title={item.originalTransactionRef}
                        >
                          <Link
                            to={`/admin/transactions?search=${encodeURIComponent(item.originalTransactionRef)}`}
                            className="hover:text-[#7C3AED] hover:underline"
                          >
                            {item.originalTransactionRef}
                          </Link>
                          {item.reversalId && (
                            <Link
                              to={`/admin/reversals/${item.reversalId}`}
                              className="block text-[10px] font-bold text-rose-600 hover:underline mt-0.5"
                            >
                              ↩ Linked {item.reversalId}
                            </Link>
                          )}
                        </td>

                        {/* Transit Account */}
                        <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 whitespace-nowrap">
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {item.transitPoolAccount}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {getStatusBadge(item.status)}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                          {new Date(item.accruedAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          {item.status === "ACCRUED" ? (
                            <button
                              onClick={async () => {
                                const reason = prompt(
                                  "Enter justification for waiving this fee:",
                                );
                                if (reason) {
                                  await feeService.waiveAccrual(
                                    item.accrualId,
                                    reason,
                                  );
                                  showToast(
                                    "success",
                                    `Fee ${item.accrualId} waived.`,
                                  );
                                  loadAll();
                                }
                              }}
                              className="text-[10px] font-bold text-slate-500 hover:text-rose-600 transition-colors"
                            >
                              Waive Fee
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.sweepBatchRef
                                ? item.sweepBatchRef.slice(0, 14) + "..."
                                : "Audited"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && filteredAccruals.length > 0 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
                <span className="text-xs text-slate-500 font-medium">
                  Showing{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {Math.min(visibleCount, filteredAccruals.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {filteredAccruals.length}
                  </span>{" "}
                  fee accruals
                </span>

                {visibleCount < filteredAccruals.length && (
                  <button
                    onClick={handleShowMore}
                    disabled={isLoadingMore}
                    className="flex items-center gap-2 px-5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm disabled:opacity-50"
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#7C3AED]" />
                        <span>Loading...</span>
                      </>
                    ) : (
                      <>
                        <span>Show More</span>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SYSTEM FEE SCHEDULES & CONFIGURATION ("OTHER FEES IN THE SYSTEM") */}
      {activeTab === "schedules" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#7C3AED]" />
                  Active Platform Fee Rates & Schedules
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Complete rules determining transaction surcharges, gateway
                  ingress fees, statutory ETL levies, and early liquidation
                  penalties.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {schedules.map((sched) => (
                <div
                  key={sched.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    sched.active
                      ? "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#7C3AED]/50 shadow-sm"
                      : "border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded">
                      {sched.type}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        sched.active
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {sched.active ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                    {sched.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {sched.description}
                  </p>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Current Rate:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-sm text-[#7C3AED]">
                        {sched.rate}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Settlement Target:</span>
                      <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300">
                        {sched.targetAccount}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Waiver Eligible:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {sched.waiverEligible
                          ? "Yes (Admin Override)"
                          : "No (Statutory/Pass-thru)"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingSchedule(sched);
                      setEditRate(sched.rate);
                      setEditActive(sched.active);
                    }}
                    className="w-full mt-4 py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 hover:text-[#7C3AED] dark:hover:bg-purple-950/40 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configure Rate
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TREASURY SWEEP HISTORY */}
      {activeTab === "sweeps" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building className="w-4 h-4 text-[#7C3AED]" />
                Treasury Sweep Audit Runs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Permanent ledger sweeps clearing accrued fees from transit
                buffer{" "}
                <code className="font-mono text-purple-600">sys_fees_pool</code>{" "}
                into the platform revenue treasury master vault.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Sweep Run ID</th>
                    <th className="py-3 px-4">Batch Reference</th>
                    <th className="py-3 px-4">Total Amount Swept</th>
                    <th className="py-3 px-4">Accruals Bundled</th>
                    <th className="py-3 px-4">Source Transit</th>
                    <th className="py-3 px-4">Destination Vault</th>
                    <th className="py-3 px-4">Initiated By</th>
                    <th className="py-3 px-4">Executed At</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {sweeps.map((swp) => (
                    <tr
                      key={swp.sweepId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {swp.sweepId}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                        {swp.sweepBatchRef}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatNaira(swp.totalAmount)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        {swp.accrualCount} items
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                        {swp.sourceTransitAccount}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500">
                        {swp.destinationAccount}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        {swp.initiatedBy}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {new Date(swp.executedAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SUCCESS
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SWEEP TO TREASURY CONFIRMATION MODAL */}
      {isSweepModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-[#7C3AED]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Sweep Accrued Fees to Treasury Vault
                </h3>
                <p className="text-xs text-slate-500">
                  Transfer buffered platform revenue from{" "}
                  <code className="font-mono">sys_fees_pool</code>
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Pending Accruals:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {metrics.pendingCount} records
                </span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-900 dark:text-white">
                  Total Amount to Sweep:
                </span>
                <span className="font-mono font-bold text-emerald-600 text-base">
                  {formatNaira(metrics.pendingInTransit)}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              This will mark all {metrics.pendingCount} pending fee records as{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                SWEPT_TO_TREASURY
              </strong>
              , generate a cryptographic sweep batch identifier, and credit the
              master platform revenue vault.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsSweepModalOpen(false)}
                disabled={isSweeping}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSweepToTreasury}
                disabled={isSweeping}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                {isSweeping && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Confirm & Sweep Revenue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT FEE SCHEDULE MODAL */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden p-6 space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase text-purple-600">
                {editingSchedule.category}
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                Configure {editingSchedule.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {editingSchedule.description}
              </p>
            </div>

            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Fee Rate / Formula
                </label>
                <input
                  type="text"
                  value={editRate}
                  onChange={(e) => setEditRate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Format: e.g. "₦100.00 flat", "1.5% (Capped at ₦2,000)", "5.0%"
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Active Status
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Enable or disable this fee schedule across the app
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFeesScreen;

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ServerCrash,
  CheckCircle2,
  ChevronRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  ShieldAlert,
  TrendingDown,
  XCircle,
  RotateCcw,
  Loader2,
  Settings,
  Clock,
  Search,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import CustomSelect from "../../components/common/CustomSelect";
import {
  reconciliationService,
  ReconReport,
  ReconSummary,
  SystemInvariantResult,
} from "@/services/reconciliation.service";
import PaystackReconPanel from "@/components/PaystackReconPanel";

export const formatRelativeTime = (dateString: string) => {
  if (!dateString) return "-";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const elapsed = new Date(dateString).getTime() - Date.now();
  const min = Math.round(elapsed / (1000 * 60));
  const hours = Math.round(elapsed / (1000 * 60 * 60));
  const days = Math.round(elapsed / (1000 * 60 * 60 * 24));
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(days, "day");
};

const formatNaira = (n: number) =>
  `₦${Math.abs(n).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

type TabKey = "overview" | "discrepancies" | "reports" | "setup";

const AdminReconciliationScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [reports, setReports] = useState<ReconReport[]>([]);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [invariant, setInvariant] = useState<SystemInvariantResult | null>(
    null,
  );
  const [invariantLoading, setInvariantLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [triggerFilter, setTriggerFilter] = useState<string>("ALL");
  const [onlyWithDrifts, setOnlyWithDrifts] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [driftSearch, setDriftSearch] = useState("");

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const data = await reconciliationService.getSummary();
      setSummary(data);
    } catch {
      showToast("error", "Failed to load reconciliation summary");
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await reconciliationService.getReports({
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        triggeredBy: triggerFilter !== "ALL" ? triggerFilter : undefined,
        onlyWithDrifts: onlyWithDrifts || undefined,
        limit: 50,
      });
      setReports(data);
    } catch {
      showToast("error", "Failed to load reconciliation reports");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, triggerFilter, onlyWithDrifts]);

  const fetchInvariant = useCallback(async () => {
    setInvariantLoading(true);
    try {
      const data = await reconciliationService.checkSystemInvariant();
      setInvariant(data);
    } catch {
      showToast("error", "Failed to run invariant check");
    } finally {
      setInvariantLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);
  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  useEffect(() => {
    if (activeTab === "discrepancies" && !invariant) {
      fetchInvariant();
    }
  }, [activeTab]);

  const handleRunNow = async () => {
    setIsRunning(true);
    try {
      const newRun = await reconciliationService.runReconciliation();
      setReports((prev) => [newRun, ...prev]);
      await fetchSummary();
      showToast(
        "success",
        `Reconciliation completed — ${newRun.driftsFound} drift(s) found`,
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.message ?? "Failed to start reconciliation run",
      );
    } finally {
      setIsRunning(false);
    }
  };

  const filteredReports = reports.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  const filteredDrifts = (invariant?.driftedWallets ?? []).filter((w: any) =>
    driftSearch
      ? w.walletId?.toLowerCase().includes(driftSearch.toLowerCase())
      : true,
  );

  const TABS: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "discrepancies", label: "User Discrepancies" },
    { key: "reports", label: "Reports" },
    { key: "setup", label: "Setup & Jobs" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h3 className="text-xl font-bold mb-2">System Reconciliation</h3>
          <p className="text-slate-500 text-sm">
            Monitor internal ledger consistency, drifts, and collection actions.
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={isRunning}
          className="shrink-0 px-5 py-3 bg-primary hover:bg-primary-light text-white rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary/30 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Running..." : "Run Reconciliation Now"}
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-fit overflow-x-auto shadow-inner">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                Negative Balances
              </span>
              <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  (summary?.negativeBalanceCount ?? 0)
                )}
              </p>
              <p className="text-[11px] text-slate-500">Wallets below zero</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                Frozen Wallets
              </span>
              <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  (summary?.frozenWalletCount ?? 0)
                )}
              </p>
              <p className="text-[11px] text-slate-500">Pending collection</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-rose-500" />
                Failed Reversals
              </span>
              <p className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  (summary?.failedReversalCount ?? 0)
                )}
              </p>
              <p className="text-[11px] text-slate-500">Needs retry</p>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-purple-500" />
                Open Drifts
              </span>
              <p className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
                {summaryLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  (summary?.openDriftCount ?? 0)
                )}
              </p>
              <p className="text-[11px] text-slate-500">
                Unresolved ledger drifts
              </p>
            </div>
          </div>

          {/* Last Run Banner */}
          {summary?.lastRun && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Last run:{" "}
                    <span className="font-mono">{summary.lastRun.runId}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {formatRelativeTime(
                      summary.lastRun.finishedAt ?? summary.lastRun.startedAt,
                    )}{" "}
                    · {summary.lastRun.accountsChecked.toLocaleString()}{" "}
                    accounts · {summary.lastRun.driftsFound} drift(s) ·{" "}
                    {summary.lastRun.triggeredBy}
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  navigate(`/admin/reconciliation/${summary.lastRun!.runId}`)
                }
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                View Report <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => navigate("/admin/reversals?status=FAILED")}
              className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800 shadow-sm flex items-center gap-3 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors text-left"
            >
              <RotateCcw className="w-5 h-5 text-rose-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  Failed Reversals
                </p>
                <p className="text-[11px] text-slate-500">
                  View and retry failed reversal attempts
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
            </button>

            <button
              onClick={() => setActiveTab("discrepancies")}
              className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm flex items-center gap-3 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-colors text-left"
            >
              <Activity className="w-5 h-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  System Invariant Check
                </p>
                <p className="text-[11px] text-slate-500">
                  Verify total wallet balance equals total ledger net
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
            </button>
          </div>
        </div>
      )}

      {/* ── USER DISCREPANCIES TAB ── */}
      {activeTab === "discrepancies" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Wallet vs Ledger Discrepancies
              </h4>
              <p className="text-[11px] text-slate-500">
                Wallets where cached balance doesn't match the true ledger
                balance
              </p>
            </div>
            <button
              onClick={fetchInvariant}
              disabled={invariantLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {invariantLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Re-run Check
            </button>
          </div>

          {/* Invariant Summary */}
          {invariant && (
            <div
              className={`p-4 rounded-xl border shadow-sm flex items-center justify-between gap-4 ${
                invariant.isBalanced
                  ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                  : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
              }`}
            >
              <div className="flex items-center gap-3">
                {invariant.isBalanced ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <div>
                  <p
                    className={`text-xs font-bold ${invariant.isBalanced ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}
                  >
                    {invariant.isBalanced
                      ? "System invariant holds — all balances match"
                      : `Invariant breach — drift of ${formatNaira(invariant.invariantDrift)}`}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Total wallet: {formatNaira(invariant.totalWalletBalance)} ·
                    Total ledger net: {formatNaira(invariant.totalLedgerNet)} ·
                    Checked {new Date(invariant.checkedAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2 py-1 rounded-lg ${
                  invariant.isBalanced
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30"
                }`}
              >
                {invariant.driftedWallets.length} drifted
              </span>
            </div>
          )}

          {invariantLoading && (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          )}

          {!invariantLoading &&
            invariant &&
            invariant.driftedWallets.length > 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Drifted Wallets ({invariant.driftedWallets.length})
                  </span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={driftSearch}
                      onChange={(e) => setDriftSearch(e.target.value)}
                      placeholder="Search wallet ID..."
                      className="pl-8 pr-4 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                        <th className="px-4 py-3">Wallet ID</th>
                        <th className="px-4 py-3 text-right">Stored Balance</th>
                        <th className="px-4 py-3 text-right">Ledger Net</th>
                        <th className="px-4 py-3 text-right">Drift</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                      {filteredDrifts.map((w: any, i: number) => (
                        <tr
                          key={i}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400">
                            {w.walletId}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatNaira(w.storedBalance)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                            {formatNaira(w.ledgerNet)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-mono font-bold ${w.drift > 0 ? "text-red-600" : "text-amber-600"}`}
                          >
                            {w.drift > 0 ? "+" : ""}
                            {formatNaira(w.drift)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                w.drift > 0
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30"
                              }`}
                            >
                              {w.drift > 0 ? "OVERSTATED" : "UNDERSTATED"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() =>
                                navigate(`/admin/users?search=${w.walletId}`)
                              }
                              className="text-[11px] font-bold text-primary hover:underline"
                            >
                              Investigate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          {!invariantLoading &&
            invariant &&
            invariant.driftedWallets.length === 0 && (
              <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  All wallets in sync
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  No discrepancies detected.
                </p>
              </div>
            )}

          {!invariantLoading && !invariant && (
            <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <Activity className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                No check run yet
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click "Re-run Check" to scan for discrepancies.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── REPORTS TAB ── */}
      {activeTab === "reports" && (
        <div className="space-y-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/10">
              <div className="flex items-center gap-2">
                <Filter className="w-5 h-5 text-slate-400" />
                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">
                  Past Reconciliation Runs
                </span>
              </div>
              <div className="flex flex-nowrap gap-4 items-center overflow-x-auto pb-2 sm:pb-0">
                <div className="w-40">
                  <CustomSelect
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All Statuses" },
                      { value: "COMPLETED", label: "Completed" },
                      { value: "RUNNING", label: "Running" },
                      { value: "FAILED", label: "Failed" },
                    ]}
                  />
                </div>
                <div className="w-40">
                  <CustomSelect
                    value={triggerFilter}
                    onChange={setTriggerFilter}
                    options={[
                      { value: "ALL", label: "All Triggers" },
                      { value: "SCHEDULED", label: "Scheduled" },
                      { value: "MANUAL", label: "Manual" },
                    ]}
                  />
                </div>
                <label className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-3 rounded-xl shadow-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-800">
                  <input
                    type="checkbox"
                    checked={onlyWithDrifts}
                    onChange={(e) => setOnlyWithDrifts(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-slate-300 dark:border-slate-600 focus:ring-primary dark:bg-slate-700"
                  />
                  <span className="text-sm font-semibold whitespace-nowrap">
                    Only with drifts
                  </span>
                </label>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs uppercase tracking-widest text-slate-400 font-black border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Run ID & Time</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Trigger</th>
                    <th className="px-6 py-4 text-right">
                      Accounts / Duration
                    </th>
                    <th className="px-6 py-4 text-center">Drifts Found</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-sm">
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
                      </td>
                    </tr>
                  )}
                  {!isLoading &&
                    filteredReports.map((report) => (
                      <tr
                        key={report.runId}
                        onClick={() =>
                          navigate(`/admin/reconciliation/${report.runId}`)
                        }
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors font-mono text-xs">
                            {report.runId}
                          </div>
                          <div
                            className="text-xs text-slate-500 font-medium"
                            title={new Date(report.startedAt).toLocaleString()}
                          >
                            {formatRelativeTime(report.startedAt)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold leading-none ${
                              report.status === "COMPLETED"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30"
                                : report.status === "RUNNING"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 animate-pulse"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30"
                            }`}
                          >
                            {report.status === "COMPLETED" && (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            {report.status === "RUNNING" && (
                              <Activity className="w-3 h-3" />
                            )}
                            {report.status === "FAILED" && (
                              <ServerCrash className="w-3 h-3" />
                            )}
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wider uppercase">
                            {report.triggeredBy}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {report.accountsChecked.toLocaleString()}
                          </div>
                          <div className="text-xs text-slate-500">
                            {report.durationMs > 0
                              ? `${(report.durationMs / 1000).toFixed(1)}s`
                              : "-"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {report.driftsFound > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 rounded-lg text-xs font-black shadow-sm ring-1 ring-red-200 dark:ring-red-800/50">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {report.driftsFound}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium text-xs">
                              0
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors inline-block" />
                        </td>
                      </tr>
                    ))}
                  {!isLoading && filteredReports.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        No reconciliation reports match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── SETUP & JOBS TAB ── */}
      {activeTab === "setup" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Scheduled Jobs
              </h3>
            </div>
            <div className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Hourly Reconciliation
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Runs every hour via BullMQ cron
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                  ACTIVE
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Drift Escalation Check
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Daily at 9am — escalates drifts older than 7 days
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
                  ACTIVE
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    Paystack Settlement Recon
                  </p>
                  <p className="text-slate-500 mt-0.5">
                    Manual trigger via admin panel
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  MANUAL
                </span>
              </div>
            </div>

            <PaystackReconPanel />
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Configuration
              </h3>
            </div>
            <div className="space-y-4 text-xs text-slate-500">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Drift Threshold
                </p>
                <p>₦0 — any discrepancy is flagged, no tolerance</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Freeze on Drift
                </p>
                <p>
                  Enabled — overstated wallets are auto-frozen pending review
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Batch Size
                </p>
                <p>100 accounts per batch — streamed via cursor to avoid OOM</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
                <p className="font-bold text-slate-900 dark:text-white">
                  Escalation Window
                </p>
                <p>7 days — unresolved drifts escalate after this period</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReconciliationScreen;

import { StatusBadge } from "@/components/statusBadge";
import { useToast } from "@/context/ToastContext";
import {
  adminDashboardService,
  FeeAccrualRow,
  FeeSchedule,
  FeeStats,
  FeeSweepRow,
} from "@/services/adminDashboard.service";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

const money = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(
    n,
  );

const statusStyles: Record<string, string> = {
  ACCRUED: "bg-yellow-100 text-yellow-700",
  SWEPT: "bg-green-100 text-green-700",
  WAIVED: "bg-slate-100 text-slate-500",
  COMPLETED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  FAILED: "bg-red-100 text-red-700",
};

function StatCard({
  label,
  amount,
  sub,
  color,
}: {
  label: string;
  amount: number;
  sub: string;
  color: string;
}) {
  return (
    <div className={`p-6 rounded-2xl border ${color}`}>
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </p>
      <p className="text-2xl font-black">{money(amount)}</p>
      <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>
  );
}

export default function AdminFeesScreen() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<"accruals" | "schedules" | "sweeps">(
    "accruals",
  );

  // Stats
  const [stats, setStats] = useState<FeeStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Accruals
  const [accruals, setAccruals] = useState<FeeAccrualRow[]>([]);
  const [accrualsTotal, setAccrualsTotal] = useState(0);
  const [accrualsPages, setAccrualsPages] = useState(1);
  const [accrualsPage, setAccrualsPage] = useState(1);
  const [accrualsLoading, setAccrualsLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Waive modal
  const [waivingId, setWaivingId] = useState<string | null>(null);
  const [waiveReason, setWaiveReason] = useState("");
  const [isWaiving, setIsWaiving] = useState(false);

  // Sweep
  const [isSweeping, setIsSweeping] = useState(false);

  // Sweeps
  const [sweeps, setSweeps] = useState<FeeSweepRow[]>([]);
  const [sweepsLoading, setSweepsLoading] = useState(false);

  // Schedules
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [schedulesLoading, setSchedulesLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTiers, setEditTiers] = useState<any[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Load stats
  useEffect(() => {
    setStatsLoading(true);
    adminDashboardService
      .getFeeStats()
      .then(setStats)
      .catch(() => showToast("error", "Failed to load fee stats"))
      .finally(() => setStatsLoading(false));
  }, []);

  // Load accruals
  useEffect(() => {
    const controller = new AbortController();
    setAccrualsLoading(true);
    adminDashboardService
      .listFeeAccruals(
        {
          search: searchInput,
          status: statusFilter,
          category: categoryFilter,
          page: accrualsPage,
          limit: 25,
        },
        controller.signal,
      )
      .then((res) => {
        setAccruals(res.accruals);
        setAccrualsTotal(res.total);
        setAccrualsPages(res.pages);
      })
      .catch((e) => {
        if (e.code === "ERR_CANCELED") return;
        showToast("error", "Failed to load accruals");
      })
      .finally(() => setAccrualsLoading(false));
    return () => controller.abort();
  }, [searchInput, statusFilter, categoryFilter, accrualsPage]);

  // Load sweeps
  useEffect(() => {
    if (tab !== "sweeps") return;
    setSweepsLoading(true);
    adminDashboardService
      .listFeeSweeps({ page: 1, limit: 20 })
      .then((res) => setSweeps(res.sweeps))
      .catch(() => showToast("error", "Failed to load sweep runs"))
      .finally(() => setSweepsLoading(false));
  }, [tab]);

  // Load schedules
  useEffect(() => {
    if (tab !== "schedules") return;
    setSchedulesLoading(true);
    adminDashboardService
      .listFeeSchedules()
      .then((res) => setSchedules(res.schedules))
      .catch(() => showToast("error", "Failed to load schedules"))
      .finally(() => setSchedulesLoading(false));
  }, [tab]);

  const handleWaive = async (refund: boolean) => {
    if (!waivingId || waiveReason.trim().length < 5) {
      showToast("error", "Reason must be at least 5 characters");
      return;
    }
    setIsWaiving(true);
    try {
      if (refund) {
        await adminDashboardService.waiveAndRefundFee(waivingId, waiveReason);
        showToast("success", "Fee waived and user refunded successfully");
      } else {
        await adminDashboardService.waiveFee(waivingId, waiveReason);
        showToast("success", "Fee waived successfully");
      }
      setWaivingId(null);
      setWaiveReason("");
      setAccrualsPage(1);
      adminDashboardService.getFeeStats().then(setStats);
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Operation failed");
    } finally {
      setIsWaiving(false);
    }
  };

  const handleSweep = async () => {
    setIsSweeping(true);
    try {
      const res = await adminDashboardService.sweepAccruals();
      showToast(
        "success",
        `Swept ${res.data.accrualCount} accruals totalling ${money(res.data.totalAmount)}`,
      );
      adminDashboardService.getFeeStats().then(setStats);
      setAccrualsPage(1);
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Sweep failed");
    } finally {
      setIsSweeping(false);
    }
  };

  const handleSaveSchedule = async (id: string) => {
    setIsSavingSchedule(true);
    try {
      await adminDashboardService.updateFeeSchedule(id, { tiers: editTiers });
      showToast("success", "Fee schedule updated");
      setEditingId(null);
      adminDashboardService
        .listFeeSchedules()
        .then((res) => setSchedules(res.schedules));
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Update failed");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">
            System Fee Accruals & Schedules
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Central ledger accounting for transaction fee accruals in{" "}
            <span className="font-mono text-primary">sys_fees_pool</span>,
            statutory levies, and platform fee rate schedules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSweep}
            disabled={isSweeping || (stats?.unswept.count ?? 0) === 0}
            className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center gap-2 hover:bg-primary-light transition-colors"
          >
            {isSweeping ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              `Sweep Accruals to Treasury (${stats?.unswept.count ?? 0})`
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsLoading ? (
          <div className="col-span-4 flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : stats ? (
          <>
            <StatCard
              label="Gross Fee Accruals"
              amount={stats.grossAccruals.amount}
              sub={`${stats.grossAccruals.count} ledger fee entries recorded`}
              color="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
            <StatCard
              label="Unswept in sys_fees_pool"
              amount={stats.unswept.amount}
              sub={`${stats.unswept.count} pending vault settlement sweep`}
              color="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-900/30"
            />
            <StatCard
              label="Swept to Treasury Vault"
              amount={stats.sweptToTreasury.amount}
              sub="Realized operational revenue"
              color="border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-900/30"
            />
            <StatCard
              label="Reversed & Waived"
              amount={stats.reversedAndWaived.amount}
              sub="Clawed back or promotional waivers"
              color="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </>
        ) : null}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-6">
        {[
          { key: "accruals", label: `Fee Accruals Ledger (${accrualsTotal})` },
          {
            key: "schedules",
            label: `System Fee Schedules & Configuration (${schedules.length})`,
          },
          { key: "sweeps", label: `Treasury Sweep Runs (${sweeps.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`pb-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Accruals Tab */}
      {tab === "accruals" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by accrual ID, transaction ref, payer..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setAccrualsPage(1);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setAccrualsPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Categories</option>
              <option value="P2P_TRANSFER">P2P Transfer Fee</option>
              <option value="VAULT_TRANSFER">Vault Transfer Fee</option>
              <option value="INTERNAL_TRANSFER">Internal Transfer Fee</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setAccrualsPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              <option value="ACCRUED">Accrued</option>
              <option value="SWEPT">Swept</option>
              <option value="WAIVED">Waived</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  <th className="px-4 py-4">Accrual ID</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4">Fee Amount</th>
                  <th className="px-4 py-4">Payer</th>
                  <th className="px-4 py-4">Original Transaction Ref</th>
                  <th className="px-4 py-4">Transit Account</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Accrued At</th>
                  <th className="px-4 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {accrualsLoading && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-400"
                    >
                      Loading...
                    </td>
                  </tr>
                )}
                {!accrualsLoading && accruals.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-slate-400 text-sm"
                    >
                      No accruals found
                    </td>
                  </tr>
                )}
                {!accrualsLoading &&
                  accruals.map((a) => (
                    <tr
                      key={a.accrualId}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-4 py-4 font-mono text-xs font-bold">
                        {a.accrualId}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-slate-900 dark:text-white text-xs">
                          {a.category.replace(/_/g, " ")} Fee
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {a.category}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-bold text-primary">
                        {money(a.amount)}
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-bold text-xs">{a.payerName}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {a.payerUserId}
                        </p>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs text-slate-500">
                        {a.transactionRef.slice(0, 20)}...
                      </td>
                      <td className="px-4 py-4">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                          {a.transitAccount}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusStyles[a.status]}`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-slate-500">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-4">
                        {a.status === "ACCRUED" && (
                          <button
                            onClick={() => setWaivingId(a.accrualId)}
                            className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors"
                          >
                            Waive Fee
                          </button>
                        )}
                        {a.status === "WAIVED" && (
                          <span className="text-[10px] text-slate-400">
                            Waived by {a.waivedBy}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
            <span>{accrualsTotal.toLocaleString()} accruals</span>
            <div className="flex items-center gap-2">
              <button
                disabled={accrualsPage <= 1 || accrualsLoading}
                onClick={() => setAccrualsPage((p) => p - 1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {accrualsPage} of {Math.max(accrualsPages, 1)}
              </span>
              <button
                disabled={accrualsPage >= accrualsPages || accrualsLoading}
                onClick={() => setAccrualsPage((p) => p + 1)}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedules Tab */}
      {tab === "schedules" && (
        <div className="space-y-4">
          {schedulesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">
              No fee schedules found
            </p>
          ) : (
            schedules.map((s) => (
              <div
                key={s._id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">
                      {s.transferType.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.currency} · {s.tiers.length} tiers
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-full ${s.isActive ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {s.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                    {editingId === s._id ? (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-bold text-slate-500 hover:text-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveSchedule(s._id)}
                          disabled={isSavingSchedule}
                          className="text-xs font-bold text-primary hover:text-primary-light flex items-center gap-1"
                        >
                          {isSavingSchedule && (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          )}
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(s._id);
                          setEditTiers(s.tiers.map((t) => ({ ...t })));
                        }}
                        className="text-xs font-bold text-primary hover:text-primary-light"
                      >
                        Edit Tiers
                      </button>
                    )}
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                    <tr>
                      <th className="py-2 pr-4 text-left">Min (₦)</th>
                      <th className="py-2 pr-4 text-left">Max (₦)</th>
                      <th className="py-2 text-left">Fee (₦)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(editingId === s._id ? editTiers : s.tiers).map((t, i) => (
                      <tr key={i}>
                        <td className="py-2 pr-4">
                          {editingId === s._id ? (
                            <input
                              type="number"
                              value={t.min}
                              onChange={(e) => {
                                const updated = [...editTiers];
                                updated[i].min = Number(e.target.value);
                                setEditTiers(updated);
                              }}
                              className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          ) : (
                            t.min.toLocaleString()
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {editingId === s._id ? (
                            <input
                              type="number"
                              value={t.max}
                              onChange={(e) => {
                                const updated = [...editTiers];
                                updated[i].max = Number(e.target.value);
                                setEditTiers(updated);
                              }}
                              className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          ) : (
                            t.max.toLocaleString()
                          )}
                        </td>
                        <td className="py-2">
                          {editingId === s._id ? (
                            <input
                              type="number"
                              value={t.fee}
                              onChange={(e) => {
                                const updated = [...editTiers];
                                updated[i].fee = Number(e.target.value);
                                setEditTiers(updated);
                              }}
                              className="w-28 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary"
                            />
                          ) : (
                            money(t.fee)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sweeps Tab */}
      {tab === "sweeps" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {sweepsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : sweeps.length === 0 ? (
            <p className="text-center text-slate-500 py-12 text-sm">
              No sweep runs yet
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4">Sweep ID</th>
                  <th className="px-6 py-4">Initiated By</th>
                  <th className="px-6 py-4">Total Amount</th>
                  <th className="px-6 py-4">Accruals</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sweeps.map((s) => (
                  <tr
                    key={s.sweepId}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-6 py-4 font-mono text-xs font-bold">
                      {s.sweepId}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {s.initiatedBy}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">
                      {money(s.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                      {s.accrualCount}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${statusStyles[s.status]}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {s.completedAt
                        ? new Date(s.completedAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Waive Modal */}
      {waivingId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setWaivingId(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-md mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black mb-2">Waive Fee</h3>
            <p className="text-sm text-slate-500 mb-4">
              Accrual <span className="font-mono text-xs">{waivingId}</span>{" "}
              will be permanently waived.
            </p>

            <textarea
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              rows={3}
              placeholder="Reason for waiving (min 5 characters)"
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none mb-4"
            />

            <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                Waive Only — marks the fee as waived but does NOT refund the
                user. Use Waive & Refund to also credit the user back.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setWaivingId(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold rounded-xl text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handleWaive(false)}
                disabled={isWaiving || waiveReason.trim().length < 5}
                className="flex-1 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWaiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Waive Only"
                )}
              </button>
              <button
                onClick={() => handleWaive(true)}
                disabled={isWaiving || waiveReason.trim().length < 5}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isWaiving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Waive & Refund"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  RotateCcw,
  Plus,
  CreditCard,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  DollarSign,
  Coins,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import {
  ReversalRecord,
  reversalService,
  ReversalStatus,
  ReversalType,
} from "@/services/reversal.service";
import { InitiateReversalModal } from "@/components/admin/initiateReversalModal";

export const AdminReversalsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [reversals, setReversals] = useState<ReversalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [isManualCreditModalOpen, setIsManualCreditModalOpen] = useState(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ReversalType>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ReversalStatus>(
    "ALL",
  );
  const [reasonFilter, setReasonFilter] = useState<"ALL" | string>("ALL");

  // Pagination matching transaction history
  const [visibleCount, setVisibleCount] = useState(10);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Load reversals
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await reversalService.getReversals();
      setReversals(data);
    } catch (err: any) {
      showToast("error", "Failed to load reversals records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered reversals
  const filteredReversals = useMemo(() => {
    return reversals.filter((item) => {
      // Type filter
      if (typeFilter !== "ALL" && item.type !== typeFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      // Reason filter
      if (
        reasonFilter !== "ALL" &&
        item.reason.toUpperCase() !== reasonFilter.toUpperCase()
      ) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          item.reversalId.toLowerCase().includes(q) ||
          item.originalTransactionRef.toLowerCase().includes(q) ||
          (item.paymentRef && item.paymentRef.toLowerCase().includes(q)) ||
          item.initiatedBy.toLowerCase().includes(q) ||
          item.notes.toLowerCase().includes(q) ||
          item.sender.name.toLowerCase().includes(q) ||
          item.receiver.name.toLowerCase().includes(q) ||
          item.sender.userPublicId.toLowerCase().includes(q) ||
          item.receiver.userPublicId.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [reversals, typeFilter, statusFilter, reasonFilter, searchQuery]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [typeFilter, statusFilter, reasonFilter, searchQuery]);

  // Sliced for pagination (same pattern as transaction history)
  const displayedReversals = useMemo(() => {
    return filteredReversals.slice(0, visibleCount);
  }, [filteredReversals, visibleCount]);

  const handleShowMore = () => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setVisibleCount((prev) => prev + 10);
      setIsLoadingMore(false);
    }, 400);
  };

  const getStatusBadge = (status: ReversalStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            COMPLETED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            PENDING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            FAILED
          </span>
        );
      default:
        return null;
    }
  };

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner / Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[#7C3AED]">
              <RotateCcw className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Ledger Reversals & Manual Credits
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authoritative admin endpoint for clawing back fraudulent/disputed
            P2P transfers and crediting missed Paystack webhooks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate("/admin/fees")}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors"
          >
            <Coins className="w-4 h-4 text-purple-600" />
            <span>Fee Accruals</span>
          </button>

          <button
            onClick={() => setIsManualCreditModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <CreditCard className="w-4 h-4" />
            <span>Manual Credit (Missed Webhook)</span>
          </button>

          <button
            onClick={() => setIsInitiateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Initiate Transfer Reversal</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Reversals
          </span>
          <p className="text-xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {reversals.length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Completed
          </span>
          <p className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {reversals.filter((r) => r.status === "COMPLETED").length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Accounts Frozen
          </span>
          <p className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
            {reversals.filter((r) => r.receiverFrozen).length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Total Clawed Back
          </span>
          <p className="text-xl font-bold font-mono text-[#7C3AED] mt-1">
            ₦
            {reversals
              .filter((r) => r.status === "COMPLETED")
              .reduce((acc, r) => acc + r.reversalAmount, 0)
              .toLocaleString("en-NG")}
          </p>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Reversal ID, reference, admin name, party..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED]"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Type dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Type:
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Types</option>
                <option value="TRANSFER_REVERSAL">Transfer Reversal</option>
                <option value="MANUAL_CREDIT">Manual Credit</option>
              </select>
            </div>

            {/* Status dropdown */}
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
                <option value="COMPLETED">Completed</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>

            {/* Reason dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Reason:
              </span>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Reasons</option>
                <option value="FRAUD">FRAUD</option>
                <option value="USER_DISPUTE">USER_DISPUTE</option>
                <option value="COMPLIANCE">COMPLIANCE</option>
                <option value="DUPLICATE_TRANSACTION">
                  DUPLICATE_TRANSACTION
                </option>
                <option value="TECHNICAL_ERROR">TECHNICAL_ERROR</option>
                <option value="MISSED_WEBHOOK">MISSED_WEBHOOK</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            {(typeFilter !== "ALL" ||
              statusFilter !== "ALL" ||
              reasonFilter !== "ALL" ||
              searchQuery) && (
              <button
                onClick={() => {
                  setTypeFilter("ALL");
                  setStatusFilter("ALL");
                  setReasonFilter("ALL");
                  setSearchQuery("");
                }}
                className="text-xs text-purple-600 hover:text-purple-700 font-semibold px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
            <p className="text-xs font-semibold">
              Loading ledger reversal records...
            </p>
          </div>
        ) : filteredReversals.length === 0 ? (
          <div className="py-16 text-center text-slate-500 space-y-2">
            <RotateCcw className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              No reversals match current criteria
            </p>
            <p className="text-xs text-slate-400">
              Try changing the filters or initiating a new reversal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Reversal ID</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Original Tx Ref</th>
                  <th className="py-3.5 px-4">Original Amount</th>
                  <th className="py-3.5 px-4">Reason</th>
                  <th className="py-3.5 px-4">Initiated By</th>
                  <th className="py-3.5 px-4">Created At</th>
                  <th className="py-3.5 px-4 text-center">Receiver Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {displayedReversals.map((r) => (
                  <tr
                    key={r.reversalId}
                    onClick={() => navigate(`/admin/reversals/${r.reversalId}`)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors group"
                  >
                    {/* Reversal ID */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white group-hover:text-[#7C3AED]">
                      {r.reversalId}
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-tight ${
                          r.type === "TRANSFER_REVERSAL"
                            ? "bg-purple-100 text-[#7C3AED] dark:bg-purple-900/30"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                        }`}
                      >
                        {r.type}
                      </span>
                    </td>

                    {/* Status badge */}
                    <td className="py-3.5 px-4">{getStatusBadge(r.status)}</td>

                    {/* Original Transaction Ref */}
                    <td
                      className="py-3.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-[170px] truncate"
                      title={r.originalTransactionRef}
                    >
                      {r.originalTransactionRef}
                    </td>

                    {/* Original Amount (₦ formatted) */}
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {formatNaira(r.originalAmount)}
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      <span className="text-[11px]">{r.reason}</span>
                    </td>

                    {/* Initiated By */}
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {r.initiatedBy}
                    </td>

                    {/* Created At */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Receiver Frozen badge */}
                    <td className="py-3.5 px-4 text-center">
                      {r.receiverFrozen ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400 border border-red-200 dark:border-red-800">
                          <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
                          Account Frozen
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px]">
                          Normal
                        </span>
                      )}
                    </td>

                    {/* Action Arrow */}
                    <td className="py-3.5 px-4 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#7C3AED] opacity-0 group-hover:opacity-100 transition-opacity">
                        View
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Section (Matching Transaction History pattern) */}
        {!loading && filteredReversals.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
            <span className="text-xs text-slate-500 font-medium">
              Showing{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {Math.min(visibleCount, filteredReversals.length)}
              </span>{" "}
              of{" "}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {filteredReversals.length}
              </span>{" "}
              records
            </span>

            {visibleCount < filteredReversals.length && (
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

      {/* Action Modals */}
      <InitiateReversalModal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        onSuccess={() => loadData()}
      />

      <ManualCreditModal
        isOpen={isManualCreditModalOpen}
        onClose={() => setIsManualCreditModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </div>
  );
};

export default AdminReversalsScreen;

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  RotateCcw,
  CreditCard,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  User,
  ArrowRight,
  Calendar,
  FileText,
  DollarSign,
  Building,
  Layers,
  Loader2,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import { ReversalRecord, reversalService, ReversalStatus } from "@/services/reversal.service";

export const AdminReversalDetailScreen: React.FC = () => {
  const { reversalId } = useParams<{ reversalId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [record, setRecord] = useState<ReversalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecord = async () => {
      if (!reversalId) return;
      setLoading(true);
      try {
        const item = await reversalService.getReversalById(reversalId);
        setRecord(item);
      } catch (err: any) {
        showToast("error", "Failed to retrieve reversal record");
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [reversalId]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const formatNaira = (amount: number) => {
    return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusBadge = (status: ReversalStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            COMPLETED
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            PENDING
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            FAILED
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[#7C3AED]" />
        <p className="text-xs font-semibold">Loading reversal details...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <RotateCcw className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Reversal Record Not Found
        </h2>
        <p className="text-xs text-slate-500">
          The requested reversal identifier "{reversalId}" does not exist in the
          ledger registry.
        </p>
        <button
          onClick={() => navigate("/admin/reversals")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reversals
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/admin/reversals")}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                {record.reversalId}
              </h1>
              {getStatusBadge(record.status)}
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight ${
                  record.type === "TRANSFER_REVERSAL"
                    ? "bg-purple-100 text-[#7C3AED] dark:bg-purple-900/30"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30"
                }`}
              >
                {record.type}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Initiated by{" "}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {record.initiatedBy}
              </span>{" "}
              on {new Date(record.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleCopy(record.reversalId, "id")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            {copiedKey === "id" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>Copy Reversal ID</span>
          </button>
        </div>
      </div>

      {/* Negative Balance Warning Banner (Per user prompt) */}
      {record.receiverWentNegative && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 shadow-sm flex items-start gap-3.5">
          <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-xs font-bold text-red-900 dark:text-red-200 uppercase tracking-wide">
              Negative Balance Incurred — Account Frozen
            </h3>
            <p className="text-xs font-semibold text-red-800 dark:text-red-300 mt-0.5">
              ⚠️ This reversal resulted in a negative balance for the receiver.
              Their account has been frozen and requires collection action.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Summary Card & Amounts Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Summary Card */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#7C3AED]" />
              Summary Card
            </h2>
            <span className="text-[10px] font-mono text-slate-400">
              LEDGER-TX-VERIFIED
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Reversal ID
              </span>
              <p className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">
                {record.reversalId}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Type
              </span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {record.type}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Status
              </span>
              <div className="mt-0.5">{getStatusBadge(record.status)}</div>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Reason
              </span>
              <p className="font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                {record.reason}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Initiated By
              </span>
              <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                {record.initiatedBy}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Created At
              </span>
              <p className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                {new Date(record.createdAt).toLocaleString()}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Completed At
              </span>
              <p className="font-mono text-slate-700 dark:text-slate-300 mt-0.5">
                {record.completedAt
                  ? new Date(record.completedAt).toLocaleString()
                  : "In-flight / Pending Settlement"}
              </p>
            </div>
            {record.paymentRef && (
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">
                  Paystack Payment Ref
                </span>
                <p className="font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {record.paymentRef}
                </p>
              </div>
            )}
          </div>

          {/* Transaction references with links */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Original Transaction Reference (Link to Transaction Detail)
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {record.originalTransactionRef}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      handleCopy(record.originalTransactionRef, "orig")
                    }
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Copy reference"
                  >
                    {copiedKey === "orig" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Link
                    to={`/admin/transactions?search=${encodeURIComponent(record.originalTransactionRef)}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                  >
                    View Transaction <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Reversal Transaction Reference (Link to Reversal Ledger Entries)
              </span>
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                  {record.reversalTransactionRef}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      handleCopy(record.reversalTransactionRef, "revRef")
                    }
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Copy reference"
                  >
                    {copiedKey === "revRef" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Link
                    to={`/admin/transactions?search=${encodeURIComponent(record.reversalTransactionRef)}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
                  >
                    View Ledger Entry <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
              Audit Notes
            </span>
            <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans">
              {record.notes}
            </div>
          </div>
        </div>

        {/* Amounts Card */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                Amounts Card
              </h2>
              <span className="text-[10px] font-mono text-slate-400">NGN</span>
            </div>

            <div className="mt-5 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Amount:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {formatNaira(record.originalAmount)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Original Transfer Fee:</span>
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">
                  {formatNaira(record.originalFee)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reverse Fee:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                    record.reverseFee
                      ? "bg-purple-100 text-[#7C3AED] dark:bg-purple-900/30"
                      : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {record.reverseFee ? "Yes" : "No"}
                </span>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-900 dark:text-white block">
                    Reversal Amount
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Total Returned to Sender
                  </span>
                </div>
                <span className="font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatNaira(record.reversalAmount)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Invariant Settlement:
            </span>
            <br />
            Ledger double-entry balanced via system vault transit account.
          </div>
        </div>
      </div>

      {/* Parties Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-[#7C3AED]" />
            Parties Card
          </h2>
          <span className="text-[10px] font-mono text-slate-400">
            ACCOUNTS AFFECTED
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sender (Got Money Back) */}
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Sender (Got money back)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40">
                Credited
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {record.sender.name}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {record.sender.email}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                Public ID:{" "}
                <span className="font-bold">{record.sender.userPublicId}</span>
              </span>
              <Link
                to={`/admin/users?search=${encodeURIComponent(record.sender.userPublicId)}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                View Profile <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* Receiver (Was Debited) */}
          <div
            className={`p-4 rounded-xl border space-y-2 ${
              record.receiverFrozen
                ? "border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20"
                : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Receiver (Was debited)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  Debited
                </span>
                {record.receiverFrozen && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300 border border-red-200 dark:border-red-800">
                    <ShieldAlert className="w-3 h-3 text-red-600 dark:text-red-400" />
                    Account Frozen
                  </span>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {record.receiver.name}
              </p>
              <p className="text-xs text-slate-500 font-mono">
                {record.receiver.email}
              </p>
            </div>
            <div className="pt-2 flex items-center justify-between">
              <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                Public ID:{" "}
                <span className="font-bold">
                  {record.receiver.userPublicId}
                </span>
              </span>
              <Link
                to={`/admin/users?search=${encodeURIComponent(record.receiver.userPublicId)}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#7C3AED] hover:underline"
              >
                View Profile <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Status Timeline Card */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#7C3AED]" />
            Status Timeline
          </h2>
          <span className="text-[10px] font-mono text-slate-400">
            AUDIT TRAIL
          </span>
        </div>

        <div className="space-y-6 pt-2">
          {/* Step 1: Created */}
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[#7C3AED] flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Created at {new Date(record.createdAt).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                Reversal request initiated by {record.initiatedBy}. Reason
                recorded: {record.reason}.
              </p>
            </div>
          </div>

          {/* Step 2: Completed or Failed */}
          <div className="flex items-start gap-3">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                record.status === "COMPLETED"
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600"
                  : record.status === "FAILED"
                    ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600"
                    : "bg-amber-100 dark:bg-amber-950/60 text-amber-600"
              }`}
            >
              2
            </div>
            <div>
              {record.status === "COMPLETED" ? (
                <>
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Completed at{" "}
                    {record.completedAt
                      ? new Date(record.completedAt).toLocaleString()
                      : "N/A"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Compensating ledger transactions applied. Sender credited
                    with {formatNaira(record.reversalAmount)}.
                  </p>
                </>
              ) : record.status === "FAILED" ? (
                <>
                  <p className="text-xs font-bold text-rose-700 dark:text-rose-400">
                    Failed at{" "}
                    {record.completedAt
                      ? new Date(record.completedAt).toLocaleString()
                      : new Date(record.createdAt).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-rose-600 dark:text-rose-300 font-medium mt-0.5">
                    Failure reason:{" "}
                    {record.failureReason ||
                      "Reversal execution rejected by payment switch or ledger lock."}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                    Pending Processing
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Reversal instructions dispatched to core banking engine
                    awaiting interbank settlement.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReversalDetailScreen;

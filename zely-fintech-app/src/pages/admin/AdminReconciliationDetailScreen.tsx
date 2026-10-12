import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Activity,
  ServerCrash,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Loader2,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import {
  reconciliationService,
  ReconReportDetail,
  IDriftRecord,
} from "@/services/reconciliation.service";

const formatNaira = (n: number) =>
  `₦${Math.abs(n).toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const SeverityBadge = ({ severity }: { severity: string }) => {
  const map: Record<string, string> = {
    OVERSTATED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    UNDERSTATED:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    IN_SYNC:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[severity] ?? "bg-slate-100 text-slate-600"}`}
    >
      {severity}
    </span>
  );
};

const ActionBadge = ({ action }: { action: string }) => {
  const map: Record<string, string> = {
    ALERT_AND_FREEZE: "bg-red-100 text-red-700 dark:bg-red-900/30",
    ALERT_ONLY: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
    NONE: "bg-slate-100 text-slate-500 dark:bg-slate-800",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[action] ?? "bg-slate-100 text-slate-600"}`}
    >
      {action.replace(/_/g, " ")}
    </span>
  );
};

interface ResolveDriftModalProps {
  drift: IDriftRecord;
  runId: string;
  onClose: () => void;
  onResolved: () => void;
}

const ResolveDriftModal: React.FC<ResolveDriftModalProps> = ({
  drift,
  runId,
  onClose,
  onResolved,
}) => {
  const { showToast } = useToast();
  const [resolutionType, setResolutionType] = useState<
    "CORRECTED" | "FALSE_POSITIVE" | "ESCALATED"
  >("FALSE_POSITIVE");
  const [correctionMethod, setCorrectionMethod] = useState<
    "LEDGER_ENTRY" | "DIRECT_CACHE_SYNC"
  >("DIRECT_CACHE_SYNC");
  const [applyCorrection, setApplyCorrection] = useState(false);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Notes are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await reconciliationService.resolveDrift({
        runId,
        ledgerAccountPublicId: drift.ledgerAccountPublicId,
        resolutionType,
        notes: notes.trim(),
        applyCorrection: applyCorrection && resolutionType === "CORRECTED",
        correctionMethod:
          applyCorrection && resolutionType === "CORRECTED"
            ? correctionMethod
            : undefined,
      });
      showToast("success", "Drift resolved successfully");
      onResolved();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "Failed to resolve drift",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Resolve Drift
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drift Summary */}
        <div className="px-6 pt-4 pb-2">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Account</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {drift.ledgerAccountPublicId}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Cached Balance</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatNaira(drift.cachedBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">True Ledger Balance</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {formatNaira(drift.trueBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Drift</span>
              <span
                className={`font-mono font-bold ${drift.drift > 0 ? "text-red-600" : "text-amber-600"}`}
              >
                {drift.drift > 0 ? "+" : ""}
                {formatNaira(drift.drift)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Severity</span>
              <SeverityBadge severity={drift.severity} />
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
              {error}
            </div>
          )}

          {/* Resolution Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Resolution Type
            </label>
            <select
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="FALSE_POSITIVE">
                False Positive — no action needed
              </option>
              <option value="CORRECTED">Corrected — apply fix</option>
              <option value="ESCALATED">Escalated — needs senior review</option>
            </select>
          </div>

          {/* Correction Method — only when CORRECTED */}
          {resolutionType === "CORRECTED" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyCorrection}
                  onChange={(e) => setApplyCorrection(e.target.checked)}
                  className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary"
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Apply automatic correction
                </span>
              </label>

              {applyCorrection && (
                <div className="space-y-1.5 pl-6">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Correction Method
                  </label>
                  <select
                    value={correctionMethod}
                    onChange={(e) => setCorrectionMethod(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="DIRECT_CACHE_SYNC">
                      Direct Cache Sync — update wallet to match ledger
                    </option>
                    <option value="LEDGER_ENTRY">
                      Compensating Ledger Entry — write adjustment entry
                    </option>
                  </select>
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ This action modifies live balances. Verify the drift
                    before applying.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Audit Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setError(null);
              }}
              placeholder="Describe why this drift is being resolved this way..."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              required
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !notes.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-light text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Resolve Drift
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const DriftRow: React.FC<{
  drift: IDriftRecord;
  runId: string;
  onResolved: () => void;
}> = ({ drift, runId, onResolved }) => {
  const [expanded, setExpanded] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);

  const isResolved = !!drift.resolvedAt;

  return (
    <>
      <tr
        className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer ${
          isResolved ? "opacity-60" : ""
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
          {drift.ledgerAccountPublicId}
        </td>
        <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-400 uppercase">
          {drift.ownerType}
        </td>
        <td className="px-4 py-3">
          <SeverityBadge severity={drift.severity} />
        </td>
        <td className="px-4 py-3">
          <ActionBadge action={drift.action} />
        </td>
        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
          {formatNaira(drift.cachedBalance)}
        </td>
        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">
          {formatNaira(drift.trueBalance)}
        </td>
        <td
          className={`px-4 py-3 font-mono text-xs font-bold ${drift.drift > 0 ? "text-red-600" : "text-amber-600"}`}
        >
          {drift.drift > 0 ? "+" : ""}
          {formatNaira(drift.drift)}
        </td>
        <td className="px-4 py-3">
          {isResolved ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30">
              <CheckCircle2 className="w-3 h-3" />
              {drift.resolutionType}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30">
              <Clock className="w-3 h-3" />
              OPEN
            </span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {!isResolved && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setResolveOpen(true);
                }}
                className="px-2.5 py-1 text-[10px] font-bold text-white bg-primary hover:bg-primary-light rounded-lg transition-colors"
              >
                Resolve
              </button>
            )}
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-slate-50 dark:bg-slate-800/30">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Category
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {drift.category.replace(/_/g, " ")}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Owner
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {drift.ownerPublicId}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Detected At
                </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(drift.detectedAt).toLocaleString()}
                </span>
              </div>
              {drift.notes && (
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                    System Notes
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    {drift.notes}
                  </span>
                </div>
              )}
              {isResolved && (
                <>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Resolved By
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {drift.resolvedBy}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                      Resolved At
                    </span>
                    <span className="text-slate-700 dark:text-slate-300">
                      {new Date(drift.resolvedAt!).toLocaleString()}
                    </span>
                  </div>
                  {drift.resolutionNotes && (
                    <div className="sm:col-span-2 lg:col-span-3">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Resolution Notes
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {drift.resolutionNotes}
                      </span>
                    </div>
                  )}
                  {drift.correctionMethod && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Correction Method
                      </span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {drift.correctionMethod.replace(/_/g, " ")}
                      </span>
                    </div>
                  )}
                  {drift.compensatingEntryRef && (
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                        Compensating Entry Ref
                      </span>
                      <span className="font-mono text-primary text-[11px]">
                        {drift.compensatingEntryRef}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </td>
        </tr>
      )}

      {resolveOpen && (
        <ResolveDriftModal
          drift={drift}
          runId={runId}
          onClose={() => setResolveOpen(false)}
          onResolved={onResolved}
        />
      )}
    </>
  );
};

const AdminReconciliationDetailScreen: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [report, setReport] = useState<ReconReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    if (!runId) return;
    setLoading(true);
    try {
      const data = await reconciliationService.getReportById(runId);
      setReport(data);
    } catch (err: any) {
      showToast("error", "Failed to load reconciliation report");
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs font-semibold">
          Loading reconciliation report...
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <ServerCrash className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
          Report Not Found
        </h2>
        <p className="text-xs text-slate-500">
          The requested run ID "{runId}" does not exist.
        </p>
        <button
          onClick={() => navigate("/admin/reconciliation")}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Reconciliation
        </button>
      </div>
    );
  }

  const openDrifts = report.drifts.filter((d) => !d.resolvedAt);
  const resolvedDrifts = report.drifts.filter((d) => !!d.resolvedAt);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/admin/reconciliation")}
          className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold font-mono text-slate-900 dark:text-white">
              {report.runId}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
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
              {report.status === "RUNNING" && <Activity className="w-3 h-3" />}
              {report.status === "FAILED" && (
                <ServerCrash className="w-3 h-3" />
              )}
              {report.status}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 uppercase">
              {report.triggeredBy}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Started {new Date(report.startedAt).toLocaleString()}
            {report.finishedAt &&
              ` · Finished ${new Date(report.finishedAt).toLocaleString()}`}
            {report.durationMs &&
              ` · ${(report.durationMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>

      {/* Failed banner */}
      {report.status === "FAILED" && report.errorMessage && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
          <ServerCrash className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">
              Run Failed
            </p>
            <p className="text-xs text-red-700 dark:text-red-200 mt-0.5">
              {report.errorMessage}
            </p>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Accounts Checked
          </span>
          <p className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">
            {report.accountsChecked.toLocaleString()}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Drifts Found
          </span>
          <p
            className={`text-2xl font-bold font-mono mt-1 ${report.driftsFound > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {report.driftsFound}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Open Drifts
          </span>
          <p
            className={`text-2xl font-bold font-mono mt-1 ${openDrifts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {openDrifts.length}
          </p>
        </div>
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Resolved
          </span>
          <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {resolvedDrifts.length}
          </p>
        </div>
      </div>

      {/* Drifts Table */}
      {report.drifts.length === 0 ? (
        <div className="py-16 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
          <p className="text-sm font-bold text-slate-900 dark:text-white">
            All accounts in sync
          </p>
          <p className="text-xs text-slate-500 mt-1">
            No ledger drifts detected in this run.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Drift Records
              </h2>
              <span className="text-[11px] text-slate-400">
                {openDrifts.length} open · {resolvedDrifts.length} resolved
              </span>
            </div>
            {openDrifts.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
                <Info className="w-3.5 h-3.5" />
                Click a row to expand · Resolve to close
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                  <th className="px-4 py-3">Ledger Account</th>
                  <th className="px-4 py-3">Owner Type</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Action Taken</th>
                  <th className="px-4 py-3">Cached Balance</th>
                  <th className="px-4 py-3">True Balance</th>
                  <th className="px-4 py-3">Drift</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {report.drifts.map((drift, i) => (
                  <DriftRow
                    key={`${drift.ledgerAccountPublicId}-${i}`}
                    drift={drift}
                    runId={report.runId}
                    onResolved={fetchReport}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReconciliationDetailScreen;

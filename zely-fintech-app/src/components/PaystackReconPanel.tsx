import { useToast } from "@/context/ToastContext";
import { reconciliationService } from "@/services/reconciliation.service";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";

const PaystackReconPanel: React.FC = () => {
  const { showToast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    totalChecked: number;
    driftsFound: number;
    drifts: any[];
  } | null>(null);

  const handleRun = async () => {
    setLoading(true);
    setResult(null);
    try {
      const data = await reconciliationService.reconcilePaystack(date);
      setResult(data);
      showToast(
        data.driftsFound > 0 ? "error" : "success",
        data.driftsFound > 0
          ? `${data.driftsFound} drift(s) found against Paystack`
          : `All ${data.totalChecked} Paystack records matched`,
      );
    } catch (err: any) {
      showToast(
        "error",
        err?.response?.data?.message ?? "Paystack reconciliation failed",
      );
    } finally {
      setLoading(false);
    }
  };

  const categoryColor: Record<string, string> = {
    MISSING_IN_OUR_SYSTEM: "bg-red-100 text-red-700 dark:bg-red-900/30",
    MISSING_IN_PAYSTACK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30",
    AMOUNT_MISMATCH: "bg-orange-100 text-orange-700 dark:bg-orange-900/30",
    STATUS_MISMATCH: "bg-purple-100 text-purple-700 dark:bg-purple-900/30",
    IN_SYNC: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30",
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Paystack Settlement Reconciliation
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Compare your payment records against Paystack's transaction API for
            a given date
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Settlement Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
            className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 mt-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          Run Settlement Check
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-500">
              Checked:{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {result.totalChecked}
              </span>
            </span>
            <span className="text-slate-500">
              Drifts:{" "}
              <span
                className={`font-bold ${result.driftsFound > 0 ? "text-red-600" : "text-emerald-600"}`}
              >
                {result.driftsFound}
              </span>
            </span>
          </div>

          {result.drifts.length === 0 ? (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                All records matched — no discrepancies found for {date}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Our Amount</th>
                    <th className="px-4 py-3 text-right">Paystack Amount</th>
                    <th className="px-4 py-3 text-center">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {result.drifts.map((d: any, i: any) => (
                    <tr
                      key={i}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-slate-600 dark:text-slate-400 max-w-[160px] truncate">
                        {d.reference}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${categoryColor[d.category] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {d.category.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {d.ourAmount != null
                          ? `₦${d.ourAmount.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {d.providerAmount != null
                          ? `₦${d.providerAmount.toLocaleString()}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {d.requiresManualReview ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30">
                            Manual Review
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px]">
                            Auto
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PaystackReconPanel;

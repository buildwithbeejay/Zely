import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Loader2,
  CreditCard,
  ShieldAlert,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import { ReversalRecord, reversalService } from "@/services/reversal.service";
import { useToast } from "../../context/ToastContext";

interface ManualCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reversal: ReversalRecord, creditedAmount: number) => void;
}

export const ManualCreditModal: React.FC<ManualCreditModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [paymentRef, setPaymentRef] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFormValid = paymentRef.trim().length > 0 && notes.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setInlineError(null);

    try {
      const reversal = await reversalService.applyManualCredit({
        paymentRef: paymentRef.trim(),
        notes: notes.trim(),
      });

      const creditedAmount = reversal.originalAmount;

      showToast(
        "success",
        `₦${creditedAmount.toLocaleString("en-NG")} credited to user's wallet`,
      );
      onSuccess(reversal, creditedAmount);
      setPaymentRef("");
      setNotes("");
      setInlineError(null);
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "An unexpected error occurred";
      setInlineError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="credit-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="credit-modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Manual Credit (Missed Webhook)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manually credit user wallet after verifying Paystack payment
                settlement
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Banner (Per user prompt) */}
        <div className="mx-6 mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
            <span className="font-bold">
              ⚠️ Only use this for Paystack payments with status SUCCESS that
              were never credited to the user's wallet.
            </span>
            <br />
            The system will verify the payment status before crediting.
          </div>
        </div>

        {/* Inline Error Message */}
        {inlineError && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 animate-in shake duration-200">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">
                Credit Application Rejected
              </h4>
              <p className="text-xs font-medium text-red-700 dark:text-red-200 mt-1">
                {inlineError}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Field: paymentRef */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Paystack Payment Reference{" "}
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                pstk_ref_...
              </span>
            </div>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => {
                setPaymentRef(e.target.value);
                if (inlineError) setInlineError(null);
              }}
              placeholder="e.g. pstk_succ_99401_web"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-colors"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              The Paystack payment reference that succeeded but was never
              credited
            </p>
          </div>

          {/* Field: notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Audit Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                if (inlineError) setInlineError(null);
              }}
              placeholder="e.g. Webhook failure on Paystack event charge.success at 14:22 UTC. Verified payment on Paystack dashboard via ref."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Document the reason — e.g. webhook failure, reaper missed it
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
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
              disabled={!isFormValid || loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Apply Manual Credit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

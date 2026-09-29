import React, { useState } from "react";
import {
  X,
  AlertTriangle,
  Loader2,
  RotateCcw,
  CheckCircle2,
  ShieldAlert,
  Info,
  HelpCircle,
} from "lucide-react";

import { useToast } from "../../context/ToastContext";
import {
  ReversalReason,
  ReversalRecord,
  reversalService,
} from "@/services/reversal.service";

interface InitiateReversalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (reversal: ReversalRecord) => void;
}

const REASON_OPTIONS: {
  value: ReversalReason;
  label: string;
  description: string;
}[] = [
  {
    value: "FRAUD",
    label: "Fraud / Unauthorized Access",
    description: "Unauthorized account takeover or stolen credentials",
  },
  {
    value: "USER_DISPUTE",
    label: "User Dispute",
    description: "Buyer-seller conflict or disputed peer-to-peer exchange",
  },
  {
    value: "COMPLIANCE",
    label: "Regulatory Compliance / AML",
    description:
      "Sanction watchlists, high-risk flags, or statutory court order",
  },
  {
    value: "DUPLICATE_TRANSACTION",
    label: "Duplicate Transaction",
    description: "Client retry bug or payment switch double-dispatch",
  },
  {
    value: "TECHNICAL_ERROR",
    label: "Technical System Error",
    description: "Core ledger lock deadlock or unconfirmed switch timeout",
  },
  {
    value: "OTHER",
    label: "Other Justified Reason",
    description: "Manual operational reconciliation request",
  },
];

export const InitiateReversalModal: React.FC<InitiateReversalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [originalTransactionRef, setOriginalTransactionRef] = useState("");
  const [reason, setReason] = useState<ReversalReason>("FRAUD");
  const [notes, setNotes] = useState("");
  const [reverseFee, setReverseFee] = useState<boolean>(true);

  const [loading, setLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isFormValid =
    originalTransactionRef.trim().length > 0 &&
    reason &&
    notes.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || loading) return;

    setLoading(true);
    setInlineError(null);

    try {
      const res = await reversalService.initiateReversal({
        originalTransactionRef: originalTransactionRef.trim(),
        reason,
        notes: notes.trim(),
        reverseFee,
      });

      if (res.success) {
        showToast(
          "success",
          `Reversal initiated successfully: ${res.reversal.reversalId}`,
        );
        onSuccess(res.reversal);
        // Reset form & close
        setOriginalTransactionRef("");
        setNotes("");
        setInlineError(null);
        onClose();
      }
    } catch (err: any) {
      const msg =
        err.message || "An unexpected error occurred while initiating reversal";
      setInlineError(msg);
      // Keep modal open per specification
    } finally {
      setLoading(false);
    }
  };

  // Helper presets for testing different error/success scenarios
  const applyPreset = (
    ref: string,
    reasonVal: ReversalReason,
    noteVal: string,
  ) => {
    setOriginalTransactionRef(ref);
    setReason(reasonVal);
    setNotes(noteVal);
    setInlineError(null);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-[#7C3AED]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="modal-title"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                Initiate Transfer Reversal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create compensating double-entry ledger entries for settled P2P
                transfer
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

        {/* Warning Banner (Always visible per prompt) */}
        <div className="mx-6 mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
            <span className="font-bold">
              ⚠️ This action is permanent and cannot be undone.
            </span>
            <br />
            Compensating ledger entries will be written immediately. If the
            receiver has insufficient funds, their account will go negative and
            be frozen.
          </div>
        </div>

        {/* Inline Error Message (Prominent if failed) */}
        {inlineError && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3 animate-in shake duration-200">
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">
                Reversal Rejected
              </h4>
              <p className="text-xs font-medium text-red-700 dark:text-red-200 mt-1">
                {inlineError}
              </p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Field: originalTransactionRef */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Original Transaction Reference{" "}
                <span className="text-red-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                e.g. TRF-NGN-2026-XXXX
              </span>
            </div>
            <input
              type="text"
              value={originalTransactionRef}
              onChange={(e) => {
                setOriginalTransactionRef(e.target.value);
                if (inlineError) setInlineError(null);
              }}
              placeholder="e.g. TRF-NGN-20260920-881920"
              className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:bg-white dark:focus:bg-slate-900 transition-colors"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              The transaction reference of the completed transfer to reverse
            </p>

            {/* Quick Test Presets */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] text-slate-400 font-semibold">
                Test presets:
              </span>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    "TRF-NGN-20260928-SUCCESS",
                    "FRAUD",
                    "Confirmed account takeover dispute by bank",
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-purple-100 hover:text-purple-700 transition-colors"
              >
                Valid (Standard)
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    "TRF-NGN-20260920-881920",
                    "DUPLICATE_TRANSACTION",
                    "Testing already reversed error",
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-700 transition-colors"
              >
                Already Reversed
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    "TX-REV-9041-COMP",
                    "OTHER",
                    "Attempting to reverse a reversal",
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-100 hover:text-red-700 transition-colors"
              >
                Is-A-Reversal
              </button>
              <button
                type="button"
                onClick={() =>
                  applyPreset(
                    "TRF-NOT_FOUND-404",
                    "OTHER",
                    "Testing 404 handler",
                  )
                }
                className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              >
                404 Not Found
              </button>
            </div>
          </div>

          {/* Field: reason */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ReversalReason)}
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] text-slate-800 dark:text-slate-200"
              required
            >
              {REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.value} — {opt.label}
                </option>
              ))}
            </select>
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
              placeholder="e.g. Case #FL-902: Sender filed verified dispute with Nigerian Police Cybercrime unit. Debited beneficiary ledger accordingly."
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C3AED] resize-none"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Document why this reversal is being initiated — this is your audit
              trail
            </p>
          </div>

          {/* Field: reverseFee (Toggle, default ON) */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Also reverse the transfer fee
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Turn off only if fee should be retained as a service charge
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={reverseFee}
                  onChange={(e) => setReverseFee(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#7C3AED]"></div>
              </label>
            </div>
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
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Initiate Reversal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

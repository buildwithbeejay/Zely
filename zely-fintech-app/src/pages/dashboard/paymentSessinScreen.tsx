import axiosPrivate from "@/api/client";
import { useDashboardData } from "@/context/DashboardDataContext";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCcw,
  RefreshCw,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useToast } from "../../context/ToastContext";

type PaymentStatus = "pending" | "success" | "failed" | "expired";

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  authorization_url: string;
  createdAt: string;
}

const PaymentSessionScreen: React.FC = () => {
  const { intentId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const { refreshWallets } = useDashboardData();

  useEffect(() => {
    if (!intentId) {
      setLoading(false);
      return;
    }

    const fetchIntent = async () => {
      try {
        const response = await axiosPrivate.get(`/payments/${intentId}`);
        const data = response.data.data;

        setIntent({
          id: data.reference,
          amount: data.amount,
          currency: data.currency,
          status: data.status.toLowerCase() as PaymentStatus,
          authorization_url: data.providerAuthorizationUrl,
          createdAt: data.initiatedAt,
        });
      } catch {
        setIntent(null);
      } finally {
        setLoading(false);
      }
    };

    fetchIntent();
  }, [intentId]);

  const handleContinuePayment = () => {
    if (!intent) return;
    // In a real app, you might redirect to the authorization_url or open an iframe
    window.open(intent.authorization_url, "_blank");
    showToast("info", "Opening payment gateway...");
  };

  const handleCancelPayment = async () => {
    if (!intent) return;
    try {
      await axiosPrivate.patch(`/payments/${intent.id}/cancel`);
      setIntent({ ...intent, status: "failed" });
      showToast("error", "Payment cancelled.");
    } catch {
      showToast("error", "Could not cancel. Try again.");
    }
  };

  const handleCheckStatus = async () => {
    if (!intent) return;
    setCheckingStatus(true);

    try {
      const response = await axiosPrivate.get(`/payments/${intent.id}`);
      const freshStatus =
        response.data.data.status.toLowerCase() as PaymentStatus;
      console.log("fresh status:", freshStatus);
      setIntent({ ...intent, status: freshStatus });

      if (freshStatus === "success") {
        showToast("success", "Payment was successful!");
      } else if (freshStatus === "pending") {
        showToast("warning", "Payment is still pending.");
      } else {
        showToast("error", "Payment failed or was cancelled.");

        console.log("showToast:", showToast);
      }
    } catch (e) {
      console.log("error:", e);
      showToast("error", "Could not check status. Try again.");
    } finally {
      setCheckingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-xl mx-auto flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!intent) {
    return (
      <div className="w-full max-w-xl mx-auto text-center space-y-4 pt-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="text-2xl font-black text-slate-800 dark:text-white">
          Payment Session Not Found
        </h2>
        <button
          onClick={() => navigate("/fund-wallet")}
          className="text-primary font-bold hover:underline"
        >
          Return to Funding
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto py-8 animate-in fade-in slide-in-from-bottom-4">
      <button
        onClick={() => navigate("/fund-wallet")}
        className="text-sm font-bold text-slate-500 hover:text-primary flex items-center gap-1 mb-6"
      >
        ← Back to Funds
      </button>

      {/* Ticket Style Container */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl relative overflow-hidden drop-shadow-xl border border-slate-100 dark:border-slate-800">
        {/* Decorative background based on status */}
        <div
          className={`absolute top-0 left-0 w-full h-2 ${
            intent.status === "success"
              ? "bg-green-500"
              : intent.status === "pending"
                ? "bg-amber-400"
                : intent.status === "failed"
                  ? "bg-red-500"
                  : "bg-slate-400"
          }`}
        />

        <div className="px-8 pt-10 pb-8 text-center relative border-b border-dashed border-slate-200 dark:border-slate-700">
          <div className="absolute left-[-16px] bottom-[-16px] w-8 h-8 bg-slate-50 dark:bg-[#0b1120] rounded-full shadow-inner border-r border-t border-slate-200 dark:border-slate-700 transform rotate-45"></div>
          <div className="absolute right-[-16px] bottom-[-16px] w-8 h-8 bg-slate-50 dark:bg-[#0b1120] rounded-full shadow-inner border-l border-t border-slate-200 dark:border-slate-700 transform -rotate-45"></div>

          <div
            className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-6 shadow-xl ${
              intent.status === "success"
                ? "bg-green-50 text-green-500 dark:bg-green-900/30"
                : intent.status === "pending"
                  ? "bg-amber-50 text-amber-500 dark:bg-amber-900/30"
                  : intent.status === "expired"
                    ? "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    : "bg-red-50 text-red-500 dark:bg-red-900/30"
            }`}
          >
            {intent.status === "success" && (
              <CheckCircle2 className="w-12 h-12" />
            )}
            {intent.status === "pending" && <Clock className="w-12 h-12" />}
            {intent.status === "expired" && <XCircle className="w-12 h-12" />}
            {intent.status === "failed" && <XCircle className="w-12 h-12" />}
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {intent.status === "success" && "Deposit Successful"}
            {intent.status === "pending" && "Deposit Pending"}
            {intent.status === "expired" && "Session Expired"}
            {intent.status === "failed" && "Deposit Failed"}
          </h2>

          <p className="text-4xl font-black text-slate-900 dark:text-white mt-4 tracking-tighter">
            <span className="text-2xl text-slate-400 mr-1">
              {intent.currency}
            </span>
            {intent.amount.toLocaleString("en-NG", {
              minimumFractionDigits: 2,
            })}
          </p>
        </div>

        <div className="p-8 space-y-8 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Reference
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white font-mono break-all">
                {intent.id}
              </p>
            </div>
            <div className="space-y-1 text-right">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Date
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {new Date(intent.createdAt).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="pt-2">
            <h3 className="text-xs font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest text-center mb-6">
              Transaction Log
            </h3>

            <div className="relative">
              <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-slate-700" />

              <div className="space-y-8 relative z-10">
                {/* Step 1: Initiated */}
                <div className="flex gap-5 items-start">
                  <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 shadow-lg shadow-slate-900/20">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      Request Created
                    </p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {new Date(intent.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      • Origin: Mobile/Web
                    </p>
                  </div>
                </div>

                {/* Step 2: Pending/Action */}
                <div className="flex gap-5 items-start">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 bg-white dark:bg-slate-900 shadow-sm ${
                      intent.status === "success"
                        ? "border-primary text-primary"
                        : intent.status === "pending"
                          ? "border-amber-400 text-amber-500 ring-4 ring-amber-50 dark:ring-amber-900/20"
                          : "border-slate-300 dark:border-slate-700 text-slate-400"
                    }`}
                  >
                    {intent.status === "success" ||
                    intent.status === "failed" ||
                    intent.status === "expired" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    )}
                  </div>
                  <div className="pt-0.5">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {intent.status === "success"
                        ? "Provider Authorized"
                        : "Awaiting Authorization"}
                    </p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      {intent.status === "success"
                        ? "Gateway processing successful"
                        : "Please complete payment with provider"}
                    </p>
                  </div>
                </div>

                {/* Step 3: Success/Fail */}
                {(intent.status === "success" ||
                  intent.status === "failed" ||
                  intent.status === "expired") && (
                  <div className="flex gap-5 items-start">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg ${
                        intent.status === "success"
                          ? "bg-green-500 text-white shadow-green-500/30"
                          : intent.status === "failed"
                            ? "bg-red-500 text-white shadow-red-500/30"
                            : "bg-slate-400 text-white shadow-slate-400/30"
                      }`}
                    >
                      {intent.status === "success" ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <XCircle className="w-5 h-5" />
                      )}
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-black text-slate-900 dark:text-white">
                        {intent.status === "success"
                          ? "Finalized Completed"
                          : intent.status === "expired"
                            ? "Session Timeout"
                            : "Transaction Declined"}
                      </p>
                      <p className="text-xs font-medium text-slate-500 mt-0.5">
                        {intent.status === "success"
                          ? "Funds settled into wallet"
                          : intent.status === "expired"
                            ? "Payment window closed"
                            : "Gateway rejected the payment"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Actions based on status */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            {intent.status === "pending" && (
              <>
                <button
                  onClick={handleContinuePayment}
                  className="w-full py-4 bg-primary text-white font-black uppercase tracking-wider rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
                >
                  <ExternalLink className="w-5 h-5" /> Proceed to Paystack
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleCheckStatus}
                    disabled={checkingStatus}
                    className="flex-[2] py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {checkingStatus ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-5 h-5" />
                    )}
                    Check Status
                  </button>
                  <button
                    onClick={handleCancelPayment}
                    className="flex-1 py-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all border border-red-100 dark:border-red-900/30"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}

            {intent.status === "success" && (
              <div className="flex gap-3">
                <button
                  onClick={() => showToast("info", "Downloading receipt...")}
                  className="flex-1 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all"
                >
                  Download PDF
                </button>
                <button
                  onClick={() => navigate("/wallets")}
                  className="flex-1 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black uppercase tracking-wider rounded-xl hover:opacity-90 transition-all"
                >
                  My Wallets
                </button>
              </div>
            )}

            {(intent.status === "failed" || intent.status === "expired") && (
              <button
                onClick={() => navigate("/fund-wallet")}
                className="w-full py-4 bg-primary text-white font-black uppercase tracking-wider rounded-xl hover:bg-primary-light transition-all flex items-center justify-center gap-2 shadow-xl shadow-primary/20"
              >
                {intent.status === "expired"
                  ? "Generate New Session"
                  : "Retry Payment"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSessionScreen;

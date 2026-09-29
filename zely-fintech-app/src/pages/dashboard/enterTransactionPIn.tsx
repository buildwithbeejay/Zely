import { pinService } from "@/services/pin.services";
import confetti from "canvas-confetti";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Delete,
  Eye,
  EyeOff,
  HelpCircle,
  Key,
  Loader2,
  Lock,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { transactionService } from "../../services/transactionService";

interface TransferState {
  transferType?: "p2p" | "internal";
  sourceId?: string;
  recipient?:
    | {
        name: string;
        accountNumber: string;
        email?: string;
        phone?: string;
      }
    | string;
  amount?: string | number;
  displayAmount?: string;
  sourceAccount?: {
    name: string;
    balance: number;
    currency: string;
  };
}

const EnterTransferPinScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Transfer State from navigation
  const transferData = (location.state as TransferState) || {};

  // Normalize recipient info
  const recipientName =
    typeof transferData.recipient === "object" &&
    transferData.recipient !== null
      ? transferData.recipient.name
      : transferData.recipient || "Zely Recipient";

  const recipientAccount =
    typeof transferData.recipient === "object" &&
    transferData.recipient !== null
      ? transferData.recipient.accountNumber
      : "2049380012";

  const rawAmount = transferData.amount ? String(transferData.amount) : "5000";
  const numericAmount = Number(rawAmount) || 5000;
  const formattedAmount =
    transferData.displayAmount ||
    numericAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 });

  const sourceAccountName =
    transferData.sourceAccount?.name || "Main Checking Account";

  // PIN State
  const [pin, setPin] = useState<string[]>(["", "", "", ""]);
  const [showPin, setShowPin] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "failed"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPinConfigured, setIsPinConfigured] = useState(false);
  const [transactionRef, setTransactionRef] = useState<string>("");

  // Modal States: Setup PIN & Reset PIN (Forgot PIN)
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [setupPinInput, setSetupPinInput] = useState("");
  const [setupConfirmInput, setSetupConfirmInput] = useState("");
  const [isSetupSubmitting, setIsSetupSubmitting] = useState(false);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");
  const [resetOtpSent, setResetOtpSent] = useState(false);
  const [isResetSubmitting, setIsResetSubmitting] = useState(false);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);

  const [transactionFee, setTransactionFee] = useState<number>(0);

  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(
    null,
  );

  const [pinLocked, setPinLocked] = useState(false);
  const [lockedUntilTs, setLockedUntilTs] = useState<Date | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  // Countdown while locked; auto-unlocks the UI when the timer runs out
  useEffect(() => {
    if (!pinLocked || !lockedUntilTs) return;

    const tick = () => {
      const diff = Math.max(
        0,
        Math.ceil((lockedUntilTs.getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(diff);

      if (diff <= 0) {
        setPinLocked(false);
        setLockedUntilTs(null);
        setAttemptsRemaining(null);
        setErrorMessage(null);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [pinLocked, lockedUntilTs]);

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // Refs for individual digit inputs
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Auto-focus first digit on mount
  useEffect(() => {
    if (inputRefs[0].current && isPinConfigured) {
      inputRefs[0].current.focus();
    }
  }, [isPinConfigured]);

  // Handle single digit input
  const handleDigitChange = (index: number, val: string) => {
    if (pinLocked) return;
    const cleanVal = val.replace(/\D/g, "").slice(-1);
    const newPin = [...pin];
    newPin[index] = cleanVal;
    setPin(newPin);
    setErrorMessage(null);

    if (cleanVal && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // If all 4 digits entered, automatically verify
    const combined = newPin.join("");
    if (combined.length === 4 && !newPin.includes("")) {
      submitTransferAuthorization(combined);
    }
  };

  // Handle backspace navigation
  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Handle keypad button click (for mobile/tablet touch users)
  const handleKeypadPress = (val: string) => {
    if (status === "verifying" || status === "success" || pinLocked) return;
    setErrorMessage(null);

    if (val === "clear") {
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
      return;
    }

    if (val === "backspace") {
      // Find last filled index
      let lastFilled = -1;
      for (let i = 3; i >= 0; i--) {
        if (pin[i]) {
          lastFilled = i;
          break;
        }
      }
      if (lastFilled >= 0) {
        const newPin = [...pin];
        newPin[lastFilled] = "";
        setPin(newPin);
        inputRefs[lastFilled].current?.focus();
      }
      return;
    }

    // Find first empty index
    const firstEmpty = pin.findIndex((d) => d === "");
    if (firstEmpty !== -1) {
      const newPin = [...pin];
      newPin[firstEmpty] = val;
      setPin(newPin);

      if (firstEmpty < 3) {
        inputRefs[firstEmpty + 1].current?.focus();
      } else {
        // All 4 filled
        submitTransferAuthorization(newPin.join(""));
      }
    }
  };

  useEffect(() => {
    pinService.isPinSet().then(setIsPinConfigured);
  }, []);

  // Submit Authorization with PIN
  const submitTransferAuthorization = async (pinString: string) => {
    setStatus("verifying");
    setErrorMessage(null);

    try {
      const res = await transactionService.transfer({
        amount: numericAmount,
        accountId: transferData.sourceId || "",
        type: "p2p",
        recipientAccountNumber: recipientAccount,
        pin: pinString, // ← sent to backend, requirePin middleware handles it
      });

      console.log(res);

      const txData = res.status; // ← the actual data is in res.status
      setTransactionRef(txData.transactionRef);
      setTransactionFee(txData.fee ?? 0);

      //   setTransactionRef(
      //     "TRF-" + Math.random().toString(36).substring(2, 10).toUpperCase(),
      //   );
      setStatus("success");
      showToast("success", "Transfer authorized and completed successfully!");

      try {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      } catch {}
    } catch (error: any) {
      console.log(error);
      const data = error.response?.data;
      console.log(data);
      const msg = data?.message || "Authorization failed. Please try again.";

      if (msg === "PIN_NOT_SET") {
        setStatus("idle");
        setIsSetupModalOpen(true);
        return;
      }

      // Lockout details live on the first error's `extension`, not top-level data
      const extension = data?.errors?.[0]?.extension;
      const locked = Boolean(extension?.locked);
      const attemptsLeft =
        typeof extension?.attemptsLeft === "number"
          ? extension.attemptsLeft
          : null;
      const lockedUntilRaw = extension?.lockedUntil;

      setStatus("failed");
      setPin(["", "", "", ""]);

      if (locked) {
        setPinLocked(true);
        setAttemptsRemaining(0);
        setLockedUntilTs(lockedUntilRaw ? new Date(lockedUntilRaw) : null);
        setErrorMessage("Too many incorrect attempts. Your PIN is locked.");
        showToast("error", "PIN locked due to too many failed attempts.");
        return; // don't refocus a disabled input
      }

      setAttemptsRemaining(attemptsLeft);
      setErrorMessage(
        attemptsLeft != null
          ? `Incorrect PIN. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} remaining.`
          : msg,
      );
      showToast("error", msg);
      inputRefs[0].current?.focus();
    }
  };

  // Setup PIN for first-time handler (POST /auth/pin/setup)
  const handleFirstTimeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupPinInput.length !== 4) {
      showToast("error", "PIN must be exactly 4 digits");
      return;
    }
    if (setupPinInput !== setupConfirmInput) {
      showToast("error", "PIN confirmation does not match");
      return;
    }

    setIsSetupSubmitting(true);
    try {
      // CALL POST /auth/pin/setup
      const res = await pinService.setupPin({
        pin: setupPinInput,
        confirmPin: setupConfirmInput,
      });

      showToast("success", res.message || "Transfer PIN configured!");
      setIsPinConfigured(true);
      setIsSetupModalOpen(false);
      setSetupPinInput("");
      setSetupConfirmInput("");
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } catch (err: any) {
      showToast("error", err.message || "Failed to setup PIN");
    } finally {
      setIsSetupSubmitting(false);
    }
  };

  // Request OTP for PIN Reset (POST /auth/pin/reset preparation)
  const handleRequestResetOtp = async () => {
    try {
      const res = await pinService.requestResetOtp();

      console.log(res);
      setResetOtpSent(true);
      showToast("success", res.message);
      setOtpNotice(null);
    } catch (err: any) {
      showToast("error", err.message || "Failed to dispatch reset OTP");
    }
  };

  // Submit PIN Reset with OTP (POST /auth/pin/reset)
  const handleResetPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetOtp.trim().length !== 6) {
      showToast("error", "Enter a valid 6-digit OTP code");
      return;
    }
    if (resetNewPin.length !== 4) {
      showToast("error", "New PIN must be 4 digits");
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      showToast("error", "New PIN confirmation does not match");
      return;
    }

    setIsResetSubmitting(true);
    try {
      // CALL POST /auth/pin/reset
      const res = await pinService.resetPin({
        otp: resetOtp.trim(),
        newPin: resetNewPin,
        confirmPin: resetNewPin,
      });

      showToast("success", res.message || "PIN reset successfully!");
      setIsResetModalOpen(false);
      setResetOtp("");
      setResetNewPin("");
      setResetConfirmPin("");
      setResetOtpSent(false);
      setOtpNotice(null);
      setIsPinConfigured(true);
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } catch (err: any) {
      showToast("error", err.message || "Failed to reset PIN");
    } finally {
      setIsResetSubmitting(false);
    }
  };

  // SUCCESS RECEIPT VIEW
  if (status === "success") {
    return (
      <div className="w-full max-w-lg mx-auto py-4 sm:py-8 px-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden">
          {/* Top Decorative Banner */}
          <div className="absolute top-0 inset-x-0 h-3 bg-gradient-to-r from-emerald-400 via-primary to-emerald-500" />

          <div className="text-center pt-4 pb-6">
            <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/20 animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-widest uppercase px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800">
              Transfer Authorized & Delivered
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-3">
              ₦{formattedAmount}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
              Successfully sent to{" "}
              <span className="font-bold text-slate-900 dark:text-white">
                {recipientName}
              </span>
            </p>
          </div>

          {/* Receipt Details Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 space-y-3.5 mb-6 text-xs sm:text-sm">
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Transaction Reference</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white select-all">
                {transactionRef}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Recipient Identifier</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                {recipientAccount}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Source Account</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {sourceAccountName}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Transfer Fee</span>
              <span
                className={`font-bold ${transactionFee === 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white"}`}
              >
                {transactionFee === 0
                  ? "₦0.00 (Zero Fee)"
                  : `₦${transactionFee.toLocaleString("en-NG", { minimumFractionDigits: 2 })}`}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
              <span>Authorization Method</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">
                4-Digit Transfer PIN
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
              <span>Date & Timestamp</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
                , {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5">
            <button
              onClick={() => navigate("/transfers")}
              className="w-full py-3.5 bg-primary hover:bg-primary-light active:scale-[0.98] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-primary/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Make Another Transfer</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm rounded-xl transition-colors cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto py-4 sm:py-6 px-4 animate-in fade-in duration-300">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate("/transfers", { state: location.state })}
          className="flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Transfer</span>
        </button>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 rounded-full border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-bold">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted PIN Gateway</span>
        </div>
      </div>

      {/* Main Transfer Authorization Card */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden">
        {/* Step Indicator Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Enter Transfer PIN
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1">
            Authorize your peer-to-peer transfer to{" "}
            <span className="font-bold text-slate-900 dark:text-white">
              {recipientName}
            </span>
          </p>
        </div>

        {/* Transfer Summary Badge */}
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                P2P Transfer Amount
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                ₦{formattedAmount}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">
                Recipient Account
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 font-mono truncate block max-w-[140px]">
                {recipientAccount}
              </span>
            </div>
          </div>
        </div>

        {/* Unconfigured PIN Notice */}
        {!isPinConfigured && (
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 mb-6 animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                  No Transfer PIN Configured
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  You need to set up your 4-digit transaction PIN before
                  authorizing peer-to-peer money transfers.
                </p>
                <button
                  type="button"
                  onClick={() => setIsSetupModalOpen(true)}
                  className="mt-3 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Set Up PIN Now (POST /auth/pin/setup)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PIN Input Digits Box */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <label className="text-xs font-mono font-bold uppercase text-slate-400">
              4-Digit Transaction PIN
            </label>
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {showPin ? (
                <EyeOff className="w-3.5 h-3.5" />
              ) : (
                <Eye className="w-3.5 h-3.5" />
              )}
              <span>{showPin ? "Mask PIN" : "Show PIN"}</span>
            </button>
          </div>

          {/* 4 Digit Boxes */}
          <div className="flex justify-center gap-3 sm:gap-4 my-2">
            {[0, 1, 2, 3].map((index) => {
              const isFilled = !!pin[index];
              return (
                <input
                  key={index}
                  ref={inputRefs[index]}
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={pin[index]}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  disabled={status === "verifying" || pinLocked}
                  className={`w-14 h-16 sm:w-16 sm:h-20 text-center text-2xl sm:text-3xl font-mono font-black rounded-2xl border-2 transition-all outline-none ${
                    errorMessage
                      ? "border-red-500 bg-red-50/50 dark:bg-red-950/20 text-red-600 animate-shake"
                      : isFilled
                        ? "border-primary bg-primary/5 text-primary shadow-sm ring-2 ring-primary/20"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:border-primary focus:bg-white dark:focus:bg-slate-900"
                  }`}
                />
              );
            })}
          </div>

          {/* Error Feedback */}
          {pinLocked ? (
            <div className="flex flex-col items-center justify-center gap-1 text-center pt-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                <Lock className="w-4 h-4 shrink-0" />
                <span>
                  PIN locked — try again in {formatCountdown(secondsLeft)}
                </span>
              </div>
            </div>
          ) : (
            errorMessage && (
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 animate-pulse text-center pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )
          )}

          {/* Loading State Indicator */}
          {status === "verifying" && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-bold text-primary animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>
                Authorizing transfer with secure cryptographic token...
              </span>
            </div>
          )}
        </div>

        {/* Responsive On-Screen Numeric Keypad */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-[280px] sm:max-w-[320px] mx-auto">
            {[
              "1",
              "2",
              "3",
              "4",
              "5",
              "6",
              "7",
              "8",
              "9",
              "clear",
              "0",
              "backspace",
            ].map((key) => {
              if (key === "clear") {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress("clear")}
                    disabled={status === "verifying" || pinLocked}
                    className="h-12 sm:h-13 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold font-mono text-slate-600 dark:text-slate-300 transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
                  >
                    CLEAR
                  </button>
                );
              }
              if (key === "backspace") {
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleKeypadPress("backspace")}
                    disabled={status === "verifying" || pinLocked}
                    className="h-12 sm:h-13 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors active:scale-95 flex items-center justify-center cursor-pointer"
                  >
                    <Delete className="w-5 h-5" />
                  </button>
                );
              }
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleKeypadPress(key)}
                  disabled={status === "verifying" || pinLocked}
                  className="h-12 sm:h-13 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-xl font-mono font-bold text-slate-900 dark:text-white border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-95 shadow-sm flex items-center justify-center cursor-pointer"
                >
                  {key}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer Controls: Forgot PIN & Cancel */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => {
              setIsResetModalOpen(true);
              handleRequestResetOtp();
            }}
            className="text-primary hover:text-primary-light font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Forgot Transfer PIN? (Reset with OTP)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate("/transfers", { state: location.state })}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-semibold cursor-pointer"
          >
            Cancel Transfer
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: FIRST-TIME PIN SETUP (POST /auth/pin/setup) */}
      {/* ========================================================================= */}
      {isSetupModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Set Up Transfer PIN
                </h3>
                {/* <p className="text-xs text-slate-500 font-mono">
                  Endpoint: POST /auth/pin/setup
                </p> */}
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Create a secure 4-digit PIN to authorize this transfer and all
              future peer-to-peer payments.
            </p>

            <form onSubmit={handleFirstTimeSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1">
                  Choose 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={setupPinInput}
                  onChange={(e) =>
                    setSetupPinInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="••••"
                  required
                  className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-2xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1">
                  Confirm 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={setupConfirmInput}
                  onChange={(e) =>
                    setSetupConfirmInput(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="••••"
                  required
                  className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-2xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsSetupModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isSetupSubmitting ||
                    setupPinInput.length !== 4 ||
                    setupConfirmInput.length !== 4
                  }
                  className="flex-1 py-3 bg-primary hover:bg-primary-light disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSetupSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Save & Authorize"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FORGOT PIN RESET WITH OTP (POST /auth/pin/reset) */}
      {/* ========================================================================= */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-2xl">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white">
                  Reset Transfer PIN
                </h3>
                {/* <p className="text-xs text-slate-500 font-mono">
                  Endpoint: POST /auth/pin/reset
                </p> */}
              </div>
            </div>

            {otpNotice && (
              <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-3 mb-4 text-xs font-mono text-purple-700 dark:text-purple-300">
                {otpNotice}
              </div>
            )}

            <form onSubmit={handleResetPinSubmit} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-mono font-bold uppercase text-slate-500">
                    6-Digit Verification OTP
                  </label>
                  <button
                    type="button"
                    onClick={handleRequestResetOtp}
                    className="text-[11px] text-primary font-bold hover:underline cursor-pointer"
                  >
                    Resend OTP
                  </button>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={resetOtp}
                  onChange={(e) =>
                    setResetOtp(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="123456"
                  required
                  className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1">
                  New 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={resetNewPin}
                  onChange={(e) =>
                    setResetNewPin(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="••••"
                  required
                  className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-slate-500 mb-1">
                  Confirm New PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  value={resetConfirmPin}
                  onChange={(e) =>
                    setResetConfirmPin(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder="••••"
                  required
                  className="w-full py-3 px-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-primary"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    isResetSubmitting ||
                    resetOtp.length !== 6 ||
                    resetNewPin.length !== 4 ||
                    resetConfirmPin.length !== 4
                  }
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isResetSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Reset & Save PIN"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnterTransferPinScreen;

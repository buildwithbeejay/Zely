import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Database,
  Globe,
  Loader2,
  RefreshCw,
  Shield,
  Terminal,
  Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { authService } from "../../services/auth.services";

const ProvisioningScreen: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  // Account details state once completed
  const [checkingAccount, setCheckingAccount] = useState<string>("");
  const [savingsAccount, setSavingsAccount] = useState<string>("");
  const [copiedType, setCopiedType] = useState<"current" | "savings" | null>(
    null,
  );

  const MAX_POLL_TIME_MS = 3 * 60 * 1000; // 3 minutes
  const pollStartTime = useRef<number>(Date.now());
  const [takingLong, setTakingLong] = useState(false);

  const STOP_POLL_TIME_MS = 5 * 60 * 1000;
  const [stalled, setStalled] = useState(false);

  const getTimestamp = () => {
    return new Date().toTimeString().split(" ")[0];
  };
  const stepRef = useRef(0);
  const runIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failCountRef = useRef(0);
  const [canRetry, setCanRetry] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // const elapsed = Date.now() - pollStartTime.current;
  // if (elapsed > MAX_POLL_TIME_MS) {
  //   setTakingLong(true);
  // }

  const steps = [
    {
      label: "Provisioning Bank Accounts",
      details:
        "Initializing safe master credentials & establishing Current & Savings account schemas",
      icon: Shield,
      status: "ACCOUNT_PROVISION_STARTED",
      percentage: 25,
      logGroup: [
        "ACCOUNT_PROVISION: Creating customer registry records in core banking databases...",
        "CURRENT_ACC_ALLOC: Securing Current Account routing for incoming payments & routing lines...",
        "SAVINGS_ACC_INIT: Standardizing Savings Account schemas for isolated internal goals...",
        "SUCCESS: Secure member credentials and customer accounts successfully linked.",
      ],
    },
    {
      label: "Creating Wallet Accounts",
      details:
        "Deploying digital wallet accounts for multi-currency storage and deposits",
      icon: Database,
      status: "WALLETS_CREATED",
      percentage: 50,
      logGroup: [
        "WALLET_ALLOC: Setting up secure storage balance buffers...",
        "ROUTING: Mapping Current Account numbers to regional wallet recipient tables...",
        "SUCCESS: Wallet accounts allocated and successfully linked to active account registers.",
      ],
    },
    {
      label: "Configuring Bookkeeping Ledgers",
      details:
        "Setting up double-entry bookkeeping ledger accounts for real-time transaction audits",
      icon: Globe,
      status: "LEDGERS_CREATED",
      percentage: 75,
      logGroup: [
        "LEDGER_JOURNAL: Instantiating high-frequency ledger audit and transaction entries...",
        "CONSENSUS: Verifying ledger checkpoints and database indexes across regional gateways...",
        "SUCCESS: General bookkeeping ledger accounts are fully synchronized and online.",
      ],
    },
    {
      label: "Finalizing Dashboard Workspace",
      details:
        "Optimizing core balance sheets and activating your user workspace",
      icon: Zap,
      status: "ACCOUNTS_CREATED",
      percentage: 95,
      logGroup: [
        "STAGING: Packaging safe registry databases, active wallets, and general ledgers...",
        "FINAL_CHECK: Routing test validation query successfully executed.",
        "SUCCESS: Transitioning system environment to Account Ready state.",
      ],
    },
  ];

  // {
  //   takingLong && !error && (
  //     <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl text-center">
  //       <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">
  //         This is taking longer than expected. Your account is still being set
  //         up — you can safely close this page and check back later.
  //       </p>
  //     </div>
  //   );
  // }

  // Handle appending live, simulated retro system logs
  const appendLogs = (newLogs: string[]) => {
    const time = getTimestamp();
    const formatted = newLogs.map((log) => `[${time}] ${log}`);
    setLogs((prev) => [...prev, ...formatted]);
  };

  useEffect(() => {
    if (logsContainerRef.current) {
      logsContainerRef.current.scrollTop =
        logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const copyToClipboard = async (num: string, type: "current" | "savings") => {
    try {
      const cleanNum = num.replace(/\s+/g, "");
      await navigator.clipboard.writeText(cleanNum);
      setCopiedType(type);
      showToast(
        "success",
        `${type === "current" ? "Current (Checking)" : "Savings"} account number copied!`,
      );
      setTimeout(() => setCopiedType(null), 2000);
    } catch (err) {
      console.warn("Clipboard action failed", err);
      showToast("error", "Couldn't copy. Please copy the number manually.");
    }
  };

  const stopPolling = () => {
    runIdRef.current += 1; // invalidates any in-flight tick
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const startPolling = () => {
    stopPolling();
    const runId = runIdRef.current;
    failCountRef.current = 0;
    pollStartTime.current = Date.now();
    setTakingLong(false);
    setLogs([
      `[${getTimestamp()}] SYSTEM: Initializing core account deployment pipelines...`,
      `[${getTimestamp()}] SYSTEM: Connecting bank registry servers for provisioning...`,
    ]);

    const tick = async () => {
      if (runId !== runIdRef.current) return;

      const elapsed = Date.now() - pollStartTime.current;
      if (elapsed > MAX_POLL_TIME_MS) setTakingLong(true);
      if (elapsed > STOP_POLL_TIME_MS) {
        setStalled(true);
        stopPolling();
        return;
      }

      try {
        const data = await authService.getProvisioningStatus();
        if (runId !== runIdRef.current) return; // stale response, ignore
        failCountRef.current = 0;

        if (data.status === "ACCOUNT_READY") {
          stepRef.current = 4;
          setStep(4);
          setCheckingAccount(data.accounts?.checking || "");
          setSavingsAccount(data.accounts?.savings || "");
          appendLogs([
            "SYSTEM: Bank accounts, ledger systems, and wallets active.",
            "ACCOUNT_READY: All configurations successfully deployment-aligned!",
            "ACTIVE: Ready to receive external deposits.",
          ]);
          stopPolling();
          return;
        }

        if (data.failed) {
          setCanRetry(!!data.canRetry);
          setError(true);
          stopPolling();
          return;
        }
      } catch (err: any) {
        if (runId !== runIdRef.current) return;
        failCountRef.current += 1;
        if (failCountRef.current >= 3) {
          const msg = err?.message || "Connection timed out.";
          appendLogs([`CRITICAL_ERROR: ${msg}`]);
          setErrorMessage(msg);
          setError(true);
          stopPolling();
          return;
        }
      }

      timerRef.current = setTimeout(tick, 2000); // next request only after this one finishes
    };

    tick();
  };

  useEffect(() => {
    startPolling();
    return stopPolling;
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    appendLogs([
      "SYSTEM: Re-initializing account database connection pools...",
      "SYSTEM: Retrying secure bank ledger synchronization...",
    ]);
    try {
      await authService.retryProvisioning();
      stepRef.current = 0;
      setStep(0);
      setError(false);
      setErrorMessage("");
      startPolling();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "";
      const wait = msg.match(/RETRY_TOO_SOON_WAIT_(\d+)_SECONDS/);
      showToast(
        "error",
        wait
          ? `Please wait ${wait[1]} seconds before trying again.`
          : msg.includes("MAX_PROVISIONING_RETRIES")
            ? "Maximum retries reached. Please contact support."
            : "Retry failed. Please try again.",
      );
      appendLogs(["ERROR: Retry request was rejected."]);
    } finally {
      setIsRetrying(false);
    }
  };

  const currentStepConfig = steps[step] || steps[3];
  const currentPercentage = step === 4 ? 100 : currentStepConfig.percentage;

  return (
    <div className="h-full w-full bg-slate-50 text-slate-800 flex flex-col items-center py-6 px-4 md:py-12 md:px-8 selection:bg-primary selection:text-white overflow-y-auto relative">
      {/* Ambient Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[150px] pointer-events-none" />

      <div className="w-full max-w-5xl relative z-10">
        {/* Header Title */}
        <div className="text-center md:text-left mb-8 md:mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-semibold text-primary mb-3 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
              LEDGER STATUS: {step === 4 ? "SYNC COMPLETED" : "SYNCHRONIZING"}
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              {step === 4
                ? "Ledger Accounts Created!"
                : "Deploying Ledger Infrastructure"}
            </h1>
            <p className="text-slate-500 text-sm md:text-base mt-1.5 max-w-xl">
              We are configuring your Current account (for receiving deposits)
              and Savings account (for internal goals), and initializing digital
              wallet endpoints with active bookkeeping ledgers.
            </p>
          </div>
          <div className="text-xs font-mono text-slate-400 hidden md:block">
            PROVISION_REVISION: v5.02 // PROTOCOL: BANKING_CORE_V1
          </div>
        </div>

        {takingLong && !error && step !== 4 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl text-center">
            <p className="text-sm font-semibold text-yellow-700">
              This is taking longer than expected. Your account is still being
              set up. You can safely close this page and check back later.
            </p>
            {stalled && (
              <button
                onClick={startPolling}
                className="mt-3 px-4 py-2 bg-slate-900 text-white text-sm font-bold rounded-xl"
              >
                Check again
              </button>
            )}
          </div>
        )}
        {!error ? (
          step === 4 ? (
            // ACCOUNT READY SUCCESS STATE (Modern high-contrast white card)
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/50 animate-in fade-in zoom-in-95 duration-500">
              {/* Celebratory Icon */}
              <div className="w-20 h-20 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-emerald-100/30">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>

              <div className="text-center mb-8">
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">
                  Your Accounts are Ready!
                </h2>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  Your transaction general ledgers, secure wallet records, and
                  customized bank accounts are live.
                </p>
              </div>

              {/* Account Number Display */}
              <div className="space-y-4 mb-8">
                {/* Current Account Card */}
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-300 transition duration-300 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-[#0066cc] uppercase font-mono bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-full">
                        Current Account
                      </span>
                      <p className="text-xs text-slate-500 mt-1.5 font-medium">
                        Used for receiving external payments and deposits
                      </p>
                    </div>
                    <span className="text-emerald-700 text-xs font-semibold flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-xl border border-slate-200 shadow-inner">
                    <div className="font-mono text-lg md:text-xl font-bold tracking-wider text-slate-800">
                      {checkingAccount}
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(checkingAccount, "current")
                      }
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
                      title="Copy Account Number"
                    >
                      {copiedType === "current" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Savings Account Card */}
                <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl relative overflow-hidden group hover:border-slate-300 transition duration-300 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="text-[10px] font-bold tracking-widest text-slate-600 uppercase font-mono bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                        Savings Account
                      </span>
                      <p className="text-xs text-slate-500 mt-1.5 font-medium">
                        Used for internal savings goals and reserves access
                      </p>
                    </div>
                    <span className="text-slate-500 text-xs font-semibold flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Internal Only
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-xl border border-slate-200 shadow-inner">
                    <div className="font-mono text-lg md:text-xl font-bold tracking-wider text-slate-800">
                      {savingsAccount}
                    </div>
                    <button
                      onClick={() => copyToClipboard(savingsAccount, "savings")}
                      className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-slate-900 rounded-lg transition"
                      title="Copy Account Number"
                    >
                      {copiedType === "savings" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Informational Hint */}
              <div className="bg-slate-100/60 border border-slate-200 p-4 rounded-2xl text-center mb-8">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Kindly share your{" "}
                  <strong className="text-slate-800">
                    Current Account number
                  </strong>{" "}
                  with external senders to receive payments directly into your
                  account balance.
                </p>
              </div>

              {/* Go to Dashboard CTA */}
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full flex items-center justify-center gap-2 py-4 bg-slate-900 hover:bg-slate-850 text-white font-extrabold rounded-2xl hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 shadow-lg shadow-slate-900/10 text-base cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <Zap className="w-5 h-5 fill-current" />
              </button>
            </div>
          ) : (
            // Beautiful Main Grid (Symmetric 2-column Layout on Desktop, Staged Flow on Mobile)
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Column 1: Central Orbital Loader Card */}
              <div className="lg:col-span-12 xl:col-span-5 bg-white border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden group">
                {/* Inner Circle Glow */}
                <div className="absolute inset-0 bg-radial-gradient from-primary/5 to-transparent opacity-50 pointer-events-none" />

                {/* Circular SVG Progress Ring */}
                <div className="relative w-44 h-44 md:w-52 md:h-52 flex items-center justify-center mb-6">
                  <svg className="w-full h-full transform -rotate-90">
                    {/* Track */}
                    <circle
                      cx="50%"
                      cy="50%"
                      r="43%"
                      className="stroke-slate-100 fill-transparent"
                      strokeWidth="8"
                    />
                    {/* Active Progress */}
                    <circle
                      cx="50%"
                      cy="50%"
                      r="43%"
                      pathLength={100}
                      className="stroke-primary fill-transparent transition-all duration-1000 ease-in-out"
                      strokeWidth="8"
                      strokeDasharray="100"
                      strokeDashoffset={100 - currentPercentage}
                      strokeLinecap="round"
                    />
                  </svg>

                  <div className="absolute flex flex-col items-center justify-center font-sans">
                    <div className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 font-mono">
                      {currentPercentage}%
                    </div>
                    <div className="text-[10px] md:text-xs font-bold text-slate-400 tracking-wider uppercase mt-1 font-mono">
                      Progress
                    </div>
                  </div>

                  {/* Animated Orbital Dot */}
                  <div className="absolute w-full h-full animate-spin [animation-duration:8s]">
                    <div className="absolute top-2 left-1/2 -ml-2.5 w-5 h-5 bg-primary/20 border-2 border-primary rounded-full shadow-md shadow-primary/30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Current Active Step Heading */}
                <div className="relative z-10 mt-2">
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                    {currentStepConfig.label}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    {currentStepConfig.details}
                  </p>
                </div>

                {/* Interactive Core Ledger Mesh */}
                <div className="w-full grid grid-cols-4 gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl mt-8 relative z-10 shadow-inner">
                  {[0, 1, 2, 3].map((nodeIdx) => {
                    const isDone = step > nodeIdx;
                    const isCurrent = step === nodeIdx;
                    const nodeLabels = ["ACC", "WLT", "LDG", "DSH"];
                    return (
                      <div key={nodeIdx} className="flex flex-col items-center">
                        <div
                          className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${isDone ? "bg-emerald-500 shadow-sm" : isCurrent ? "bg-primary shadow-sm animate-pulse" : "bg-slate-200"}`}
                        />
                        <span className="text-[10px] font-bold font-mono text-slate-400 mt-2">
                          {nodeLabels[nodeIdx]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Steps Detail List + Realtime Console Logs */}
              <div className="lg:col-span-12 xl:col-span-7 flex flex-col gap-6">
                {/* Realtime Terminal Console Output Logs */}
                <div className="bg-[#0b1329] border border-slate-800 rounded-3xl p-5 flex flex-col h-64 md:h-72 relative shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold font-mono tracking-wider text-slate-200">
                        PROVISIONING SYSTEM CONSOLE
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                      <span className="text-[10px] font-bold font-mono text-slate-400">
                        LIVE FEED
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Log Entries */}
                  <div
                    ref={logsContainerRef}
                    className="flex-1 overflow-y-auto space-y-2 font-mono text-xs pr-1 text-slate-300"
                  >
                    {logs.map((log, lIdx) => (
                      <div
                        key={lIdx}
                        className="leading-relaxed whitespace-pre-wrap text-[#cbd5e1]"
                      >
                        <span className="text-slate-500 mr-2 font-bold">
                          &gt;
                        </span>
                        {log}
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-primary mt-1">
                      <span className="text-slate-500 font-bold">&gt;</span>
                      <span>
                        Configuring secure bank transmission channels...
                      </span>
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    </div>
                  </div>
                </div>

                {/* Status Steps Dashboard Checklist */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 md:p-6 shadow-sm">
                  <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400 mb-4 px-1 font-mono">
                    Banking Deployment Pipeline
                  </h4>
                  <div className="space-y-3.5">
                    {steps.map((s, idx) => {
                      const StepIcon = s.icon;
                      const isDone = step > idx;
                      const isCurrent = step === idx;

                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-500 ${
                            isDone
                              ? "bg-emerald-50/50 border-emerald-100 text-slate-800"
                              : isCurrent
                                ? "bg-slate-50 border-primary/30 shadow-sm shadow-primary/5 text-slate-950"
                                : "bg-transparent border-transparent opacity-45"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                                isDone
                                  ? "bg-emerald-100 text-emerald-600 animate-in fade-in duration-300"
                                  : isCurrent
                                    ? "bg-primary text-white"
                                    : "bg-slate-100 text-slate-400"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-5 h-5" />
                              ) : (
                                <StepIcon className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p
                                className={`text-sm font-bold ${isDone ? "text-emerald-800" : isCurrent ? "text-slate-900" : "text-slate-500"}`}
                              >
                                {s.label}
                              </p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {s.details}
                              </p>
                            </div>
                          </div>

                          {isCurrent && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold font-mono text-primary animate-pulse">
                                DEPLOYING
                              </span>
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : (
          // High-Tech Immersive Alignment Error View (Light version)
          <div className="max-w-2xl mx-auto bg-white border border-red-200 rounded-[2rem] p-8 text-center shadow-xl shadow-red-50/50 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-red-50 border border-red-200 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-md shadow-red-100/40 animate-pulse">
              <AlertCircle className="w-10 h-10" />
            </div>

            <h2 className="text-2xl font-black mb-3 text-slate-900 tracking-tight">
              {canRetry
                ? "Account Setup Hit a Problem"
                : "We Couldn't Finish Setting Up"}
            </h2>
            <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
              {canRetry
                ? "Something went wrong while setting up your accounts. Your personal information remains secure. Please try again."
                : "We've tried several times without success. Please contact support and we'll get this sorted out for you."}
            </p>

            {errorMessage && (
              <div className="max-w-lg mx-auto bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-8 text-left font-mono text-[11px] text-slate-500 shadow-inner">
                <p className="text-red-600 font-bold mb-1">Details</p>
                <p>{errorMessage}</p>
              </div>
            )}

            {canRetry ? (
              <button
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center justify-center gap-2 px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-slate-900/10 w-full sm:w-auto"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Retrying...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    <span>Try Again</span>
                  </>
                )}
              </button>
            ) : (
              <p className="text-sm font-semibold text-slate-700">
                Please contact support with your registered email.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProvisioningScreen;

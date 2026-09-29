import { pinService } from "@/services/pin.services";
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  Coins,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Key,
  Laptop,
  Lock,
  LogOut,
  Moon,
  Shield,
  ShieldAlert,
  Smartphone,
  Sun,
  Trash2,
  User,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../context/ToastContext";

import axiosPrivate from "@/api/client";
import { authService } from "@/services/auth.services";
import { sessionService, UserSession } from "@/services/session.service";
import { useAsync } from "../../hooks/useAsync";
import { kycService } from "../../services/kycService";
import { KYCStatusResponse } from "../../types";
import { handleLogout as apiLogout } from "../../utils/api";

const SettingsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { auth, setAuth } = useAuth();
  const { showToast } = useToast();

  const [isPinSet, setIsPinSet] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileName, setProfileName] = useState(auth.user?.name ?? "");
  const [profileEmail] = useState(auth.user?.email ?? "");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileCity, setProfileCity] = useState("");

  // Security & Password State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordLastChanged, setPasswordLastChanged] = useState(
    localStorage.getItem("zely_pw_changed") || "2 months ago",
  );
  const [otpSent, setOtpSent] = useState(false);

  // Transaction PIN State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalMode, setPinModalMode] = useState<
    "setup" | "change" | "reset"
  >("change");
  const [pinAuthMethod, setPinAuthMethod] = useState<"password" | "otp">(
    "password",
  );

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinAuthPassword, setPinAuthPassword] = useState("");
  const [pinAuthOtp, setPinAuthOtp] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetNewPin, setResetNewPin] = useState("");
  const [resetConfirmPin, setResetConfirmPin] = useState("");
  const [isPinSubmitting, setIsPinSubmitting] = useState(false);

  // Active Device Sessions States
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [confirmKillAllOpen, setConfirmKillAllOpen] = useState(false);
  const [confirmKillSingleId, setConfirmKillSingleId] = useState<string | null>(
    null,
  );
  const [reauthModalMode, setReauthModalMode] = useState<
    "single" | "all" | null
  >(null);
  const [sessionToKill, setSessionToKill] = useState<UserSession | null>(null);
  const [reauthPassword, setReauthPassword] = useState("");
  const [showReauthPassword, setShowReauthPassword] = useState(false);
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [isReauthSubmitting, setIsReauthSubmitting] = useState(false);

  const [passwordCooldownUntil, setPasswordCooldownUntil] = useState<
    number | null
  >(null);

  const [passwordCooldown, setPasswordCooldown] = useState(0);

  const [resetOtpSent, setResetOtpSent] = useState(false);

  // Preferences
  const [pushNotifications, setPushNotifications] = useState(
    () => localStorage.getItem("zely_push_notif") !== "false",
  );
  const [emailNotifications, setEmailNotifications] = useState(
    () => localStorage.getItem("zely_email_notif") !== "false",
  );
  const [darkMode, setDarkMode] = useState(() => {
    return (
      document.documentElement.classList.contains("dark") ||
      localStorage.getItem("zely_dark_mode") === "true"
    );
  });

  // Account Freeze State
  const [isAccountFrozen, setIsAccountFrozen] = useState(
    () => localStorage.getItem("zely_account_frozen") === "true",
  );
  const [isFreezeModalOpen, setIsFreezeModalOpen] = useState(false);

  useEffect(() => {
    pinService.isPinSet().then(setIsPinSet);
  }, []);

  const { data: kycStatus, execute: fetchKycStatus } =
    useAsync<KYCStatusResponse>(kycService.getMyStatus);

  useEffect(() => {
    fetchKycStatus().catch(() => {});
  }, [fetchKycStatus]);

  // Active Category Tab
  const [activeTab, setActiveTab] = useState<
    "all" | "account" | "security" | "preferences"
  >("all");

  // Profile State
  useEffect(() => {
    authService.getProfile().then((res) => {
      setProfileName(res.data.name ?? "");
      setProfilePhone(res.data.phone ?? "");
      setProfileAddress(res.data.address ?? "");
      if (res.data.passwordChangedAt) {
        const date = new Date(res.data.passwordChangedAt);
        const diffDays = Math.floor(
          (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
        );
        setPasswordLastChanged(
          diffDays === 0
            ? "Today"
            : diffDays === 1
              ? "Yesterday"
              : `${diffDays} days ago`,
        );
      }
    });
  }, []);

  useEffect(() => {
    if (!passwordCooldownUntil) {
      setPasswordCooldown(0);
      return;
    }

    const updateCooldown = () => {
      const remaining = Math.max(
        0,
        Math.ceil((passwordCooldownUntil - Date.now()) / 1000),
      );

      setPasswordCooldown(remaining);

      if (remaining === 0) {
        setPasswordCooldownUntil(null);
      }
    };

    updateCooldown();

    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [passwordCooldownUntil]);

  // Initial session load & auto-registration
  const loadUserSessions = async () => {
    try {
      const data = await sessionService.getSessions();
      setSessions(data);
      const current = data.find((s) => s.isCurrent);
      if (current) setCurrentSessionId(current.sessionId);
    } catch {
      showToast("error", "Failed to load sessions.");
    }
  };

  useEffect(() => {
    loadUserSessions();
  }, []);

  // Derived session counts
  const otherSessions = useMemo(() => {
    return sessions.filter((s) => !s.isCurrent);
  }, [sessions]);

  const otherSessionsCount = otherSessions.length;

  // Handle dark mode toggle on root element
  const handleToggleDarkMode = (enabled: boolean) => {
    setDarkMode(enabled);
    localStorage.setItem("zely_dark_mode", enabled ? "true" : "false");
    if (enabled) {
      document.documentElement.classList.add("dark");
      showToast("info", "Dark appearance enabled");
    } else {
      document.documentElement.classList.remove("dark");
      showToast("info", "Light appearance enabled");
    }
  };

  const handleOpenPinModal = (mode?: "setup" | "change" | "reset") => {
    setPinModalMode(mode || (isPinSet ? "change" : "setup"));
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
    setPinAuthPassword("");
    setPinAuthOtp("");
    setResetOtp("");
    setResetNewPin("");
    setResetConfirmPin("");
    setIsPinModalOpen(true);
  };

  const handleTogglePushNotifications = (val: boolean) => {
    setPushNotifications(val);
    localStorage.setItem("zely_push_notif", val ? "true" : "false");
    showToast(
      "success",
      val ? "Push notifications activated" : "Push notifications silenced",
    );
  };

  const handleToggleEmailNotifications = (val: boolean) => {
    setEmailNotifications(val);
    localStorage.setItem("zely_email_notif", val ? "true" : "false");
    showToast(
      "success",
      val ? "Email transaction receipts enabled" : "Email notifications paused",
    );
  };

  // Profile Update Handler
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      showToast("error", "Name cannot be empty.");
      return;
    }
    try {
      await authService.updateProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        address: profileAddress.trim(),
      });
      setAuth((prev) => ({
        ...prev,
        user: prev.user
          ? { ...prev.user, name: profileName.trim() }
          : prev.user,
      }));
      showToast("success", "Profile updated successfully!");
      setIsProfileModalOpen(false);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to update profile.",
      );
    }
  };

  const formatCooldown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordCooldown > 0) {
      return;
    }

    if (!currentPassword) {
      showToast("error", "Please enter your current password.");
      return;
    }

    if (newPassword.length < 8) {
      showToast("error", "New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast("error", "Passwords do not match.");
      return;
    }

    try {
      await axiosPrivate.post("/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordModalOpen(false);

      showToast("success", "Password changed successfully.");
    } catch (err: any) {
      const error = err.response?.data?.error;

      if (error?.code === "RATE_LIMIT_EXCEEDED") {
        const retryAfter = Number(error.retryAfter);

        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          setPasswordCooldownUntil(Date.now() + retryAfter * 1000);
        }

        const minutes = Math.floor(retryAfter / 60);
        const seconds = retryAfter % 60;

        const timeRemaining =
          minutes > 0
            ? `${minutes} minute${minutes !== 1 ? "s" : ""}${
                seconds > 0
                  ? ` ${seconds} second${seconds !== 1 ? "s" : ""}`
                  : ""
              }`
            : `${seconds} second${seconds !== 1 ? "s" : ""}`;

        showToast(
          "error",
          `Too many password change attempts. Please try again in ${timeRemaining}.`,
        );

        return;
      }

      showToast("error", error?.message || "Failed to change password.");
    }
  };

  const handleSetupPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length < 4) {
      showToast("error", "PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      showToast("error", "PIN confirmation does not match.");
      return;
    }
    setIsPinSubmitting(true);
    try {
      await pinService.setupPin({ pin: newPin, confirmPin });
      setIsPinSet(true);
      setIsPinModalOpen(false);
      setNewPin("");
      setConfirmPin("");
      showToast("success", "Transaction PIN set successfully.");
    } catch (err: any) {
      showToast("error", err.response?.data?.message || "Failed to setup PIN.");
    } finally {
      setIsPinSubmitting(false);
    }
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPin.length < 4) {
      showToast("error", "Enter your current PIN.");
      return;
    }
    if (newPin.length < 4) {
      showToast("error", "New PIN must be at least 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      showToast("error", "PIN confirmation does not match.");
      return;
    }
    setIsPinSubmitting(true);
    try {
      await pinService.changePin({
        currentPin,
        newPin,
        confirmNewPin: confirmPin,
        authType: pinAuthMethod,
        ...(pinAuthMethod === "password"
          ? { password: pinAuthPassword }
          : { otp: pinAuthOtp }),
      });
      setIsPinModalOpen(false);
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      showToast("success", "Transaction PIN changed successfully.");
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to change PIN.",
      );
    } finally {
      setIsPinSubmitting(false);
    }
  };

  // const handleRequestOtp = async (_purpose?: "change" | "reset") => {
  //   try {
  //     await pinService.requestResetOtp();
  //     showToast("success", "OTP sent to your email.");
  //   } catch {
  //     showToast("error", "Failed to send OTP.");
  //   }
  // };

  const handleResetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetOtp.trim().length < 6) {
      showToast("error", "Enter a valid 6-digit OTP.");
      return;
    }
    if (resetNewPin.length < 4) {
      showToast("error", "New PIN must be at least 4 digits.");
      return;
    }
    if (resetNewPin !== resetConfirmPin) {
      showToast("error", "PIN confirmation does not match.");
      return;
    }
    setIsPinSubmitting(true);
    try {
      await pinService.resetPin({
        otp: resetOtp.trim(),
        newPin: resetNewPin,
        confirmPin: resetConfirmPin,
      });
      setIsPinSet(true);
      setIsPinModalOpen(false);
      setResetOtp("");
      setResetNewPin("");
      setResetConfirmPin("");
      showToast("success", "PIN reset successfully.");
    } catch (err: any) {
      showToast("error", err.response?.data?.message || "Failed to reset PIN.");
    } finally {
      setIsPinSubmitting(false);
    }
  };

  // Account Freeze Handler
  const handleToggleAccountFreeze = () => {
    const nextState = !isAccountFrozen;
    setIsAccountFrozen(nextState);
    localStorage.setItem("zely_account_frozen", nextState ? "true" : "false");
    setIsFreezeModalOpen(false);
    if (nextState) {
      showToast(
        "warning",
        "Account is now FROZEN. Outgoing transfers and wallet debits are paused.",
      );
    } else {
      showToast(
        "success",
        "Account unfrozen. Full transfer and withdrawal capabilities restored.",
      );
    }
  };

  const handleKillSingleSession = async (sessionId: string) => {
    try {
      await sessionService.killSession(sessionId);
      showToast("success", "Session terminated.");
      await loadUserSessions();
      setConfirmKillSingleId(null);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to terminate session.",
      );
    }
  };

  const handleKillAllOthers = async () => {
    try {
      await sessionService.killAllOtherSessions();
      showToast("success", "All other sessions terminated.");
      await loadUserSessions();
      setConfirmKillAllOpen(false);
    } catch (err: any) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to terminate sessions.",
      );
    }
  };

  // Session Management & Password Re-Authentication Handlers
  const handleOpenSessionsModal = () => {
    loadUserSessions();
    setIsSessionsModalOpen(true);
  };

  const handleOpenKillSingle = (sess: UserSession) => {
    setSessionToKill(sess);
    setReauthModalMode("single");
    setReauthPassword("");
    setReauthError(null);
    setShowReauthPassword(false);
  };

  const handleOpenKillAll = () => {
    setSessionToKill(null);
    setReauthModalMode("all");
    setReauthPassword("");
    setReauthError(null);
    setShowReauthPassword(false);
  };

  const handleCloseReauthModal = () => {
    setReauthModalMode(null);
    setSessionToKill(null);
    setReauthPassword("");
    setReauthError(null);
    setShowReauthPassword(false);
    setIsReauthSubmitting(false);
  };

  const handleConfirmReauthKill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!reauthPassword.trim()) {
      setReauthError(
        "Please enter your account password to authorize session revocation.",
      );
      return;
    }

    setIsReauthSubmitting(true);
    setReauthError(null);

    try {
      if (reauthModalMode === "single" && sessionToKill) {
        const res = await sessionService.killSessionWithPassword(
          sessionToKill.id,
          reauthPassword,
          profileEmail,
        );
        showToast(
          "success",
          res.message ||
            `${sessionToKill.browser} on ${sessionToKill.device} session terminated.`,
        );
        loadUserSessions();
        handleCloseReauthModal();
      } else if (reauthModalMode === "all") {
        const currId = currentSessionId || sessionService.getCurrentSessionId();
        if (!currId) {
          throw new Error("Current session token not identified.");
        }
        const res = await sessionService.killAllOtherSessionsWithPassword(
          profileEmail,
          currId,
          reauthPassword,
        );
        showToast(
          "success",
          res.message ||
            "All other active sessions have been terminated. Current device remains active.",
        );
        loadUserSessions();
        handleCloseReauthModal();
      }
    } catch (err: any) {
      setReauthError(
        err.message || "Authentication failed. Please verify your password.",
      );
      showToast("error", err.message || "Password re-authentication failed");
    } finally {
      setIsReauthSubmitting(false);
    }
  };

  const handleLogout = () => {
    apiLogout();
    showToast("success", "Logged out successfully");
    navigate("/login");
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-300 pb-16">
      {/* Header Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Settings & Security
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-medium mt-1 leading-relaxed">
            Manage your profile, cryptographic authorization, active device
            sessions, and preferences.
          </p>
        </div>

        {isAccountFrozen && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 text-xs font-bold font-mono self-start sm:self-auto shrink-0">
            <AlertTriangle className="w-4 h-4 animate-bounce shrink-0" />
            <span>ACCOUNT CURRENTLY FROZEN</span>
          </div>
        )}
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar border-b border-slate-100 dark:border-slate-800/60">
        {[
          { id: "all", label: "All Settings" },
          { id: "account", label: "Profile & Limits" },
          { id: "security", label: "Security & Sessions" },
          { id: "preferences", label: "Preferences" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 min-h-[38px] cursor-pointer ${
              activeTab === tab.id
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* 1. PROFILE & KYC SECTION */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "account") && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Profile & Verification
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {/* Profile Information Item */}
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                  <User className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-purple-600 transition-colors truncate">
                      Profile Information
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 break-words line-clamp-1 sm:line-clamp-none">
                    {profileName} • {profilePhone} • {profileEmail}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                <span>Edit Details</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* KYC Tier & Limit Item */}
            <div
              onClick={() => navigate("/kyc")}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <Shield className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors truncate">
                      KYC Verification & Account Limits
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
                      {kycStatus?.currentTier === "TIER_3"
                        ? "Tier 3 Verified"
                        : kycStatus?.currentTier === "TIER_2"
                          ? "Tier 2 Verified"
                          : "Tier 1"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    {kycStatus?.currentTier === "TIER_3"
                      ? "Unlimited transfers • All features unlocked"
                      : kycStatus?.currentTier === "TIER_2"
                        ? "Daily Transfer Limit: ₦500,000.00 • Upgrade to Tier 3 for unlimited transfers"
                        : "Daily Transfer Limit: ₦200,000.00 • Upgrade to Tier 2 for higher limits"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                <span>View Limits</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SECURITY & SESSIONS SECTION */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "security") && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Security & Authentication
            </h2>
            <span className="text-[10px] font-mono font-semibold text-slate-500">
              Multi-Factor Audit Ready
            </span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {/* Change Password Item */}
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(true);
              }}
              className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Lock className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      Change Password
                    </h3>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Last changed: {passwordLastChanged} • Protected by Argon2id
                    cryptographic hashing
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                <span>Update</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </button>
            {/* Transaction PIN Item */}
            <div
              onClick={() => handleOpenPinModal()}
              className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold shrink-0">
                  <Key className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                      4-Digit Transaction PIN
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold shrink-0 ${isPinSet ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400" : "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400"}`}
                    >
                      {isPinSet ? "PIN Active" : "Not Configured"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    Required for authorizing outgoing transfers, savings
                    lockups, and wallet debits
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/40">
                <span>{isPinSet ? "Change PIN" : "Set PIN"}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
            {/* Active Sessions Item with Direct Kill Action */}
            <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
              <div
                onClick={handleOpenSessionsModal}
                className="flex items-start sm:items-center gap-3 sm:gap-4 cursor-pointer flex-1 min-w-0"
              >
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-rose-600 transition-colors">
                      Active Device Sessions
                    </h3>
                    {otherSessionsCount > 0 ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-400 font-bold shrink-0">
                        {otherSessionsCount} Other Session
                        {otherSessionsCount > 1 ? "s" : ""} Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold shrink-0">
                        Only This Device Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    {otherSessionsCount > 0
                      ? `Current device session safe. You have ${otherSessionsCount} other active session(s) you can terminate instantly.`
                      : "No other active device sessions detected. All unauthorized access points terminated."}
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/40">
                {otherSessionsCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmKillAllOpen(true);
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 min-h-[40px] bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm shadow-red-600/20 flex items-center justify-center gap-1.5 cursor-pointer"
                    title="Kill all sessions except this current device"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kill Other Sessions</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleOpenSessionsModal}
                  className="w-full sm:w-auto px-4 py-2.5 min-h-[40px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <span>Manage Sessions</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. PREFERENCES SECTION */}
      {/* ========================================================================= */}
      {(activeTab === "all" || activeTab === "preferences") && (
        <div className="space-y-3 sm:space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">
              Preferences & Display
            </h2>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {/* Base Display Currency: Fixed in Naira */}
            <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-lg font-mono shrink-0">
                  ₦
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Base Display Currency
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                      Nigerian Naira (NGN - ₦)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                    All ledger balances, savings portfolios, wallet transfers,
                    and receipts are denominated in Nigerian Naira (₦).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold w-fit self-start sm:self-auto shrink-0">
                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                <span>NGN (₦)</span>
              </div>
            </div>

            {/* Dark Mode Toggle */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-purple-400" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Dark Mode Appearance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    High-contrast dark theme optimized for low-light environment
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle Dark Mode"
                onClick={() => handleToggleDarkMode(!darkMode)}
                className={`w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors relative cursor-pointer shrink-0 min-w-[48px] ${darkMode ? "bg-purple-600" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-sm transition-transform ${darkMode ? "translate-x-6 sm:translate-x-7" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Push Notifications Toggle */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Push Notifications
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Immediate device alerts for inward deposits and security
                    challenges
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle Push Notifications"
                onClick={() =>
                  handleTogglePushNotifications(!pushNotifications)
                }
                className={`w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors relative cursor-pointer shrink-0 min-w-[48px] ${pushNotifications ? "bg-purple-600" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-sm transition-transform ${pushNotifications ? "translate-x-6 sm:translate-x-7" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Email Statements & Receipts Toggle */}
            <div className="p-4 sm:p-5 flex items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Email Transaction Receipts
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                    Receive automated cryptographic receipts and monthly
                    statements
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Toggle Email Notifications"
                onClick={() =>
                  handleToggleEmailNotifications(!emailNotifications)
                }
                className={`w-12 h-6 sm:w-14 sm:h-7 rounded-full transition-colors relative cursor-pointer shrink-0 min-w-[48px] ${emailNotifications ? "bg-purple-600" : "bg-slate-200 dark:bg-slate-700"}`}
              >
                <span
                  className={`absolute top-1 left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-sm transition-transform ${emailNotifications ? "translate-x-6 sm:translate-x-7" : "translate-x-0"}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SECURITY CONTROL & ACCOUNT ACTIONS (DANGER ZONE) */}
      {/* ========================================================================= */}
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-red-500">
            Security Control & Account Actions
          </h2>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-950/60 divide-y divide-red-50 dark:divide-red-950/30 overflow-hidden shadow-sm">
          {/* Freeze Account Toggle */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-red-600 dark:text-red-400 truncate">
                  {isAccountFrozen
                    ? "Unfreeze Account"
                    : "Emergency Freeze Account"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                  {isAccountFrozen
                    ? "Account is paused. Click to restore outgoing transfers and card payments."
                    : "Immediately halt all outgoing wallet transfers, savings withdrawals, and transactions."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsFreezeModalOpen(true)}
              className={`w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                isAccountFrozen
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20"
                  : "bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900"
              }`}
            >
              {isAccountFrozen ? "Unfreeze Account" : "Freeze Account"}
            </button>
          </div>

          {/* Log Out Button */}
          <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 sm:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold shrink-0 mt-0.5 sm:mt-0">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  Sign Out
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-normal">
                  Sign out of your Zely account on this device.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0"
            >
              Log Out
            </button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 font-mono py-2">
        Zely Fintech Platform v2.4.0 · Append-Only Financial Ledger Engine
      </p>

      {/* ========================================================================= */}
      {/* MODAL 1: PROFILE INFORMATION MODAL */}
      {/* ========================================================================= */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col my-auto max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95">
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-purple-100 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 rounded-xl">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Edit Profile Information
                  </h3>
                  <p className="text-xs text-slate-500">
                    Update your verified personal details and contact points
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveProfile}
              className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  Full Legal Name
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-purple-600 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  Email Address
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  disabled
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                />
                <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                  Primary login identifier cannot be edited without KYC
                  verification
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  required
                  className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-purple-600 transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    Address
                  </label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    City / State
                  </label>
                  <input
                    type="text"
                    value={profileCity}
                    onChange={(e) => setProfileCity(e.target.value)}
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-purple-600 transition-colors"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl bg-purple-600 hover:bg-purple-700 font-bold text-xs sm:text-sm text-white shadow-md shadow-purple-600/20 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: PASSWORD UPDATE MODAL */}
      {/* ========================================================================= */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl my-auto">
            {/* HEADER */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-xl">
                  <Lock className="w-5 h-5" />
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Change Password
                  </h3>

                  <p className="text-xs text-slate-500">
                    Update your account authentication credentials
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* FORM */}
            <form
              onSubmit={handleUpdatePassword}
              className="p-4 sm:p-6 space-y-4 overflow-y-auto"
            >
              {/* CURRENT PASSWORD */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  Current Password
                </label>

                <div className="relative">
                  <input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-600 transition-colors"
                  />

                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showCurrentPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* NEW PASSWORD */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  New Password
                </label>

                <div className="relative">
                  <input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-600 transition-colors"
                  />

                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showNewPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* CONFIRM PASSWORD */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                  Confirm New Password
                </label>

                <div className="relative">
                  <input
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3.5 sm:px-4 py-2.5 sm:py-3 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-600 transition-colors"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPw(!showConfirmPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                  >
                    {showConfirmPw ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* PASSWORD REQUIREMENTS */}
              <div className="text-[11px] text-slate-500 font-mono space-y-1">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      newPassword.length >= 8
                        ? "text-emerald-500"
                        : "text-slate-300"
                    }`}
                  />
                  <span>At least 8 characters</span>
                </div>

                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <Check
                    className={`w-3.5 h-3.5 ${
                      /[0-9]/.test(newPassword)
                        ? "text-emerald-500"
                        : "text-slate-300"
                    }`}
                  />
                  <span>At least one number</span>
                </div>
              </div>

              {/* COOLDOWN */}
              {passwordCooldown > 0 && (
                <div
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40"
                  aria-live="polite"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Password change temporarily locked
                    </p>

                    <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-0.5">
                      Too many attempts. Please wait before trying again.
                    </p>
                  </div>

                  <span className="shrink-0 font-mono text-sm font-black text-amber-700 dark:text-amber-400 tabular-nums">
                    {formatCooldown(passwordCooldown)}
                  </span>
                </div>
              )}

              {/* BUTTONS */}
              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={passwordCooldown > 0}
                  className={`w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors ${
                    passwordCooldown > 0
                      ? "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none"
                      : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20 cursor-pointer"
                  }`}
                >
                  {passwordCooldown > 0
                    ? `Try again in ${formatCooldown(passwordCooldown)}`
                    : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* MODAL 3: TRANSACTION PIN MANAGEMENT (SETUP / CHANGE / RESET) */}
      {/* ========================================================================= */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col my-auto max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {!isPinSet || pinModalMode === "setup"
                      ? "Set Up Transaction PIN"
                      : pinModalMode === "change"
                        ? "Change Transaction PIN"
                        : "Reset Forgotten PIN"}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Navigation Tabs when PIN is already set */}
            {isPinSet && (
              <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/50 p-1.5 gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPinModalMode("change")}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    pinModalMode === "change"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Change PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinModalMode("reset");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    pinModalMode === "reset"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  Forgot PIN? (Reset)
                </button>
              </div>
            )}

            {/* FORM 1: FIRST-TIME SETUP (POST /auth/pin/setup) */}
            {(!isPinSet || pinModalMode === "setup") && (
              <form
                onSubmit={handleSetupPin}
                className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Set your 4-digit PIN for authorizing transfers, card funding,
                  and wallet debits.
                </p>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) =>
                      setNewPin(e.target.value.replace(/\D/g, ""))
                    }
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={confirmPin}
                    onChange={(e) =>
                      setConfirmPin(e.target.value.replace(/\D/g, ""))
                    }
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isPinSubmitting ||
                      newPin.length !== 4 ||
                      confirmPin.length !== 4
                    }
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 font-bold text-xs sm:text-sm text-white shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isPinSubmitting
                      ? "Configuring..."
                      : "Set PIN (POST /auth/pin/setup)"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 2: CHANGE EXISTING PIN (POST /auth/pin/change) */}
            {isPinSet && pinModalMode === "change" && (
              <form
                onSubmit={handleChangePin}
                className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain"
              >
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    Current 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={currentPin}
                    onChange={(e) =>
                      setCurrentPin(
                        e.target.value.replace(/\D/g, "").slice(0, 4),
                      )
                    }
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                      New 4-Digit PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      placeholder="••••"
                      value={newPin}
                      onChange={(e) =>
                        setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                      }
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                      Confirm New PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      inputMode="numeric"
                      placeholder="••••"
                      value={confirmPin}
                      onChange={(e) =>
                        setConfirmPin(
                          e.target.value.replace(/\D/g, "").slice(0, 4),
                        )
                      }
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                    />
                  </div>
                </div>

                {/* Secondary Verification Factor: Password or OTP */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                      Secondary Authorization
                    </label>
                    <div className="flex gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setPinAuthMethod("password")}
                        className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                          pinAuthMethod === "password"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPinAuthMethod("otp");
                        }}
                        className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                          pinAuthMethod === "otp"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                            : "text-slate-400 hover:text-slate-700"
                        }`}
                      >
                        OTP Code
                      </button>
                    </div>
                  </div>

                  {pinAuthMethod === "password" ? (
                    <div>
                      <input
                        type="password"
                        placeholder="Enter your account password"
                        value={pinAuthPassword}
                        onChange={(e) => setPinAuthPassword(e.target.value)}
                        required={pinAuthMethod === "password"}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                      />
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Required for credential verification
                      </p>
                    </div>
                  ) : (
                    <div>
                      {!otpSent ? (
                        // Step 1 — user hasn't requested OTP yet, show send button
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await pinService.requestChangePinOtp();
                              setOtpSent(true);
                              showToast("success", "OTP sent to your email.");
                            } catch {
                              showToast("error", "Failed to send OTP.");
                            }
                          }}
                          className="w-full px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 border border-dashed border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer transition-colors"
                        >
                          Send verification code to {profileEmail}
                        </button>
                      ) : (
                        // Step 2 — OTP sent, show input + resend
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={6}
                            inputMode="numeric"
                            placeholder="6-digit OTP code"
                            value={pinAuthOtp}
                            onChange={(e) =>
                              setPinAuthOtp(e.target.value.replace(/\D/g, ""))
                            }
                            required={pinAuthMethod === "otp"}
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center font-mono tracking-widest text-xs sm:text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await pinService.requestChangePinOtp();
                                showToast(
                                  "success",
                                  "OTP resent to your email.",
                                );
                              } catch {
                                showToast("error", "Failed to resend OTP.");
                              }
                            }}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl shrink-0 cursor-pointer"
                          >
                            Resend
                          </button>
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        {otpSent
                          ? `Verification code sent to ${profileEmail}`
                          : "A 6-digit code will be sent to your registered email"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isPinSubmitting ||
                      currentPin.length !== 4 ||
                      newPin.length !== 4 ||
                      confirmPin.length !== 4
                    }
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 font-bold text-xs sm:text-sm text-white shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isPinSubmitting ? "Updating..." : "Update PIN"}
                  </button>
                </div>
              </form>
            )}

            {/* FORM 3: FORGOT PIN RESET WITH OTP (POST /auth/pin/reset) */}
            {isPinSet && pinModalMode === "reset" && (
              <form
                onSubmit={handleResetPin}
                className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain"
              >
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase font-mono">
                      6-Digit OTP Code
                    </label>
                    {resetOtpSent && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await pinService.requestResetOtp();
                            showToast("success", "OTP resent to your email.");
                          } catch {
                            showToast("error", "Failed to resend OTP.");
                          }
                        }}
                        className="text-[11px] text-indigo-600 hover:underline font-bold cursor-pointer"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>

                  {!resetOtpSent ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await pinService.requestResetOtp();
                          setResetOtpSent(true);
                          showToast("success", "OTP sent to your email.");
                        } catch {
                          showToast("error", "Failed to send OTP.");
                        }
                      }}
                      className="w-full px-4 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs font-bold text-indigo-700 dark:text-indigo-300 cursor-pointer transition-colors"
                    >
                      Send reset code to {profileEmail}
                    </button>
                  ) : (
                    <input
                      type="text"
                      maxLength={6}
                      inputMode="numeric"
                      placeholder="123456"
                      value={resetOtp}
                      onChange={(e) =>
                        setResetOtp(e.target.value.replace(/\D/g, ""))
                      }
                      required
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                    />
                  )}

                  {resetOtpSent && (
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                      Sent to {profileEmail} for forgot PIN verification
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={resetNewPin}
                    onChange={(e) =>
                      setResetNewPin(e.target.value.replace(/\D/g, ""))
                    }
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 uppercase font-mono">
                    Confirm New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    inputMode="numeric"
                    placeholder="••••"
                    value={resetConfirmPin}
                    onChange={(e) =>
                      setResetConfirmPin(e.target.value.replace(/\D/g, ""))
                    }
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center text-xl font-mono tracking-widest text-slate-900 dark:text-white outline-none focus:border-indigo-600 transition-colors"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isPinSubmitting ||
                      resetOtp.length !== 6 ||
                      resetNewPin.length !== 4 ||
                      resetConfirmPin.length !== 4
                    }
                    className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 font-bold text-xs sm:text-sm text-white shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isPinSubmitting ? "Resetting..." : "Reset PIN"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ACCOUNT FREEZE CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {isFreezeModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-sm sm:max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl my-auto animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center space-y-3 sm:space-y-4">
              <div
                className={`p-3.5 sm:p-4 rounded-full ${isAccountFrozen ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"}`}
              >
                <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8" />
              </div>
              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                {isAccountFrozen
                  ? "Unfreeze Your Account?"
                  : "Freeze Account for Security?"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold px-2 leading-relaxed">
                {isAccountFrozen
                  ? "Restoring account activity will immediately re-enable outgoing transfers, card funding, and automated savings maturity."
                  : "Freezing your account will immediately reject all outward debit requests, transfers, and wallet debits until you unfreeze."}
              </p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 mt-6">
              <button
                type="button"
                onClick={() => setIsFreezeModalOpen(false)}
                className="w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleAccountFreeze}
                className={`w-full sm:w-1/2 py-2.5 sm:py-3 min-h-[42px] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md cursor-pointer ${
                  isAccountFrozen
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                    : "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                }`}
              >
                {isAccountFrozen ? "Confirm Unfreeze" : "Yes, Freeze Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: ACTIVE DEVICE SESSIONS MANAGEMENT & KILL SWITCH */}
      {/* ========================================================================= */}
      {isSessionsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[90vh] sm:max-h-[85vh] animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 rounded-xl">
                  <Smartphone className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    Active Device Sessions
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">
                    Authorized tokens & device access control
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSessionsModalOpen(false)}
                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              >
                <X className="w-5 h-5 text-slate-400 dark:text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 overscroll-contain">
              {/* Alert Box if other sessions exist */}
              {otherSessionsCount > 0 ? (
                <div className="flex items-start gap-3 p-3.5 sm:p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl sm:rounded-2xl">
                  <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300">
                      {otherSessionsCount} Other Authorized Device
                      {otherSessionsCount > 1 ? "s" : ""} Detected
                    </h4>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                      You can selectively revoke any session or terminate all
                      other devices in one click. Your current device login will
                      remain completely uninterrupted.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-3.5 sm:p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl sm:rounded-2xl">
                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                      Account Access is Fully Secured
                    </h4>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium leading-relaxed">
                      Only your current browser session has active cryptographic
                      tokens. No secondary sessions or devices have access to
                      your account.
                    </p>
                  </div>
                </div>
              )}

              {/* Session List */}
              <div className="space-y-3">
                {sessions.map((sess) => {
                  const isCurrent = sess.id === currentSessionId;
                  return (
                    <div
                      key={sess.id}
                      className={`p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border transition-all ${
                        isCurrent
                          ? "bg-purple-50/60 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/80 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div
                            className={`p-2.5 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
                              isCurrent
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {sess.device.toLowerCase().includes("macbook") ||
                            sess.device.toLowerCase().includes("pc") ||
                            sess.device.toLowerCase().includes("laptop") ? (
                              <Laptop className="w-4 h-4" />
                            ) : (
                              <Smartphone className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                {sess.browser} on {sess.device}
                              </h4>
                              {isCurrent ? (
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider rounded-md flex items-center gap-1 shrink-0">
                                  <CheckCircle className="w-3 h-3 text-purple-600 dark:text-purple-400" />{" "}
                                  Current Device · Active Now
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 text-[10px] font-mono font-bold rounded-md shrink-0">
                                  Remote Session
                                </span>
                              )}
                            </div>

                            {/* Location & IP */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {sess.location}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {sess.ipAddress}
                              </span>
                            </div>

                            {/* Last active & Login time */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-1.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                                <span>
                                  Authorized:{" "}
                                  {new Date(sess.loginTime).toLocaleString(
                                    "en-US",
                                    { dateStyle: "medium", timeStyle: "short" },
                                  )}
                                </span>
                              </div>
                              {!isCurrent && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                                  <span>
                                    Last active:{" "}
                                    {new Date(sess.lastActive).toLocaleString(
                                      "en-US",
                                      {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      },
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Single Kill button - Triggers Password Re-Auth */}
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => handleOpenKillSingle(sess)}
                            className="w-full sm:w-auto px-3.5 py-2 min-h-[38px] bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold rounded-xl transition-all self-stretch sm:self-center border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                            title="Terminate this session immediately (requires password re-auth)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Kill Session</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer / Bulk Kill Other Sessions Action */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium text-center sm:text-left">
                {otherSessionsCount > 0
                  ? `${otherSessionsCount} other device(s) can be terminated.`
                  : "Only your current session is authorized."}
              </span>

              {otherSessionsCount > 0 ? (
                <button
                  type="button"
                  onClick={handleOpenKillAll}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-black tracking-wider uppercase rounded-xl transition-all shadow-md shadow-red-900/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                  <span>
                    Terminate All Other Sessions ({otherSessionsCount})
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSessionsModalOpen(false)}
                  className="w-full sm:w-auto px-5 py-2.5 min-h-[42px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PASSWORD RE-AUTHENTICATION MODAL FOR SESSION KILL (SINGLE OR BULK) */}
      {reauthModalMode && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-7 my-auto animate-in zoom-in-95">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl border border-red-200/60 dark:border-red-900/40 shrink-0">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                      Security Authorization
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-1">
                    Password Re-Auth Required
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseReauthModal}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanatory Context */}
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-4">
              {reauthModalMode === "single" && sessionToKill
                ? "For security reasons, enter your account password to authorize terminating this device session and invalidating its credentials."
                : `You are terminating all other ${otherSessionsCount} active device session${otherSessionsCount > 1 ? "s" : ""}. Enter your account password to confirm.`}
            </p>

            {/* Target Session Details Card */}
            {reauthModalMode === "single" && sessionToKill ? (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl mb-5 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-200 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 shrink-0">
                    {sessionToKill.device.toLowerCase().includes("macbook") ||
                    sessionToKill.device.toLowerCase().includes("pc") ||
                    sessionToKill.device.toLowerCase().includes("laptop") ? (
                      <Laptop className="w-4 h-4" />
                    ) : (
                      <Smartphone className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h5 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {sessionToKill.browser} on {sessionToKill.device}
                    </h5>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {sessionToKill.location}
                      </span>
                      <span>·</span>
                      <span className="font-mono">
                        {sessionToKill.ipAddress}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl mb-5 flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-300">
                  <span className="font-bold">
                    {otherSessionsCount} Remote Device
                    {otherSessionsCount > 1 ? "s" : ""} will be signed out
                    immediately.
                  </span>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-400/90 mt-0.5">
                    Your current active session on this device will remain
                    safely logged in.
                  </p>
                </div>
              </div>
            )}

            {/* Re-auth Password Form */}
            <form onSubmit={handleConfirmReauthKill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold font-mono text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Confirm Account Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Key className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type={showReauthPassword ? "text" : "password"}
                    value={reauthPassword}
                    onChange={(e) => {
                      setReauthPassword(e.target.value);
                      if (reauthError) setReauthError(null);
                    }}
                    autoFocus
                    placeholder="Enter your account password"
                    className={`w-full bg-slate-50 dark:bg-slate-800/80 border rounded-xl py-2.5 pl-10 pr-12 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-none transition-all ${
                      reauthError
                        ? "border-red-500 focus:ring-1 focus:ring-red-500"
                        : "border-slate-300 dark:border-slate-700 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowReauthPassword(!showReauthPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    {showReauthPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {reauthError && (
                  <div className="mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{reauthError}</span>
                  </div>
                )}

                <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  Hint: Enter your current login password (sandbox default:{" "}
                  <span className="font-mono text-slate-500 dark:text-slate-400 font-bold">
                    password123
                  </span>{" "}
                  or whatever password you set).
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2.5 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReauthModal}
                  disabled={isReauthSubmitting}
                  className="w-full sm:w-1/2 py-2.5 min-h-[42px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReauthSubmitting || !reauthPassword.trim()}
                  className="w-full sm:w-1/2 py-2.5 min-h-[42px] bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-red-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isReauthSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 text-white" />
                      <span>
                        {reauthModalMode === "single"
                          ? "Verify & Kill"
                          : "Verify & Kill All"}
                      </span>
                    </>
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

export default SettingsScreen;

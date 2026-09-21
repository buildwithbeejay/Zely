import { authService } from "@/services/auth.services";
import {
  ChevronRight,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAsync } from "../../hooks/useAsync";
import { kycService } from "../../services/kycService";
import { KYCStatusResponse } from "../../types";
import { useToast } from "@/context/ToastContext";

const ProfileScreen: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const navigate = useNavigate();
  const { data: status, execute: fetchStatus } = useAsync<KYCStatusResponse>(
    kycService.getMyStatus,
  );

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await authService.getProfile();
        const data = res.data;
        setName(data.name ?? "");
        setEmail(data.email ?? "");
        setPhone(data.phone ?? "");
        setAddress(data.address ?? "");
      } catch {
        showToast("error", "Failed to load profile");
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authService.updateProfile({ name, phone, address });
      showToast("success", "Profile updated successfully");
    } catch {
      showToast("error", "Failed to update profile. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const currentTier = status?.currentTier || "TIER_1";

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Profile & KYC</h2>
        <button
          onClick={() => navigate("/kyc")}
          className="text-sm font-bold flex items-center gap-1 text-primary hover:text-primary-light transition-colors"
        >
          View KYC Status <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 text-center shadow-sm">
            <div className="relative w-32 h-32 mx-auto mb-6">
              <div className="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden border-4 border-white dark:border-slate-800 shadow-xl">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${name || "user"}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {name || "—"}
            </h3>
            <p className="text-sm text-slate-500 font-bold mb-4">
              {email || "—"}
            </p>

            <div className="flex flex-col items-center gap-3">
              <span
                className={`px-3 py-1 text-xs font-bold uppercase rounded-full flex items-center gap-1 ${
                  currentTier === "TIER_3"
                    ? "bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400"
                    : currentTier === "TIER_2"
                      ? "bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                {currentTier === "TIER_3"
                  ? "KYC Tier 3"
                  : currentTier === "TIER_2"
                    ? "KYC Tier 2"
                    : "KYC Tier 1"}
              </span>

              {currentTier === "TIER_1" && !status?.pendingSubmission && (
                <button
                  onClick={() => navigate("/kyc/upgrade/tier-2")}
                  className="w-full py-2 text-sm font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                >
                  Upgrade to Tier 2
                </button>
              )}

              {currentTier === "TIER_2" && !status?.pendingSubmission && (
                <button
                  onClick={() => navigate("/kyc/upgrade/tier-3")}
                  className="w-full py-2 text-sm font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
                >
                  Upgrade to Tier 3
                </button>
              )}

              {status?.pendingSubmission && (
                <span className="text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-xl w-full">
                  Upgrade Pending Review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-lg mb-6">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent opacity-60 cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Enter phone number"
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter address"
                    className="w-full bg-slate-50 dark:bg-slate-800 rounded-xl py-3 pl-10 pr-4 font-semibold text-sm outline-none border border-transparent focus:border-primary"
                  />
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>

          {/* KYC Documents — driven by real tier */}
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-lg mb-6">KYC Documents</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentTier !== "TIER_1"
                        ? "bg-green-100 dark:bg-green-900/20 text-green-600"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Government ID</p>
                    <p className="text-xs text-slate-500">
                      Required for Tier 2
                    </p>
                  </div>
                </div>
                {currentTier !== "TIER_1" ? (
                  <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-md">
                    Verified
                  </span>
                ) : (
                  <button
                    onClick={() => navigate("/kyc/upgrade/tier-2")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Upload
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentTier === "TIER_3"
                        ? "bg-green-100 dark:bg-green-900/20 text-green-600"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-sm">Proof of Address</p>
                    <p className="text-xs text-slate-500">
                      Required for Tier 3
                    </p>
                  </div>
                </div>
                {currentTier === "TIER_3" ? (
                  <span className="text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/10 px-2 py-1 rounded-md">
                    Verified
                  </span>
                ) : (
                  <button
                    onClick={() => navigate("/kyc/upgrade/tier-3")}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Upload
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileScreen;

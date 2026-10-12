import { axiosPrivate } from "@/api/client";
import { StatusBadge } from "@/components/statusBadge";
import { useToast } from "@/context/ToastContext";
import { useAdminUsers } from "@/hooks/useAdmin";
import { adminDashboardService } from "@/services/adminDashboard.service";
import {
  CheckCircle2,
  CheckSquare,
  Loader2,
  Search,
  Square,
} from "lucide-react";
import React, { useState } from "react";

function FundManagementTab() {
  const { showToast } = useToast();
  const [fundsTab, setFundsTab] = useState<"single" | "bulk" | "treasury">(
    "single",
  );

  // Users
  const [searchInput, setSearchInput] = useState("");

  // Single credit
  const [selectedUserId, setSelectedUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");

  // Bulk
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [bulkAmount, setBulkAmount] = useState("");

  //Treasury state
  const [treasuryAmount, setTreasuryAmount] = useState("");
  const [treasuryCurrency, setTreasuryCurrency] = useState("NGN");
  const [treasuryReason, setTreasuryReason] = useState("");
  const [isTreasuryProcessing, setIsTreasuryProcessing] = useState(false);

  // Submission
  const [isProcessing, setIsProcessing] = useState(false);

  const { users, loading: usersLoading } = useAdminUsers({
    role: "USER",
    limit: 100,
  });

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchInput.toLowerCase()) ||
      u.email.toLowerCase().includes(searchInput.toLowerCase()),
  );

  const toggleUser = (userId: string) =>
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((x) => x !== userId)
        : [...prev, userId],
    );

  const toggleAll = () =>
    setSelectedUserIds(
      selectedUserIds.length === filteredUsers.length
        ? []
        : filteredUsers.map((u) => u.userId),
    );

  const handleSingleCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !creditAmount) return;

    const amount = Number(creditAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("error", "Enter a valid amount");
      return;
    }

    setIsProcessing(true);
    try {
      await adminDashboardService.fundUsers({
        users: [
          {
            userId: selectedUserId,
            amount,
          },
        ],
      });
      showToast("success", "User funded successfully");
      setSelectedUserId("");
      setCreditAmount("");
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Funding failed");
    } finally {
      setIsProcessing(false);
    }
  };

  // Single

  // Bulk

  const handleBulkCredit = async () => {
    if (selectedUserIds.length === 0 || !bulkAmount) return;

    const amount = Number(bulkAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("error", "Enter a valid amount");
      return;
    }

    console.log(
      "Bulk payload:",
      selectedUserIds.map((userId) => ({ userId, amount })),
    );

    setIsProcessing(true);
    try {
      await adminDashboardService.fundUsers({
        users: selectedUserIds.map((userId) => ({
          userId,
          amount,
        })),
      });
      showToast(
        "success",
        `${selectedUserIds.length} users funded successfully`,
      );
      setSelectedUserIds([]);
      setBulkAmount("");
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Bulk funding failed");
    } finally {
      setIsProcessing(false);
    }
  };

  //Treasury
  const handleTreasuryTopUp = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number(treasuryAmount);
    if (isNaN(amount) || amount <= 0) {
      showToast("error", "Enter a valid amount");
      return;
    }
    if (treasuryReason.trim().length < 5) {
      showToast("error", "Reason must be at least 5 characters");
      return;
    }

    setIsTreasuryProcessing(true);
    try {
      await adminDashboardService.topUpTreasury({
        amount,
        currency: treasuryCurrency,
        reason: treasuryReason.trim(),
      });
      showToast(
        "success",
        `Treasury topped up with ₦${amount.toLocaleString()}`,
      );
      setTreasuryAmount("");
      setTreasuryReason("");
    } catch (e: any) {
      showToast("error", e.response?.data?.message ?? "Treasury top-up failed");
    } finally {
      setIsTreasuryProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
      {/* Tab switcher */}
      <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {["single", "bulk", "treasury"].map((tab) => (
          <button
            key={tab}
            onClick={() => setFundsTab(tab as "single" | "bulk" | "treasury")}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${
              fundsTab === tab
                ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab === "single"
              ? "Single Credit"
              : tab === "bulk"
                ? "Bulk Distribution"
                : "Treasury Top-up"}
          </button>
        ))}
      </div>

      {/* Single Credit */}
      {fundsTab === "single" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 max-w-2xl">
          <h3 className="text-xl font-bold mb-6">Credit User Account</h3>
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <form onSubmit={handleSingleCredit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select a user...</option>
                  {users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                  Amount (₦)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    ₦
                  </span>
                  <input
                    type="number"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                    placeholder="0"
                    min="1"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !selectedUserId || !creditAmount}
                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Credit Funds"
                )}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Bulk Distribution */}
      {fundsTab === "bulk" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <h3 className="text-xl font-bold">Bulk Distribution</h3>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-48"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                  ₦
                </span>
                <input
                  type="number"
                  value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-7 pr-4 py-2 text-sm font-bold w-32 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Amount"
                  min="1"
                />
              </div>
              <button
                onClick={handleBulkCredit}
                disabled={
                  isProcessing || selectedUserIds.length === 0 || !bulkAmount
                }
                className="bg-primary px-4 py-2 text-white font-bold rounded-lg text-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `Distribute to ${selectedUserIds.length}`
                )}
              </button>
            </div>
          </div>

          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                <tr>
                  <th className="px-6 py-4 w-12">
                    <button
                      onClick={toggleAll}
                      className="text-slate-400 hover:text-primary"
                    >
                      {selectedUserIds.length === filteredUsers.length &&
                      filteredUsers.length > 0 ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">KYC Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-slate-500 text-sm"
                    >
                      No users found
                    </td>
                  </tr>
                )}
                {filteredUsers.map((user) => (
                  <tr
                    key={user.userId}
                    onClick={() => toggleUser(user.userId)}
                    className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      selectedUserIds.includes(user.userId)
                        ? "bg-primary/5"
                        : ""
                    }`}
                  >
                    <td className="px-6 py-4">
                      <div
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          selectedUserIds.includes(user.userId)
                            ? "bg-primary border-primary text-white"
                            : "border-slate-300 dark:border-slate-600"
                        }`}
                      >
                        {selectedUserIds.includes(user.userId) && (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 text-slate-500">{user.email}</td>
                    <td className="px-6 py-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-6 py-4 text-xs font-mono text-slate-500">
                      {user.kycTier}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Treasury state */}
      {fundsTab === "treasury" && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 max-w-2xl">
          <div className="mb-6">
            <h3 className="text-xl font-bold">Treasury Top-up</h3>
            <p className="text-sm text-slate-500 mt-1">
              Manually credit the system treasury. This bypasses Paystack and
              should only be used in non-production environments.
            </p>
          </div>

          <form onSubmit={handleTreasuryTopUp} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Amount (₦)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                  ₦
                </span>
                <input
                  type="number"
                  value={treasuryAmount}
                  onChange={(e) => setTreasuryAmount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-8 pr-4 py-3 outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                  placeholder="0"
                  min="1"
                  max="1000000000"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Currency
              </label>
              <select
                value={treasuryCurrency}
                onChange={(e) => setTreasuryCurrency(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="NGN">NGN — Nigerian Naira</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Reason
              </label>
              <textarea
                value={treasuryReason}
                onChange={(e) => setTreasuryReason(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
                placeholder="e.g. Monthly treasury funding for user payouts"
                minLength={5}
                maxLength={500}
              />
              <p className="text-[10px] text-slate-400 mt-1 text-right">
                {treasuryReason.length}/500
              </p>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
                This action is disabled in production. Only use this in
                development or staging environments.
              </p>
            </div>

            <button
              type="submit"
              disabled={
                isTreasuryProcessing || !treasuryAmount || !treasuryReason
              }
              className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-light transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isTreasuryProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Top Up Treasury"
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default FundManagementTab;

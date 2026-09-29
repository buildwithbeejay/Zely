// admin/users/UsersTab.tsx
import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  ArrowLeft,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";

import { useAdminUserDetail, useAdminUsers } from "@/hooks/useAdmin";
import { useParams, useNavigate } from "react-router-dom";

import { StatusBadge } from "@/components/statusBadge";
import { useDebouncedValue } from "@/hooks/useDebounceValue";
import { adminService, AdminSessionRow } from "@/services/admin.service";
import { Trash2 } from "lucide-react"; // add to your existing lucide-react import line

// Make these match your backend enum VALUES exactly
const STATUS_OPTIONS = [
  "PENDING_EMAIL_VERIFICATION",
  "EMAIL_VERIFIED",
  "ACCOUNT_PROVISIONING",
  "PROVISIONING_FAILED",
  "ACCOUNT_READY",
];
const ROLE_OPTIONS = ["USER", "ADMIN"];
const KYC_OPTIONS = ["TIER_1", "TIER_2", "TIER_3"];

const COLUMNS = [
  { key: "name", label: "Name" },
  { key: "status", label: "Status" },
  { key: "kycTier", label: "KYC Tier" },
  { key: "role", label: "Role" },
  { key: "joinedDate", label: "Joined" },
] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

// Change to n / 100 if your amounts are stored in kobo
const toMajor = (n: number) => n;
const money = (n: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(
    toMajor(n ?? 0),
  );
const date = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString() : "—";

const selectCls =
  "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

interface TransactionRow {
  transactionId: string;
  direction: "debit" | "credit";
  amount: number;
  currency: string;
  walletType: string;
  status: string;
  counterpartyName?: string;
  counterpartyWalletType?: string;
  name?: string;
  category?: string;
  occurredAt: string;
}

function describeTransaction(t: TransactionRow) {
  const isCredit = t.direction === "credit";
  const counterparty = t.counterpartyName ?? t.name ?? null;

  if (counterparty) {
    return isCredit ? `From ${counterparty}` : `To ${counterparty}`;
  }
  if (t.counterpartyWalletType) {
    const wallet = t.counterpartyWalletType.replace(/_/g, " ").toLowerCase();
    return isCredit ? `From ${wallet}` : `To ${wallet}`;
  }
  return t.category ? t.category.replace(/_/g, " ") : "Transaction";
}

export default function UsersTab() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [kycTier, setKycTier] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "joinedDate",
    order: "desc",
  });
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  useEffect(() => setPage(1), [search]);

  const { users, total, pages, loading, error, reload } = useAdminUsers({
    search,
    sort: sort.key,
    order: sort.order,
    page,
    status,
    role,
    kycTier,
  });

  if (selectedUserId) {
    return (
      <UserDetail
        userId={selectedUserId}
        onBack={() => setSelectedUserId(null)}
      />
    );
  }

  const toggleSort = (key: string) => {
    setSort((s) =>
      s.key === key
        ? { key, order: s.order === "asc" ? "desc" : "asc" }
        : { key, order: "asc" },
    );
    setPage(1);
  };
  const onFilter =
    (setter: (v: string) => void) =>
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setPage(1);
    };

  if (userId) {
    return (
      <UserDetail userId={userId} onBack={() => navigate("/admin/users")} />
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold mr-2">User Management</h2>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email or user ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={`${selectCls} w-full pl-9`}
          />
        </div>
        <select
          value={status}
          onChange={onFilter(setStatus)}
          className={selectCls}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={role}
          onChange={onFilter(setRole)}
          className={selectCls}
          aria-label="Filter by role"
        >
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={kycTier}
          onChange={onFilter(setKycTier)}
          className={selectCls}
          aria-label="Filter by KYC tier"
        >
          <option value="">All KYC tiers</option>
          {KYC_OPTIONS.map((k) => (
            <option key={k} value={k}>
              {k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
            <tr>
              {COLUMNS.map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => toggleSort(key)}
                  className="px-6 py-4 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {label}
                    {sort.key === key &&
                      (sort.order === "asc" ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      ))}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  Loading users...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-6 py-12 text-center">
                  <p className="text-red-500 text-sm mb-3">{error}</p>
                  <button
                    onClick={reload}
                    className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            )}
            {!loading && !error && users.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-6 py-12 text-center text-slate-500 text-sm"
                >
                  No users found
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              users.map((u: any) => (
                <tr
                  key={u.id}
                  onClick={() => setSelectedUserId(u.userId)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {initials(u.name)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                          {u.name}
                        </p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={u.status} />
                      {u.isLocked && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs font-bold">
                    {u.kycTier.replace(/_/g, " ")}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 capitalize">
                    {u.role.toLowerCase()}
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {date(u.joinedDate)}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
        <span>{total.toLocaleString()} users</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {page} of {Math.max(pages, 1)}
          </span>
          <button
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
        {label}
      </p>
      <p className="text-sm font-medium text-slate-900 dark:text-white mt-1 break-words">
        {value ?? "—"}
      </p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6">
      <h3 className="text-sm font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function UserDetail({
  userId,
  onBack,
}: {
  userId: string;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "sessions">("profile");
  const [sessions, setSessions] = useState<AdminSessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [killingId, setKillingId] = useState<string | null>(null);
  const { data, loading, error, reload } = useAdminUserDetail(userId);

  const loadSessions = () => {
    setSessionsLoading(true);
    adminService
      .getSessions(userId)
      .then((res) => setSessions(res.data))
      .finally(() => setSessionsLoading(false));
  };

  useEffect(() => {
    if (tab === "sessions") loadSessions();
  }, [tab, userId]);

  const handleKillOne = async (sessionId: string) => {
    if (
      !confirm(
        "Revoke this session? The device will be logged out immediately.",
      )
    )
      return;
    setKillingId(sessionId);
    try {
      await adminService.killSession(userId, sessionId);
      loadSessions();
    } finally {
      setKillingId(null);
    }
  };

  const handleKillAll = async () => {
    if (
      !confirm(
        "Revoke ALL active sessions for this user? Every device will be logged out.",
      )
    )
      return;
    await adminService.killAllSessions(userId);
    loadSessions();
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> Back to users
      </button>

      {loading && <p className="text-slate-500 text-sm">Loading user...</p>}
      {error && (
        <div>
          <p className="text-red-500 text-sm mb-3">{error}</p>
          <button
            onClick={reload}
            className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setTab("profile")}
              className={`pb-3 text-sm font-bold ${tab === "profile" ? "text-primary border-b-2 border-primary" : "text-slate-500"}`}
            >
              Account Profile
            </button>
            <button
              onClick={() => setTab("sessions")}
              className={`pb-3 text-sm font-bold ${tab === "sessions" ? "text-primary border-b-2 border-primary" : "text-slate-500"}`}
            >
              Active Sessions ({sessions.length})
            </button>
          </div>

          {tab === "profile" && (
            <>
              <Card title="Profile & security">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <Field label="Name" value={data.user.name} />
                  <Field label="Email" value={data.user.email} />
                  <Field label="Phone" value={data.user.phone} />
                  <Field label="Address" value={data.user.address} />
                  <Field label="User ID" value={data.user.userId} />
                  <Field
                    label="Status"
                    value={<StatusBadge status={data.user.status} />}
                  />
                  <Field label="Role" value={data.user.role} />
                  <Field
                    label="KYC tier"
                    value={data.user.kycTier.replace(/_/g, " ")}
                  />
                  <Field
                    label="Email verified"
                    value={data.user.isEmailVerified ? "Yes" : "No"}
                  />
                  <Field
                    label="MFA"
                    value={data.user.mfaEnabled ? "Enabled" : "Off"}
                  />
                  <Field
                    label="Transaction PIN"
                    value={data.user.hasTransactionPin ? "Set" : "Not set"}
                  />
                  <Field
                    label="Login lock"
                    value={
                      data.user.isLocked
                        ? `Locked${data.user.lockReason ? ` (${data.user.lockReason})` : ""}`
                        : "None"
                    }
                  />
                  <Field
                    label="Failed logins"
                    value={data.user.failedLoginAttempts}
                  />
                  <Field
                    label="Provisioning retries"
                    value={data.user.provisioningRetryCount}
                  />
                  <Field
                    label="Password changed"
                    value={date(data.user.passwordChangedAt)}
                  />
                  <Field label="Joined" value={date(data.user.joinedDate)} />
                </div>
              </Card>

              <Card title="Balance summary">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <Field
                    label="Total"
                    value={money(
                      data.summary.totalBalance,
                      data.summary.currency,
                    )}
                  />
                  <Field
                    label="Main"
                    value={money(
                      data.summary.mainBalance,
                      data.summary.currency,
                    )}
                  />
                  <Field
                    label="Savings"
                    value={money(
                      data.summary.savingsBalance,
                      data.summary.currency,
                    )}
                  />
                  <Field
                    label="Vault"
                    value={money(
                      data.summary.vaultBalance,
                      data.summary.currency,
                    )}
                  />
                  <Field
                    label="Total credit"
                    value={money(
                      data.summary.totalCredit,
                      data.summary.currency,
                    )}
                  />
                  <Field
                    label="Total debit"
                    value={money(
                      data.summary.totalDebit,
                      data.summary.currency,
                    )}
                  />
                </div>
              </Card>

              <Card title="Wallets">
                {data.wallets.length === 0 ? (
                  <p className="text-sm text-slate-500">No wallets</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                        <tr>
                          <th className="py-2 pr-4">Type</th>
                          <th className="py-2 pr-4">Account</th>
                          <th className="py-2 pr-4">Balance</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.wallets.map((w: any) => (
                          <tr key={w.walletId}>
                            <td className="py-3 pr-4 font-bold">
                              {w.walletType.replace(/_/g, " ")}
                            </td>
                            <td className="py-3 pr-4 text-slate-500">
                              {w.accountNumber ?? "—"}
                            </td>
                            <td className="py-3 pr-4">
                              {money(w.balance, w.currency)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge status={w.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              <Card title="Recent transactions">
                {data.transactions.transactions.length === 0 ? (
                  <p className="text-sm text-slate-500">No transactions yet</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-slate-500 uppercase font-bold text-[10px] tracking-widest">
                        <tr>
                          <th className="py-2 pr-4">Date</th>
                          <th className="py-2 pr-4">Description</th>
                          <th className="py-2 pr-4">Wallet</th>
                          <th className="py-2 pr-4">Amount</th>
                          <th className="py-2 pr-4">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {data.transactions.transactions.map((t: any) => (
                          <tr key={t.rowKey}>
                            <td className="py-3 pr-4 text-slate-500 text-xs">
                              {date(t.occurredAt)}
                            </td>
                            <td className="py-3 pr-4">
                              <div className="flex items-center gap-2">
                                {t.direction === "credit" ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />
                                )}
                                <div>
                                  <p className="font-medium">
                                    {describeTransaction(t)}
                                  </p>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wide ${
                                      t.direction === "credit"
                                        ? "text-emerald-600"
                                        : "text-red-500"
                                    }`}
                                  >
                                    {t.direction}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 pr-4 text-slate-500 text-xs">
                              {t.walletType.replace(/_/g, " ")}
                            </td>
                            <td
                              className={`py-3 pr-4 font-bold ${t.direction === "credit" ? "text-emerald-600" : "text-red-500"}`}
                            >
                              {t.direction === "credit" ? "+" : "-"}
                              {money(t.amount, t.currency)}
                            </td>
                            <td className="py-3 pr-4">
                              <StatusBadge status={t.status} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}

          {tab === "sessions" && (
            <div className="space-y-4">
              {sessions.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/30">
                  <div>
                    <p className="font-bold text-sm">
                      Emergency Session Invalidation
                    </p>
                    <p className="text-xs text-slate-500">
                      Instantly revoke all active sessions for this user across
                      all devices.
                    </p>
                  </div>
                  <button
                    onClick={handleKillAll}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors shrink-0"
                  >
                    Kill All Sessions
                  </button>
                </div>
              )}

              {sessionsLoading && (
                <p className="text-sm text-slate-500">Loading sessions...</p>
              )}
              {!sessionsLoading && sessions.length === 0 && (
                <p className="text-sm text-slate-500">No active sessions</p>
              )}

              {!sessionsLoading &&
                sessions.map((s) => (
                  <div
                    key={s.sessionId}
                    className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl"
                  >
                    <div>
                      <p className="font-bold text-sm">{s.deviceName}</p>
                      <p className="text-xs text-slate-500">{s.ipAddress}</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Authorized {new Date(s.createdAt).toLocaleString()} ·
                        Last active {new Date(s.lastUsedAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleKillOne(s.sessionId)}
                      disabled={killingId === s.sessionId}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

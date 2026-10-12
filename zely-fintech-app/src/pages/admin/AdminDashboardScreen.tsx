import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Filter,
  Globe,
  History as HistoryIcon,
  Loader2,
  Search,
  Settings,
  Shield,
  Square,
  Trash2,
  User as UserIcon,
  Users,
  Wallet,
  XCircle,
  Zap,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import CustomSelect from "../../components/common/CustomSelect";
import { useToast } from "../../context/ToastContext";
import { authService } from "../../services/auth.services";
import AdminReconciliationScreen from "./AdminReconciliationScreen";

import { Laptop, MapPin, Smartphone } from "lucide-react";

import AuditLogsTab from "@/components/AuditLogsTab";
import GlobalTransactionsPanel from "@/pages/admin/GlobalTransactionsTab";
import UsersTab from "@/pages/admin/userTab";
import {
  adminDashboardService,
  DashboardStats,
} from "@/services/adminDashboard.service";
import { axiosPrivate } from "@/api/client";
import FundManagementTab from "@/pages/admin/FundManagementTab";

type UserStatus = "active" | "suspended" | "pending";
type UserRole = "user" | "admin";

interface UserData {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  role: UserRole;
  joinedDate: string;
  avatarSeed: string;
  balance: number;
}

interface AdminTransaction {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  type: "payment" | "refund" | "transfer" | "credit";
  flow: "in" | "out";
  status: "success" | "failed" | "pending";
  date: string;
}

interface AdminAuditLog {
  id: string;
  action: string;
  target: string;
  adminName: string;
  timestamp: string;
  type: "user" | "funds" | "kyc" | "system";
}

// ... Mock Data ...
const generateMockAuditLogs = (): AdminAuditLog[] => [
  {
    id: "LOG-1",
    action: "User Suspended",
    target: "Bob Johnson (user_3)",
    adminName: "Alice Smith",
    timestamp: "2023-10-25T11:45:00",
    type: "user",
  },
  {
    id: "LOG-2",
    action: "Funds Credited",
    target: "John Doe (user_1) - $500.00",
    adminName: "Alice Smith",
    timestamp: "2023-10-25T10:15:00",
    type: "funds",
  },
  {
    id: "LOG-3",
    action: "KYC Approved",
    target: "Michael Brown (user_5)",
    adminName: "System Auto",
    timestamp: "2023-10-24T16:30:00",
    type: "kyc",
  },
  {
    id: "LOG-4",
    action: "System Settings Updated",
    target: "Transaction Limits",
    adminName: "Alice Smith",
    timestamp: "2023-10-24T09:20:00",
    type: "system",
  },
  {
    id: "LOG-5",
    action: "User Role Changed",
    target: "Emma Wilson (user_4) -> Admin",
    adminName: "Alice Smith",
    timestamp: "2023-10-23T14:10:00",
    type: "user",
  },
];

const generateMockUsers = (): UserData[] => [
  {
    id: "1",
    name: "John Doe",
    email: "john@example.com",
    status: "active",
    role: "user",
    joinedDate: "2023-01-15",
    avatarSeed: "John",
    balance: 12450.0,
  },
  {
    id: "2",
    name: "Alice Smith",
    email: "alice@company.com",
    status: "active",
    role: "admin",
    joinedDate: "2022-11-20",
    avatarSeed: "Alice",
    balance: 8500.5,
  },
  {
    id: "3",
    name: "Bob Johnson",
    email: "bob.j@provider.net",
    status: "suspended",
    role: "user",
    joinedDate: "2023-03-10",
    avatarSeed: "Bob",
    balance: 120.0,
  },
  {
    id: "4",
    name: "Emma Wilson",
    email: "emma.w@studio.io",
    status: "pending",
    role: "user",
    joinedDate: "2023-10-05",
    avatarSeed: "Emma",
    balance: 0.0,
  },
  {
    id: "5",
    name: "Michael Brown",
    email: "m.brown@corp.org",
    status: "active",
    role: "user",
    joinedDate: "2023-06-12",
    avatarSeed: "Michael",
    balance: 45200.0,
  },
  {
    id: "6",
    name: "Sarah Connor",
    email: "sarah@skynet.com",
    status: "active",
    role: "user",
    joinedDate: "2023-08-29",
    avatarSeed: "Sarah",
    balance: 9850.75,
  },
];

const generateMockTransactions = (): AdminTransaction[] => [
  {
    id: "TX-1001",
    userId: "1",
    userName: "John Doe",
    amount: 150.0,
    type: "payment",
    flow: "out",
    status: "success",
    date: "2023-10-25T10:30:00",
  },
  {
    id: "TX-1002",
    userId: "3",
    userName: "Bob Johnson",
    amount: 49.99,
    type: "payment",
    flow: "out",
    status: "failed",
    date: "2023-10-24T14:15:00",
  },
  {
    id: "TX-1003",
    userId: "5",
    userName: "Michael Brown",
    amount: 2500.0,
    type: "transfer",
    flow: "out",
    status: "pending",
    date: "2023-10-24T09:00:00",
  },
  {
    id: "TX-1004",
    userId: "2",
    userName: "Alice Smith",
    amount: 12.5,
    type: "refund",
    flow: "in",
    status: "success",
    date: "2023-10-23T16:45:00",
  },
  {
    id: "TX-1005",
    userId: "6",
    userName: "Sarah Connor",
    amount: 99.0,
    type: "payment",
    flow: "out",
    status: "success",
    date: "2023-10-23T11:20:00",
  },
  {
    id: "TX-1006",
    userId: "1",
    userName: "John Doe",
    amount: 500.0,
    type: "transfer",
    flow: "in",
    status: "success",
    date: "2023-10-22T13:10:00",
  },
];

const StatusBadge = ({ status }: { status: string }) => {
  const styles: any = {
    active:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    pending:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    success:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles[status] || "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
};

const AdminDashboardScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Determine active tab from URL
  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes("/admin/users")) return "users";
    if (path.includes("/admin/transactions")) return "transactions";
    if (path.includes("/admin/wallet-funding")) return "funds";
    if (path.includes("/admin/audit")) return "audit";
    if (path.includes("/admin/reconciliation")) return "settings";
    return "overview";
  };

  const activeTab = getActiveTab();

  const [users, setUsers] = useState<UserData[]>(generateMockUsers());
  const [transactions, setTransactions] = useState<AdminTransaction[]>(
    generateMockTransactions(),
  );
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>(
    generateMockAuditLogs(),
  );

  // API Call Preparation (Commented out for production use later)
  /*
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch Users
                // const usersRes = await fetch('/admin/users');
                // if(usersRes.ok) setUsers(await usersRes.json());

                // Fetch Transactions
                // const txRes = await fetch('/admin/transactions');
                // if(txRes.ok) setTransactions(await txRes.json());

                // Fetch Audit Logs
                // const auditRes = await fetch('/admin/audit-logs');
                // if(auditRes.ok) setAuditLogs(await auditRes.json());
            } catch (error) {
                console.error("Failed to load dashboard data", error);
            }
        };
        fetchDashboardData();
    }, []);
    */
  const [auditFilter, setAuditFilter] = useState<AdminAuditLog["type"] | "all">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Sorting State
  const [userSort, setUserSort] = useState<{
    key: keyof UserData;
    order: "asc" | "desc";
  }>({ key: "joinedDate", order: "desc" });
  const [txSort, setTxSort] = useState<{
    key: keyof AdminTransaction;
    order: "asc" | "desc";
  }>({ key: "date", order: "desc" });

  const filteredAuditLogs =
    auditFilter === "all"
      ? auditLogs
      : auditLogs.filter((log) => log.type === auditFilter);

  // Sorting Logic
  const sortedUsers = [...users]
    .sort((a, b) => {
      const valA = a[userSort.key];
      const valB = b[userSort.key];
      if (valA < valB) return userSort.order === "asc" ? -1 : 1;
      if (valA > valB) return userSort.order === "asc" ? 1 : -1;
      return 0;
    })
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const sortedTransactions = [...transactions]
    .sort((a, b) => {
      const valA = a[txSort.key];
      const valB = b[txSort.key];
      if (valA < valB) return txSort.order === "asc" ? -1 : 1;
      if (valA > valB) return txSort.order === "asc" ? 1 : -1;
      return 0;
    })
    .filter(
      (t) =>
        t.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.userName.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  // Funds Management State
  const [fundsTab, setFundsTab] = useState<"single" | "bulk">("single");
  const [selectedUserForCredit, setSelectedUserForCredit] =
    useState<string>("");
  const [creditAmount, setCreditAmount] = useState("");
  const [selectedUsersForBulk, setSelectedUsersForBulk] = useState<string[]>(
    [],
  );
  const [isProcessingFunds, setIsProcessingFunds] = useState(false);

  // Confirm Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // User Modals
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [isViewUserModalOpen, setIsViewUserModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);

  // Reconciliation State
  const [reconActiveTab, setReconActiveTab] = useState<
    "overview" | "users" | "reports" | "setup"
  >("overview");
  const [reconUserSort, setReconUserSort] = useState<{
    key: "name" | "discrepancy" | "ledgerBalance" | "actualBalance";
    order: "asc" | "desc";
  }>({ key: "name", order: "asc" });

  // Mock User Reconciliations
  const mockUserReconciliations = useMemo(() => {
    return users.map((u) => {
      if (u.name === "Michael Brown") {
        return {
          ...u,
          ledgerBalance: u.balance,
          actualBalance: u.balance + 1500,
          discrepancy: 1500,
          note: "Reviewed external statement, discrepancy due to timing difference",
        };
      }
      const hasDiscrepancy = Math.random() > 0.8;
      const discrepancy = hasDiscrepancy ? Math.random() * 100 - 50 : 0;
      return {
        ...u,
        ledgerBalance: u.balance,
        actualBalance: u.balance + discrepancy,
        discrepancy: discrepancy,
        note: "",
      };
    });
  }, [users]);

  const sortedUserReconciliations = [...mockUserReconciliations]
    .filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const valA = a[reconUserSort.key];
      const valB = b[reconUserSort.key];
      if (valA < valB) return reconUserSort.order === "asc" ? -1 : 1;
      if (valA > valB) return reconUserSort.order === "asc" ? 1 : -1;
      return 0;
    });

  const [viewedUser, setViewedUser] = useState<UserData | null>(null);
  const [userModalTab, setUserModalTab] = useState<"info" | "sessions">("info");
  const [sessUpdateTick, setSessUpdateTick] = useState(0);
  const [editFormData, setEditFormData] = useState<Partial<UserData>>({});
  const [selectedReconUser, setSelectedReconUser] = useState<any | null>(null);

  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Effect
  useEffect(() => {
    if (activeTab !== "overview") return;
    const controller = new AbortController();
    setStatsLoading(true);
    setStatsError(null);

    adminDashboardService
      .getStats(controller.signal)
      .then(setStats)
      .catch((e) => {
        if (e.code === "ERR_CANCELED") return;
        console.error("Stats error:", e.response?.data ?? e.message);
        setStatsError(e.response?.data?.message ?? e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStatsLoading(false);
      });

    return () => controller.abort();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "overview") return;

    fetch("/admin/dashboard/stats", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => console.log("raw response:", data))
      .catch((e) => console.error("fetch error:", e));
  }, [activeTab]);

  const handleLogout = async () => {
    await authService.logout();
    showToast("success", "Logged out successfully");
  };

  const handleConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
  ) => {
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  };

  const handleDeleteTransaction = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleConfirm("Delete Transaction?", "Cannot be undone.", () => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setConfirmModal(null);
      showToast("success", "Transaction deleted");
    });
  };

  const handleSingleCredit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForCredit || !creditAmount) return;
    setIsProcessingFunds(true);
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === selectedUserForCredit
            ? { ...u, balance: u.balance + Number(creditAmount) }
            : u,
        ),
      );
      setIsProcessingFunds(false);
      setCreditAmount("");
      showToast("success", "Funded successfully");
    }, 1000);
  };

  const handleBulkCredit = () => {
    if (selectedUsersForBulk.length === 0 || !creditAmount) return;
    setIsProcessingFunds(true);
    setTimeout(() => {
      setUsers((prev) =>
        prev.map((u) =>
          selectedUsersForBulk.includes(u.id)
            ? { ...u, balance: u.balance + Number(creditAmount) }
            : u,
        ),
      );
      setIsProcessingFunds(false);
      setCreditAmount("");
      showToast("success", "Bulk funded successfully");
    }, 1000);
  };

  const toggleUserSelection = (id: string) =>
    setSelectedUsersForBulk((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  const toggleAllUsers = () =>
    setSelectedUsersForBulk(
      selectedUsersForBulk.length === users.length
        ? []
        : users.map((u) => u.id),
    );

  const handleViewUserClick = (u: UserData) => {
    setViewedUser(u);
    setUserModalTab("info");
    setIsViewUserModalOpen(true);
  };

  const handleAdminKillSession = (id: string) => {
    sessionService.killSession(id);
    showToast("success", "Session terminated successfully.");
    setSessUpdateTick((prev) => prev + 1);
  };

  const handleAdminKillAllSessions = (email: string) => {
    sessionService.killAllUserSessions(email);
    showToast(
      "success",
      "All sessions (including active device logs) terminated for this user.",
    );
    setSessUpdateTick((prev) => prev + 1);
  };

  const handleDownloadStatement = (user: UserData) => {
    let userTxs = transactions.filter((t) => t.userId === user.id);

    if (userTxs.length === 0) {
      userTxs = [
        {
          id: `TX-${Date.now()}`,
          userId: user.id,
          userName: user.name,
          amount: 0.0,
          type: "account_created",
          flow: "in",
          status: "success",
          date: new Date().toISOString(),
        },
      ];
    }

    const headers = ["Date", "Type", "Flow", "Amount", "Status"];
    const rows = userTxs.map((t) => [
      new Date(t.date).toLocaleString(),
      t.type,
      t.flow,
      t.amount.toString(),
      t.status,
    ]);

    let csvContent =
      headers.join(",") + "\n" + rows.map((e) => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `statement_${user.name.replace(/\s+/g, "_")}_${Date.now()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("success", "Statement downloaded successfully");
  };
  const handleSortUsers = (key: keyof UserData) =>
    setUserSort((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));
  const handleSortTransactions = (key: keyof AdminTransaction) =>
    setTxSort((prev) => ({
      key,
      order: prev.key === key && prev.order === "asc" ? "desc" : "asc",
    }));

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* --- OVERVIEW TAB --- */}
      {activeTab === "overview" && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsLoading && (
              <div className="col-span-4 text-center text-slate-400 py-8 text-sm">
                Loading...
              </div>
            )}
            {statsError && (
              <div className="col-span-4 text-center text-red-500 py-8 text-sm">
                {statsError}
              </div>
            )}
            {!statsLoading &&
              stats &&
              [
                {
                  label: "Total Users",
                  value: stats.totalUsers,
                  icon: Users,
                  color: "text-blue-500",
                  bg: "bg-blue-100 dark:bg-blue-900/20",
                  trend: stats.userGrowthTrend,
                },
                {
                  label: "Total Volume",
                  value: `₦${stats.totalVolume.toLocaleString()}`,
                  icon: ArrowUpRight,
                  color: "text-green-500",
                  bg: "bg-green-100 dark:bg-green-900/20",
                  trend: stats.volumeTrend,
                },
                {
                  label: "System Health",
                  value: `${stats.systemHealthPercent}%`,
                  icon: Activity,
                  color: "text-indigo-500",
                  bg: "bg-indigo-100 dark:bg-indigo-900/20",
                  trend: "Stable",
                },
                {
                  label: "Pending KYC",
                  value: stats.pendingKyc,
                  icon: Shield,
                  color: "text-orange-500",
                  bg: "bg-orange-100 dark:bg-orange-900/20",
                  trend: "Needs Action",
                },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-all duration-300"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div
                      className={`p-4 rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform`}
                    >
                      <stat.icon className="w-6 h-6" />
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-lg ${stat.trend.includes("+") ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {stat.trend}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <h3 className="text-3xl font-black mt-1 tracking-tight">
                    {stat.value}
                  </h3>
                </div>
              ))}
          </div>

          {/* Quick Access & Align Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Quick Actions Card */}
            <div className="lg:col-span-2 bg-slate-900 dark:bg-slate-950 rounded-[2rem] p-8 text-white relative overflow-hidden group shadow-2xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <h3 className="text-2xl font-black mb-2">
                  Core Financial Operations
                </h3>
                <p className="text-slate-400 text-sm mb-10 max-w-md">
                  Access critical system modules to maintain platform integrity
                  and monitor real-time transaction flows.
                </p>

                <div className="flex flex-row items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                  <button
                    onClick={() => navigate("/admin/reconciliation")}
                    className="shrink-0 px-6 py-4 bg-primary hover:bg-primary-light text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all shadow-xl shadow-primary/30 active:scale-95 whitespace-nowrap"
                  >
                    <Activity className="w-5 h-5 shrink-0" /> System
                    Reconciliation
                  </button>
                  <button
                    onClick={() => navigate("/admin/transactions")}
                    className="shrink-0 px-6 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all backdrop-blur-md active:scale-95 whitespace-nowrap"
                  >
                    <Globe className="w-5 h-5 shrink-0" /> Global Transactions
                  </button>
                  <button
                    onClick={() => navigate("/admin/dlq")}
                    className="shrink-0 px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all backdrop-blur-md active:scale-95 whitespace-nowrap"
                  >
                    <AlertOctagon className="w-5 h-5 shrink-0 text-red-400" />{" "}
                    Dead Letter Queue (DLQ)
                  </button>
                </div>
              </div>
            </div>

            {/* Audit Summary Card */}
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <HistoryIcon className="w-5 h-5 text-primary" />
                  <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-widest text-xs">
                    Recent Admin Activity
                  </h4>
                </div>
                <div className="space-y-4">
                  {auditLogs.slice(0, 3).map((log) => (
                    <div key={log.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0"></div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate line-clamp-1">
                          {log.action}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {log.adminName} •{" "}
                          {new Date(log.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => navigate("/admin/audit")}
                className="mt-8 text-xs font-black text-primary hover:underline flex items-center gap-2"
              >
                VIEW ALL LOGS &rarr;
              </button>
            </div>
          </div>

          {/* Detailed Insights Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-black tracking-tight">
                  User Growth
                </h4>
                <div className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-500">
                  LAST 30 DAYS
                </div>
              </div>
              <div className="h-40 flex items-end gap-2 px-2">
                {[40, 25, 60, 45, 80, 55, 95].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-t-xl relative group overflow-hidden"
                  >
                    <div
                      className="absolute bottom-0 left-0 right-0 bg-primary group-hover:bg-primary-light transition-all duration-500 rounded-t-xl"
                      style={{ height: `${h}%` }}
                    ></div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-slate-400 px-1">
                <span>MON</span>
                <span>TUE</span>
                <span>WED</span>
                <span>THU</span>
                <span>FRI</span>
                <span>SAT</span>
                <span>SUN</span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-black tracking-tight">
                  System Distribution
                </h4>
                <Settings className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-6 flex-1 flex flex-col justify-center">
                {[
                  {
                    label: "Active Sessions",
                    val: 124,
                    max: 200,
                    color: "bg-blue-500",
                  },
                  {
                    label: "Transaction Rate",
                    val: 45,
                    max: 100,
                    color: "bg-green-500",
                  },
                  {
                    label: "API Latency",
                    val: 85,
                    max: 100,
                    color: "bg-purple-500",
                  },
                ].map((bar, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-slate-500 uppercase tracking-widest">
                        {bar.label}
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        {bar.val}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${bar.color} rounded-full`}
                        style={{ width: `${(bar.val / bar.max) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System Controls & Logs Detail */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
            <div className="xl:col-span-3 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <HistoryIcon className="w-5 h-5 text-slate-500" />
                  </div>
                  <h4 className="font-black tracking-tight">
                    Real-time System Logs
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Live Streaming
                  </span>
                </div>
              </div>
              <div className="p-0 max-h-80 overflow-y-auto no-scrollbar font-mono">
                {[
                  {
                    t: "14:22:01",
                    l: "INFO",
                    m: "Batch settlement job started successfully",
                    c: "text-blue-500",
                  },
                  { t: "14:21:45", l: "WARN", m: "High latency detected" },
                  { t: "14:20:12", l: "CRIT", m: "KYC WebHook timeout" },
                  { t: "14:19:55", l: "INFO", m: "New user joined: alex_fin" },
                  {
                    t: "14:18:30",
                    l: "INFO",
                    m: "Config updated: system_mode=PROD",
                  },
                  { t: "14:17:10", l: "INFO", m: "Cache cleared for users:12" },
                ].map((log, i) => (
                  <div
                    key={i}
                    className="px-6 py-4 border-b border-slate-50 dark:border-slate-800/50 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <span className="text-[10px] text-slate-400 shrink-0 mt-0.5">
                      {log.t}
                    </span>
                    <span
                      className={`text-[10px] font-black shrink-0 px-2 py-0.5 rounded ${log.l === "CRIT" ? "bg-red-100 text-red-600" : log.l === "WARN" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}
                    >
                      {log.l}
                    </span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                      {log.m}
                    </p>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/50 text-center">
                <button className="text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                  Download Audit Log (.csv)
                </button>
              </div>
            </div>

            <div className="bg-slate-900 dark:bg-black rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-white font-black mb-6 tracking-tight flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" /> Quick Toggles
                </h4>
                <div className="space-y-6">
                  {[
                    { label: "Maintenance Mode", active: false },
                    { label: "Auto-KYC Verification", active: true },
                    { label: "Freeze Global Transfers", active: false },
                    { label: "Enable Sandbox Data", active: true },
                  ].map((toggle, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">
                        {toggle.label}
                      </span>
                      <button
                        className={`w-10 h-5 rounded-full relative transition-colors ${toggle.active ? "bg-primary" : "bg-slate-700"}`}
                      >
                        <div
                          className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${toggle.active ? "right-1" : "left-1"}`}
                        ></div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-8 w-full py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 text-xs tracking-widest uppercase">
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- USERS TAB --- */}
      {activeTab === "users" && <UsersTab />}

      {/* --- TRANSACTIONS TAB --- */}
      {activeTab === "transactions" && <GlobalTransactionsPanel />}

      {/* --- FUNDS MANAGEMENT TAB --- */}
      {activeTab === "funds" && <FundManagementTab />}

      {/* --- AUDIT LOGS TAB --- */}
      {activeTab === "audit" && <AuditLogsTab />}

      {/* --- RECONCILIATION TAB --- */}
      {activeTab === "settings" && <AdminReconciliationScreen />}

      {/* Reconciliation Detail Modal */}
      {selectedReconUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div>
                <h3 className="text-2xl font-black tracking-tight">
                  Reconciliation Audit
                </h3>
                <p className="text-slate-500 text-sm font-medium">
                  Detailed breakdown for {selectedReconUser.name}
                </p>
              </div>
              <button
                onClick={() => setSelectedReconUser(null)}
                className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>
            <div className="p-8 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Ledger Balance
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${selectedReconUser.ledgerBalance.toLocaleString()}
                  </p>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700/50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Actual Balance
                  </p>
                  <p className="text-2xl font-black text-slate-900 dark:text-white">
                    ${selectedReconUser.actualBalance.toLocaleString()}
                  </p>
                </div>
              </div>

              {selectedReconUser.discrepancy !== 0 && (
                <div className="p-6 bg-red-50 dark:bg-red-900/10 border-2 border-red-100 dark:border-red-900/20 rounded-[1.5rem] flex items-center gap-4">
                  <div className="w-12 h-12 bg-red-500 text-white rounded-2xl flex items-center justify-center shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-red-700 dark:text-red-400 font-black text-sm">
                      Discrepancy Found: $
                      {selectedReconUser.discrepancy > 0 ? "+" : ""}
                      {selectedReconUser.discrepancy.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                    <p className="text-red-600/70 dark:text-red-400/70 text-xs font-medium">
                      The system has flagged this account. Internal ledger
                      records do not match the real-time account balance.
                    </p>
                    {(selectedReconUser as any).note && (
                      <p className="mt-2 text-sm text-red-800 dark:text-red-300 font-bold bg-white/50 dark:bg-black/20 px-3 py-2 rounded-lg">
                        Note: {(selectedReconUser as any).note}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-black uppercase tracking-widest text-slate-400">
                  Potential Causes
                </h4>
                <div className="space-y-3">
                  {[
                    { label: "Unsettled batch transaction", risk: "High" },
                    {
                      label: "Rounding error in currency conversion",
                      risk: "Low",
                    },
                    { label: "Duplicate ledger entry", risk: "Medium" },
                  ].map((cause, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-primary"></div>
                        <span className="text-sm font-bold">{cause.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-1 rounded-lg ${cause.risk === "High" ? "bg-red-100 text-red-600" : cause.risk === "Medium" ? "bg-yellow-100 text-yellow-600" : "bg-blue-100 text-blue-600"}`}
                      >
                        {cause.risk} RISK
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
              <button
                onClick={() => setSelectedReconUser(null)}
                className="px-6 py-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-bold rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button className="px-8 py-3 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-dark transition-all active:scale-95">
                Trigger Fix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CONFIRMATION MODAL --- */}
      {confirmModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">
                {confirmModal.title}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                {confirmModal.message}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className="flex-1 py-4 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Yes, Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- USER DETAILS MODAL --- */}
      {isViewUserModalOpen && viewedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${viewedUser.avatarSeed}`}
                  className="w-12 h-12 rounded-full bg-white shadow-sm border border-slate-200"
                />
                <div>
                  <h3 className="text-2xl font-black tracking-tight">
                    {viewedUser.name}
                  </h3>
                  <p className="text-slate-500 text-sm font-medium">
                    {viewedUser.email} • ID: {viewedUser.id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsViewUserModalOpen(false)}
                className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-colors"
              >
                <XCircle className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto space-y-8 flex-1 w-full">
              {/* Key Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Balance
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white truncate">
                    $
                    {viewedUser.balance.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Vaults Linked
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {Math.floor(Math.random() * 3) + 1}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Total Wallets
                  </p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    {Math.floor(Math.random() * 4) + 1}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700/50 w-full overflow-hidden">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-1 truncate">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge status={viewedUser.status} />
                  </div>
                </div>
              </div>

              {/* Tabs Switcher inside Modal */}
              <div className="flex border-b border-slate-100 dark:border-slate-800 gap-6">
                <button
                  onClick={() => setUserModalTab("info")}
                  className={`pb-3 text-xs font-black tracking-widest uppercase border-b-2 transition-all ${userModalTab === "info" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  Account Profile
                </button>
                <button
                  onClick={() => setUserModalTab("sessions")}
                  className={`pb-3 text-xs font-black tracking-widest uppercase border-b-2 transition-all flex items-center gap-2 ${userModalTab === "sessions" ? "border-primary text-primary" : "border-transparent text-slate-400 hover:text-slate-600"}`}
                >
                  Active Sessions (
                  {sessionService.getUserSessions(viewedUser.email).length})
                </button>
              </div>

              {userModalTab === "info" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-300">
                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <UserIcon className="w-4 h-4" /> Account Details
                    </h4>
                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="text-xs text-slate-500 font-bold">
                          Role
                        </span>
                        <span className="text-sm font-semibold capitalize">
                          {viewedUser.role}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="text-xs text-slate-500 font-bold">
                          Joined Date
                        </span>
                        <span className="text-sm font-semibold">
                          {viewedUser.joinedDate}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="text-xs text-slate-500 font-bold">
                          KYC Status
                        </span>
                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black rounded-lg">
                          VERIFIED
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="text-xs text-slate-500 font-bold">
                          Trading Tier
                        </span>
                        <span className="text-sm font-semibold">Tier 2</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-700/50">
                        <span className="text-xs text-slate-500 font-bold">
                          2FA Status
                        </span>
                        <span className="text-sm font-semibold text-green-600 flex items-center gap-1">
                          <Shield className="w-3 h-3" /> Enabled
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-slate-500 font-bold">
                          Last Login
                        </span>
                        <span className="text-sm font-semibold">
                          Today, 10:42 AM
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <HistoryIcon className="w-4 h-4" /> Recent Activity
                    </h4>
                    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4">
                      <div className="space-y-4">
                        {transactions
                          .filter((t) => t.userId === viewedUser.id)
                          .slice(0, 4)
                          .map((tx, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-xl ${tx.flow === "in" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"}`}
                                >
                                  <Activity className="w-4 h-4" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 dark:text-white capitalize">
                                    {tx.type}
                                  </p>
                                  <p className="text-[10px] text-slate-500">
                                    {new Date(tx.date).toLocaleDateString()}
                                  </p>
                                </div>
                              </div>
                              <span
                                className={`text-sm font-black ${tx.flow === "in" ? "text-green-500" : "text-slate-900 dark:text-white"}`}
                              >
                                {tx.flow === "in" ? "+" : "-"}$
                                {tx.amount.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        {transactions.filter((t) => t.userId === viewedUser.id)
                          .length === 0 && (
                          <p className="text-xs text-slate-500 text-center py-4">
                            No recent activity found.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end mt-4">
                      <button
                        onClick={() => handleDownloadStatement(viewedUser)}
                        className="text-xs font-bold text-primary hover:text-primary-light transition-colors"
                      >
                        Download Statement &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-300 w-full">
                  {/* Admin Kill All User Sessions Button */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-950/40 rounded-3xl gap-4">
                    <div className="space-y-1">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        Emergency Session Invalidation
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Instantly revoke all active login locks and signatures
                        of this user across all devices.
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        handleAdminKillAllSessions(viewedUser.email)
                      }
                      className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-red-955/15 flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-center"
                    >
                      <Trash2 className="w-4 h-4 text-white" /> Kill All
                      Sessions
                    </button>
                  </div>

                  {/* Admin User Sessions List */}
                  <div className="space-y-4">
                    {sessionService.getUserSessions(viewedUser.email).length ===
                    0 ? (
                      <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/10 border border-dashed rounded-3xl border-slate-200 dark:border-slate-800">
                        <Smartphone className="w-10 h-10 text-slate-300 mx-auto mb-3 animate-pulse" />
                        <p className="text-sm text-slate-500 font-bold">
                          No active sessions found for this user.
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 font-semibold">
                          They are currently completely signed out of all
                          devices.
                        </p>
                      </div>
                    ) : (
                      sessionService
                        .getUserSessions(viewedUser.email)
                        .map((sess) => {
                          const isCurrentAdminSession =
                            sess.id === sessionService.getCurrentSessionId();
                          return (
                            <div
                              key={sess.id}
                              className={`p-5 rounded-3xl border transition-all ${isCurrentAdminSession ? "bg-primary/5 dark:bg-primary/10 border-primary/20 dark:border-primary/30" : "bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800"}`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-4">
                                  <div
                                    className={`p-3 rounded-2xl ${isCurrentAdminSession ? "bg-primary/10 text-primary" : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0"}`}
                                  >
                                    {sess.device
                                      .toLowerCase()
                                      .includes("macbook") ||
                                    sess.device.toLowerCase().includes("pc") ? (
                                      <Laptop className="w-5 h-5" />
                                    ) : (
                                      <Smartphone className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                                        {sess.browser} on {sess.device}
                                      </h4>
                                      {isCurrentAdminSession && (
                                        <span className="px-2.5 py-1 bg-primary/15 text-primary text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3" />{" "}
                                          Your Active Session
                                        </span>
                                      )}
                                    </div>

                                    {/* Location / IP */}
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-350 font-semibold">
                                      <span className="flex items-center gap-1">
                                        <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                                        {sess.location}
                                      </span>
                                      <span className="flex items-center gap-1 mt-0.5">
                                        <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                                        {sess.ipAddress}
                                      </span>
                                    </div>

                                    {/* Authorized and last active */}
                                    <div className="flex flex-col gap-1 mt-3.5 text-xs text-slate-405 dark:text-slate-500 font-semibold">
                                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                                        <span>
                                          Authorized:{" "}
                                          {new Date(
                                            sess.loginTime,
                                          ).toLocaleString("en-US", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                          })}
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                                        <span>
                                          Last active:{" "}
                                          {new Date(
                                            sess.lastActive,
                                          ).toLocaleString("en-US", {
                                            dateStyle: "medium",
                                            timeStyle: "short",
                                          })}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Kill button */}
                                <button
                                  onClick={() =>
                                    handleAdminKillSession(sess.id)
                                  }
                                  className="p-3 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-2xl transition-all self-center border border-red-110/10"
                                  title={
                                    isCurrentAdminSession
                                      ? "Terminate your own session"
                                      : "Revoke credentials access index"
                                  }
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardScreen;

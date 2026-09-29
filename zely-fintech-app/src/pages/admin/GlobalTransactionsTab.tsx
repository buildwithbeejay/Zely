import { useEffect, useState } from "react";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
// adjust path
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/statusBadge";
import {
  AdminTransactionRow,
  adminTransactionService,
} from "@/services/admin.service";

const STATUS_OPTIONS: string[] = []; // fill with your real status enum values — see note below
const DIRECTION_OPTIONS = ["credit", "debit"];
const WALLET_OPTIONS = ["MAIN_CHECKINGS", "SAVINGS", "VAULT"];

const money = (n: number, currency = "NGN") =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(
    n ?? 0,
  );

function describeTransaction(t: {
  direction: string;
  counterpartyName?: string;
  counterpartyWalletType?: string;
  category?: string;
}) {
  const isCredit = t.direction === "credit";
  if (t.counterpartyName)
    return isCredit ? `From ${t.counterpartyName}` : `To ${t.counterpartyName}`;
  if (t.counterpartyWalletType) {
    const wallet = t.counterpartyWalletType.replace(/_/g, " ").toLowerCase();
    return isCredit ? `From ${wallet}` : `To ${wallet}`;
  }
  return t.category ? t.category.replace(/_/g, " ") : "Transaction";
}

const selectCls =
  "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function GlobalTransactionsPanel() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput);
  const [status, setStatus] = useState("");
  const [direction, setDirection] = useState("");
  const [walletType, setWalletType] = useState("");
  const [sort, setSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "occurredAt",
    order: "desc",
  });
  const [page, setPage] = useState(1);

  const [transactions, setTransactions] = useState<AdminTransactionRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate(); // call the hook, get back a function
  const { userId } = useParams<{ userId?: string }>();

  useEffect(() => setPage(1), [search, status, direction, walletType]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminTransactionService
      .getAll(
        {
          search,
          status,
          direction,
          walletType,
          page,
          limit: 20,
          sort: sort.key === "amount" ? "amount" : "occurredAt",
          order: sort.order,
        },
        controller.signal,
      )
      .then((res) => {
        setTransactions(res.transactions);
        setMeta({ total: res.total, pages: res.pages });
      })
      .catch((e) => {
        if (e.code === "ERR_CANCELED") return;
        setError(e.response?.data?.message ?? e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [search, status, direction, walletType, page, sort.key, sort.order]);

  const toggleSort = (key: string) => {
    if (key !== "amount" && key !== "date") return; // only these two are server-sortable right now
    const field = key === "date" ? "occurredAt" : key;
    setSort((s) =>
      s.key === field
        ? { key: field, order: s.order === "asc" ? "desc" : "asc" }
        : { key: field, order: "asc" },
    );
  };

  const COLUMNS = [
    { key: "id", label: "ID" },
    { key: "userName", label: "USER" },
    { key: "type", label: "TYPE" },
    { key: "amount", label: "AMOUNT" },
    { key: "status", label: "STATUS" },
    { key: "date", label: "DATE" },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-[200px]">
          <h2 className="text-lg font-bold">Transaction History</h2>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ID or User..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={selectCls}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className={selectCls}
            aria-label="Filter by direction"
          >
            <option value="">Credit & debit</option>
            {DIRECTION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={walletType}
            onChange={(e) => setWalletType(e.target.value)}
            className={selectCls}
            aria-label="Filter by wallet"
          >
            <option value="">All wallets</option>
            {WALLET_OPTIONS.map((w) => (
              <option key={w} value={w}>
                {w.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
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
                    {sort.key === (key === "date" ? "occurredAt" : key) &&
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
                  Loading transactions...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-6 py-12 text-center text-red-500 text-sm"
                >
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && transactions.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="px-6 py-12 text-center text-slate-500 text-sm"
                >
                  No transactions found
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              transactions.map((tx) => (
                <tr
                  key={tx.transactionId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {tx.transactionId}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => navigate(`/admin/users/${tx.userId}`)}
                      className="font-bold text-slate-900 dark:text-white hover:text-primary transition-colors text-left"
                    >
                      {tx.userName}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {tx.direction === "credit" ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="text-xs">{describeTransaction(tx)}</span>
                    </div>
                  </td>
                  <td
                    className={`px-6 py-4 font-bold ${tx.direction === "credit" ? "text-emerald-600" : "text-slate-900 dark:text-white"}`}
                  >
                    {tx.direction === "credit" ? "+" : "-"}
                    {money(tx.amount, tx.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {new Date(tx.occurredAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
        <span>{meta.total.toLocaleString()} transactions</span>
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
            Page {page} of {Math.max(meta.pages, 1)}
          </span>
          <button
            disabled={page >= meta.pages || loading}
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

export default GlobalTransactionsPanel;

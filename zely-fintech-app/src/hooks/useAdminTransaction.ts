// admin/transactions/hooks.ts
import {
  AdminTransactionRow,
  adminTransactionService,
  AdminTransactionsQuery,
} from "@/services/admin.service";
import { useEffect, useState } from "react";

const clean = (q: AdminTransactionsQuery) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== "" && v !== undefined),
  );

export function useAdminTransactions(query: AdminTransactionsQuery) {
  const [transactions, setTransactions] = useState<AdminTransactionRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminTransactionService
      .getAll(clean(query), controller.signal)
      .then((res: any) => {
        setTransactions(res.transactions);
        setMeta({ total: res.total, pages: res.pages });
      })
      .catch((e: any) => {
        if (e.code === "ERR_CANCELED") return;
        setError(e.response?.data?.message ?? e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [key, reloadKey]);

  return {
    transactions,
    ...meta,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
  };
}

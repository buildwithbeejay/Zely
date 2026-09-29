import {
  adminService,
  AdminUserDetail,
  AdminUserRow,
  AdminUsersQuery,
} from "@/services/admin.service";
import { useEffect, useState } from "react";

const clean = (q: AdminUsersQuery) =>
  Object.fromEntries(
    Object.entries(q).filter(([, v]) => v !== "" && v !== undefined),
  );

export function useAdminUsers(query: AdminUsersQuery) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const key = JSON.stringify(query);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminService
      .getUsers(clean(query), controller.signal)
      .then((res: any) => {
        setUsers(res.users);
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
  }, [key, reloadKey]);

  return {
    users,
    ...meta,
    loading,
    error,
    reload: () => setReloadKey((k) => k + 1),
  };
}

export function useAdminUserDetail(userId: string) {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminService
      .getUserDetail(userId, controller.signal)
      .then((res) => setData(res.data))
      .catch((e) => {
        if (e.code === "ERR_CANCELED") return;
        setError(e.response?.data?.message ?? e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [userId, reloadKey]);

  return { data, loading, error, reload: () => setReloadKey((k) => k + 1) };
}

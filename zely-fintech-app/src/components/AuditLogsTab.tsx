import { StatusBadge } from "@/components/statusBadge";
import { useDebouncedValue } from "@/hooks/useDebounceValue";
import { AdminAuditLogRow, adminAuditService } from "@/services/admin.service";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import React, { useEffect, useState } from "react";

const SEVERITY_OPTIONS = ["INFO", "WARN", "CRITICAL"];
const STATUS_OPTIONS = [
  "CREATED",
  "PENDING",
  "IN_PROGRESS",
  "SUCCESS",
  "COMPLETED",
  "FAILED",
  "BLOCKED",
  "ERROR",
];

const severityStyles: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARN: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function AuditLogsTab() {
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput);
  const [status, setStatus] = useState("");
  const [severity, setSeverity] = useState("");
  const [page, setPage] = useState(1);

  const [logs, setLogs] = useState<AdminAuditLogRow[]>([]);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const selectCls =
    "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

  useEffect(() => setPage(1), [search, status, severity]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    adminAuditService
      .getAll({ search, status, severity, page, limit: 25 }, controller.signal)
      .then((res) => {
        setLogs(res.logs);
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
  }, [search, status, severity, page]);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold mr-2">Administrative Audit Logs</h2>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search email, action, IP..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={selectCls}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className={selectCls}
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase font-bold text-[10px] tracking-widest">
            <tr>
              <th className="px-6 py-4">Action</th>
              <th className="px-6 py-4">User / Email</th>
              <th className="px-6 py-4">IP Address</th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Severity</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-slate-500"
                >
                  Loading logs...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-red-500 text-sm"
                >
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && logs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-slate-500 text-sm"
                >
                  No logs found
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    onClick={() =>
                      setExpandedId(expandedId === log.id ? null : log.id)
                    }
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">
                      {log.action}
                    </td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400 text-xs">
                      {log.trackedEmail}
                      {log.attemptCount > 1 && (
                        <span className="ml-2 text-amber-600 font-bold">
                          ×{log.attemptCount}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">
                      {log.ip}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${severityStyles[log.severity] ?? "bg-slate-100 text-slate-700"}`}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={log.status} />
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 text-xs font-mono whitespace-pre-wrap"
                      >
                        <p className="mb-1">
                          <span className="font-bold">User Agent:</span>{" "}
                          {log.userAgent}
                        </p>
                        {log.userId && (
                          <p className="mb-1">
                            <span className="font-bold">User ID:</span>{" "}
                            {log.userId}
                          </p>
                        )}
                        {log.metadata &&
                          Object.keys(log.metadata).length > 0 && (
                            <pre className="mt-2">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500">
        <span>{meta.total.toLocaleString()} log entries</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => p - 1)}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40"
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
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogsTab;

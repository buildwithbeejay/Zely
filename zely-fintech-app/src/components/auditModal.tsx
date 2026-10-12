import { AdminAuditLogRow } from "@/services/admin.service";
import { StatusBadge } from "@/components/statusBadge";
import { X, Copy, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const severityStyles: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARN: "bg-yellow-100 text-yellow-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function parseUserAgent(ua: string) {
  let browser = "Unknown Browser";
  if (ua.includes("Firefox/")) {
    const v = ua.match(/Firefox\/([\d.]+)/)?.[1];
    browser = `Firefox ${v ?? ""}`.trim();
  } else if (ua.includes("Edg/")) {
    const v = ua.match(/Edg\/([\d.]+)/)?.[1];
    browser = `Edge ${v ?? ""}`.trim();
  } else if (ua.includes("Chrome/")) {
    const v = ua.match(/Chrome\/([\d.]+)/)?.[1];
    browser = `Chrome ${v ?? ""}`.trim();
  } else if (ua.includes("Safari/")) {
    const v = ua.match(/Version\/([\d.]+)/)?.[1];
    browser = `Safari ${v ?? ""}`.trim();
  }

  let os = "Unknown OS";
  if (ua.includes("Windows NT")) os = "Windows";
  else if (ua.includes("Ubuntu")) os = "Ubuntu Linux";
  else if (ua.includes("Mac OS X")) os = "macOS";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Linux")) os = "Linux";

  return { browser, os };
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 text-slate-400 hover:text-primary transition-colors"
    >
      <Copy className="w-3.5 h-3.5 inline" />
      {copied && (
        <span className="ml-1 text-[10px] text-green-500">Copied</span>
      )}
    </button>
  );
}

interface Props {
  log: AdminAuditLogRow | null;
  onClose: () => void;
}

export function AuditLogModal({ log, onClose }: Props) {
  const navigate = useNavigate();

  if (!log) return null;

  const { browser, os } = parseUserAgent(log.userAgent ?? "");
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col gap-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase w-fit ${severityStyles[log.severity] ?? "bg-slate-100 text-slate-700"}`}
            >
              {log.severity}
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {log.action}
            </h2>
            <p className="text-xs text-slate-500">
              {new Date(log.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={log.status} />
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm">
          {/* User */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              User
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Email</span>
                <span className="text-slate-900 dark:text-white text-xs font-medium">
                  {log.trackedEmail}
                </span>
              </div>
              {log.userId && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">User ID</span>
                  <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                    {log.userId}
                    <CopyButton text={log.userId} />
                  </span>
                </div>
              )}
              {log.attemptCount > 1 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Attempts</span>
                  <span className="text-amber-600 font-bold text-xs">
                    ×{log.attemptCount}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Session */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Session
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">IP Address</span>
                <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  {log.ip}
                  <CopyButton text={log.ip} />
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">Browser</span>
                <span className="text-slate-700 dark:text-slate-300 text-xs">
                  {browser}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-xs">OS</span>
                <span className="text-slate-700 dark:text-slate-300 text-xs">
                  {os}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata */}
          {hasMetadata && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
                Metadata
              </p>
              <pre className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 text-xs font-mono text-slate-700 dark:text-slate-300 overflow-x-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        {log.userId && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
            <button
              onClick={() => navigate(`/admin/users/${log.userId}`)}
              className="flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-4 h-4" />
              View User
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

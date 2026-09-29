interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");

  const normalized = status.toUpperCase();

  const className =
    normalized.includes("FAILED") || normalized.includes("REJECTED")
      ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
      : normalized.includes("PENDING") || normalized.includes("PROVISIONING")
        ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        : normalized.includes("READY") ||
            normalized.includes("VERIFIED") ||
            normalized === "ACTIVE" ||
            normalized === "COMPLETED"
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}

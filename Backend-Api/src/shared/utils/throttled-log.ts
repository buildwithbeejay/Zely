import { logger } from "@/shared/utils/logger";

const seen = new Map<string, { last: number; suppressed: number }>();

export function logThrottled(
  level: "info" | "warn" | "error",
  key: string,
  msg: string,
  meta?: object,
  everyMs = 60_000,
) {
  const now = Date.now();
  const s = seen.get(key) ?? { last: 0, suppressed: 0 };
  if (now - s.last < everyMs) {
    s.suppressed++;
    seen.set(key, s);
    return;
  }
  const suffix = s.suppressed ? ` (+${s.suppressed} similar suppressed)` : "";
  seen.set(key, { last: now, suppressed: 0 });
  logger[level](msg + suffix, meta);
}

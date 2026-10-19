import { logThrottled } from "@/shared/utils/throttled-log";

export function quietBullErrors(
  target: { on: (event: "error", cb: (err: any) => void) => unknown },
  name: string,
) {
  target.on("error", (err: any) => {
    const code =
      err?.code ?? err?.errors?.[0]?.code ?? err?.message ?? "unknown";
    // one key per error code, so seven queues don't produce seven lines per minute
    logThrottled(
      "error",
      `bullmq-${code}`,
      `❌ BullMQ[${name}] error: ${code}`,
    );
  });
}

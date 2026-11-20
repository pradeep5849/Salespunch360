import { logEvent } from "./lib/logging";
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { hostedRemindersEnabled, startHostedReminderScheduler } =
      await import("./lib/field-jobs/hosted-reminders");
    if (
      hostedRemindersEnabled(
        { ...process.env, NEXT_RUNTIME: "nodejs" },
        process.argv,
      )
    )
      startHostedReminderScheduler();
  }
}

export function onRequestError(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof error.code === "string" &&
    /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
  logEvent("error", {
    category: "WEB_REQUEST",
    correlationId: globalThis.crypto.randomUUID(),
    code,
  });
}

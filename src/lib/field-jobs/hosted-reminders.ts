import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/logging";
import { generateFollowUpReminders } from "@/lib/sales-notifications/service";

async function generateDailyReminders(now: Date) {
  await generateFollowUpReminders(now);
  const { generateBillingRenewalReminders } = await import("@/lib/billing/renewal-reminders");
  await generateBillingRenewalReminders(now);
}

const jobName = "daily-follow-up-reminders";
const leaseMs = 15 * 60_000;

export function reminderBusinessDate(now: Date): string | null {
  const india = new Date(now.getTime() + 330 * 60_000);
  return india.getUTCHours() >= 8 ? india.toISOString().slice(0, 10) : null;
}

export function hostedRemindersEnabled(
  env: Record<string, string | undefined>,
  argv: string[],
) {
  return (
    env.NODE_ENV === "production" &&
    env.NEXT_RUNTIME === "nodejs" &&
    env.CI !== "true" &&
    env.CI !== "1" &&
    env.HOSTED_REMINDERS_DISABLED !== "1" &&
    env.NEXT_PHASE !== "phase-production-build" &&
    env.NEXT_PRIVATE_BUILD_WORKER !== "1" &&
    !argv.includes("build")
  );
}

/** A durable daily claim prevents worker/restart duplicates. Existing notification keys make crash retries idempotent. */
export async function runHostedFollowUpReminders(
  now = new Date(),
  {
    client = db,
    generate = generateDailyReminders,
  }: {
    client?: Pick<typeof db, "hostedJobRun">;
    generate?: (now: Date) => Promise<unknown>;
  } = {},
) {
  const businessDate = reminderBusinessDate(now);
  if (!businessDate) return "before-due";
  const identity = { jobName, businessDate };
  const where = { jobName_businessDate: identity };
  const existing = await client.hostedJobRun.findUnique({ where });
  if (existing?.completedAt || (existing && existing.leaseUntil > now))
    return "already-claimed";
  const ownerToken = randomUUID();
  const leaseUntil = new Date(now.getTime() + leaseMs);
  let claimed = false;
  if (!existing) {
    const inserted = await client.hostedJobRun.createMany({
      data: [{ ...identity, ownerToken, leaseUntil }],
      skipDuplicates: true,
    });
    claimed = inserted.count === 1;
  }
  if (!claimed) {
    const recovered = await client.hostedJobRun.updateMany({
      where: { ...identity, completedAt: null, leaseUntil: { lte: now } },
      data: {
        ownerToken,
        leaseUntil,
        attempts: { increment: 1 },
        lastErrorCode: null,
      },
    });
    if (!recovered.count) return "already-claimed";
  }
  const owner = { ...identity, ownerToken, completedAt: null };
  const heartbeat = setInterval(() => {
    void client.hostedJobRun
      .updateMany({
        where: owner,
        data: { leaseUntil: new Date(Date.now() + leaseMs) },
      })
      .catch(() =>
        logEvent("warn", {
          category: "HOSTED_REMINDERS",
          code: "LEASE_REFRESH_FAILED",
        }),
      );
  }, 60_000);
  heartbeat.unref();
  logEvent("info", { category: "HOSTED_REMINDERS", code: "SWEEP_STARTED" });
  try {
    await generate(now);
    const completed = await client.hostedJobRun.updateMany({
      where: owner,
      data: {
        completedAt: new Date(),
        leaseUntil: new Date(),
        lastErrorCode: null,
      },
    });
    if (!completed.count) {
      logEvent("warn", {
        category: "HOSTED_REMINDERS",
        code: "LEASE_LOST_RETRY_PENDING",
      });
      return "lease-lost";
    }
    logEvent("info", { category: "HOSTED_REMINDERS", code: "SWEEP_COMPLETED" });
    return "completed";
  } catch {
    await client.hostedJobRun.updateMany({
      where: owner,
      data: {
        leaseUntil: new Date(Date.now() + 5 * 60_000),
        lastErrorCode: "REMINDER_SWEEP_FAILED",
      },
    });
    logEvent("error", {
      category: "HOSTED_REMINDERS",
      code: "SWEEP_FAILED_RETRY_PENDING",
    });
    return "retry-pending";
  } finally {
    clearInterval(heartbeat);
  }
}

const schedulerGlobal = globalThis as typeof globalThis & {
  hostedReminderTimer?: ReturnType<typeof setInterval>;
  hostedReminderInitial?: ReturnType<typeof setTimeout>;
};

export function stopHostedReminderScheduler() {
  clearInterval(schedulerGlobal.hostedReminderTimer);
  clearTimeout(schedulerGlobal.hostedReminderInitial);
  delete schedulerGlobal.hostedReminderTimer;
  delete schedulerGlobal.hostedReminderInitial;
  logEvent("info", { category: "HOSTED_REMINDERS", code: "SCHEDULER_STOPPED" });
}

export function startHostedReminderScheduler() {
  if (schedulerGlobal.hostedReminderTimer) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const { processFieldJobs } = await import("./service");
      const results = await Promise.allSettled([
        processFieldJobs(),
        runHostedFollowUpReminders(),
      ]);
      if (results.some((result) => result.status === "rejected")) {
        logEvent("error", {
          category: "HOSTED_REMINDERS",
          code: "HOSTED_JOB_RETRY_PENDING",
        });
      }
    } catch {
      logEvent("error", {
        category: "HOSTED_REMINDERS",
        code: "SCHEDULER_UNAVAILABLE_RETRY_PENDING",
      });
    } finally {
      running = false;
    }
  };
  schedulerGlobal.hostedReminderTimer = setInterval(() => {
    void tick();
  }, 60_000);
  schedulerGlobal.hostedReminderTimer.unref();
  schedulerGlobal.hostedReminderInitial = setTimeout(() => {
    void tick();
  }, 30_000);
  schedulerGlobal.hostedReminderInitial.unref();
  logEvent("info", {
    category: "HOSTED_REMINDERS",
    code: "SCHEDULER_STARTED_0800_INDIA",
  });
}

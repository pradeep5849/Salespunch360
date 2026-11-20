import { afterEach, beforeEach, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
  generate: vi.fn(),
  log: vi.fn(),
  queue: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    hostedJobRun: {
      findUnique: m.findUnique,
      createMany: m.createMany,
      updateMany: m.updateMany,
    },
  },
}));
vi.mock("@/lib/sales-notifications/service", () => ({
  generateFollowUpReminders: m.generate,
}));
vi.mock("@/lib/logging", () => ({ logEvent: m.log }));
vi.mock("./service", () => ({ processFieldJobs: m.queue }));
import {
  hostedRemindersEnabled,
  reminderBusinessDate,
  runHostedFollowUpReminders,
  startHostedReminderScheduler,
  stopHostedReminderScheduler,
} from "./hosted-reminders";

beforeEach(() => {
  vi.clearAllMocks();
  m.findUnique.mockResolvedValue(null);
  m.createMany.mockResolvedValue({ count: 1 });
  m.updateMany.mockResolvedValue({ count: 1 });
  m.generate.mockResolvedValue({ processed: 2, created: 1 });
  m.queue.mockResolvedValue({ processed: 0, completed: 0 });
});

afterEach(() => {
  stopHostedReminderScheduler();
  vi.useRealTimers();
});

it("becomes due at 08:00 India and uses India's date across UTC midnight", () => {
  expect(reminderBusinessDate(new Date("2026-11-20T02:29:59Z"))).toBeNull();
  expect(reminderBusinessDate(new Date("2026-11-20T02:30:00Z"))).toBe(
    "2026-11-20",
  );
  expect(reminderBusinessDate(new Date("2026-11-20T18:29:59Z"))).toBe(
    "2026-11-20",
  );
  expect(reminderBusinessDate(new Date("2026-11-20T18:30:00Z"))).toBeNull();
});

it("does not access the database before the scheduled time", async () => {
  expect(
    await runHostedFollowUpReminders(new Date("2026-11-20T02:29:00Z")),
  ).toBe("before-due");
  expect(m.findUnique).not.toHaveBeenCalled();
  expect(m.generate).not.toHaveBeenCalled();
});

it.each([
  { completedAt: new Date(), leaseUntil: new Date(0) },
  { completedAt: null, leaseUntil: new Date("2026-11-20T04:00:00Z") },
])("skips completed or actively leased work", async (existing) => {
  m.findUnique.mockResolvedValue(existing);
  expect(
    await runHostedFollowUpReminders(new Date("2026-11-20T03:00:00Z")),
  ).toBe("already-claimed");
  expect(m.generate).not.toHaveBeenCalled();
});

it("completes only the lease it owns after the sweep succeeds", async () => {
  const now = new Date("2026-11-20T03:00:00Z");
  expect(await runHostedFollowUpReminders(now)).toBe("completed");
  const ownerToken = m.createMany.mock.calls[0][0].data[0].ownerToken;
  expect(m.generate).toHaveBeenCalledWith(now);
  expect(m.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ ownerToken, completedAt: null }),
      data: expect.objectContaining({ completedAt: expect.any(Date) }),
    }),
  );
});

it("loses a simultaneous claim without running a second sweep", async () => {
  m.createMany.mockResolvedValue({ count: 0 });
  m.updateMany.mockResolvedValue({ count: 0 });
  expect(
    await runHostedFollowUpReminders(new Date("2026-11-20T03:00:00Z")),
  ).toBe("already-claimed");
  expect(m.generate).not.toHaveBeenCalled();
});

it("recovers an expired lease after a worker restart", async () => {
  m.findUnique.mockResolvedValue({
    completedAt: null,
    leaseUntil: new Date(0),
  });
  expect(
    await runHostedFollowUpReminders(new Date("2026-11-20T03:00:00Z")),
  ).toBe("completed");
  expect(m.updateMany.mock.calls[0][0]).toMatchObject({
    where: { completedAt: null, leaseUntil: { lte: expect.any(Date) } },
    data: { attempts: { increment: 1 } },
  });
});

it("leaves a failed sweep retryable without storing private error details", async () => {
  m.generate.mockRejectedValue(
    new Error("postgresql://secret:password@private/database"),
  );
  expect(
    await runHostedFollowUpReminders(new Date("2026-11-20T03:00:00Z")),
  ).toBe("retry-pending");
  expect(m.updateMany.mock.calls[0][0].data).toMatchObject({
    lastErrorCode: "REMINDER_SWEEP_FAILED",
  });
  expect(JSON.stringify(m.updateMany.mock.calls)).not.toContain("password");
  expect(JSON.stringify(m.log.mock.calls)).not.toContain("password");
});

it("starts only in hosted production Node runtime, without requiring a job secret", () => {
  const env = { NODE_ENV: "production", NEXT_RUNTIME: "nodejs" };
  expect(hostedRemindersEnabled(env, ["node", "server.js"])).toBe(true);
  for (const extra of [
    { NODE_ENV: "test" },
    { NEXT_RUNTIME: "edge" },
    { CI: "true" },
    { CI: "1" },
    { HOSTED_REMINDERS_DISABLED: "1" },
    { NEXT_PHASE: "phase-production-build" },
    { NEXT_PRIVATE_BUILD_WORKER: "1" },
  ]) {
    expect(hostedRemindersEnabled({ ...env, ...extra }, [])).toBe(false);
  }
  expect(hostedRemindersEnabled(env, ["node", "next", "build"])).toBe(false);
});

it("runs queued notification retries before reminder time and starts only one timer", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-20T01:00:00Z"));
  startHostedReminderScheduler();
  startHostedReminderScheduler();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(m.queue).toHaveBeenCalledTimes(1);
  expect(m.generate).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60_000);
  expect(m.queue).toHaveBeenCalledTimes(2);
  stopHostedReminderScheduler();
  await vi.advanceTimersByTimeAsync(120_000);
  expect(m.queue).toHaveBeenCalledTimes(2);
});

import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ lock: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/accounting/service", () => ({ setPeriodLock: m.lock }));
vi.mock("next/cache", () => ({ revalidatePath: m.revalidate }));
import { advancePeriodLockWithFeedback } from "./account-finalization";
const previous = { ok: false, message: "" };
const form = (confirmed = true) => {
  const fd = new FormData();
  fd.set("financialYearId", "year"); fd.set("lockedThrough", "2026-11-01"); fd.set("reason", "Reviewed");
  if (confirmed) fd.set("confirmed", "on");
  return fd;
};
beforeEach(() => { vi.clearAllMocks(); m.lock.mockReset().mockResolvedValue({}); });
it("does not write or revalidate without explicit confirmation", async () => {
  expect((await advancePeriodLockWithFeedback(previous, form(false))).ok).toBe(false);
  expect(m.lock).not.toHaveBeenCalled(); expect(m.revalidate).not.toHaveBeenCalled();
});
it("reports success only after the authorized mutation resolves", async () => {
  expect(await advancePeriodLockWithFeedback(previous, form())).toEqual({ ok: true, message: "Period lock advanced successfully." });
  expect(m.lock).toHaveBeenCalledWith({ financialYearId: "year", lockedThrough: "2026-11-01", reason: "Reviewed" });
  expect(m.revalidate).toHaveBeenCalledWith("/workspace/account/utilities/period-locks");
});
it.each(["FINANCIAL_YEAR_CLOSED", "PERIOD_UNLOCK_NOT_SUPPORTED", "INVALID_LOCK_DATE", "unknown"])("keeps %s failures recoverable without a success claim", async code => {
  m.lock.mockRejectedValue(new Error(code)); const result = await advancePeriodLockWithFeedback(previous, form());
  expect(result.ok).toBe(false); expect(result.message).not.toContain("successfully"); expect(m.revalidate).not.toHaveBeenCalled();
});

import { db } from "@/lib/db";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { refreshStoppedTravelDay } from "./daily-snapshot";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateAt = (value: string) => new Date(`${value}T00:00:00.000Z`);

/**
 * Admin-only, explicit historical reconciliation of one employee's stopped
 * attendance. This is intentionally NOT called on report reads.
 * Existing human-reviewed decisions are preserved by refreshStoppedTravelDay.
 */
export async function rebuildEmployeeTravelExpenses(
  employeeId: string,
  startDate: string,
  endDate: string,
) {
  const actor = await requirePermissionForMutation("SALES_TRAVEL");
  if (!actor.companyId || actor.salesRole !== "PRIMARY_ADMIN") throw new Error("NOT_AUTHORIZED");
  const start = dateAt(startDate), end = dateAt(endDate);
  if (!DATE.test(startDate) || !DATE.test(endDate) ||
      !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start.toISOString().slice(0, 10) !== startDate ||
      end.toISOString().slice(0, 10) !== endDate ||
      start > end || end.getTime() - start.getTime() > 31 * 86_400_000 ||
      end > new Date()) throw new Error("INVALID_DATE_RANGE");

  const employee = await db.user.findFirst({
    where: { id: employeeId, companyId: actor.companyId, salesRole: { in: ["MANAGER", "SALES"] } },
    select: { id: true, travelAllowanceEnabled: true, travelRatePerKm: true, travelApprovalMode: true },
  });
  if (!employee) throw new Error("NOT_FOUND");
  if (!employee.travelAllowanceEnabled) throw new Error("TRAVEL_ALLOWANCE_DISABLED");
  const company = await db.company.findUnique({
    where: { id: actor.companyId }, select: { travelRatePerKm: true },
  });
  if (employee.travelRatePerKm === null && company?.travelRatePerKm === null)
    throw new Error("RATE_NOT_CONFIGURED");

  // Branches come from authoritative attendance, not user-supplied IDs.
  // Each distinct day/branch is processed independently to avoid merging
  // different branch records or charging twice for the same day.
  const attendance = await db.attendance.findMany({
    where: {
      companyId: actor.companyId, userId: employeeId,
      endedAt: { not: null, gte: new Date(start.getTime() - 86_400_000) },
      startedAt: { lt: new Date(end.getTime() + 2 * 86_400_000) },
    },
    select: { branchId: true, startedAt: true, endedAt: true },
  });
  const days = new Map<string, { branchId: string; date: string }>();
  for (const session of attendance) {
    if (!session.endedAt) continue;
    for (let t = Math.max(start.getTime(), new Date(session.startedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00Z").getTime());
      t <= Math.min(end.getTime(), new Date(session.endedAt.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) + "T00:00:00Z").getTime());
      t += 86_400_000) {
      const date = new Date(t).toISOString().slice(0, 10);
      days.set(`${session.branchId}:${date}`, { branchId: session.branchId, date });
    }
  }
  let processed = 0;
  for (const { branchId, date } of days.values()) {
    await db.$transaction(async (tx) => {
      await refreshStoppedTravelDay(tx, actor.companyId!, branchId, employeeId, date);
    });
    processed++;
  }
  return { processedDays: processed, mode: employee.travelApprovalMode };
}

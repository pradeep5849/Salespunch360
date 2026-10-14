import type { RecurringFrequency } from "@prisma/client";
/** Keep the original calendar anchor after short months and leap years. */
export function nextRecurringDueDate(
  date: Date,
  frequency: RecurringFrequency,
  anchor: Date = date,
) {
  const next = new Date(date);
  if (frequency === "WEEKLY") {
    next.setUTCDate(next.getUTCDate() + 7);
    return next;
  }
  const months =
    frequency === "MONTHLY" ? 1 : frequency === "QUARTERLY" ? 3 : 12;
  next.setUTCDate(1);
  next.setUTCMonth(next.getUTCMonth() + months);
  const last = new Date(
    Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
  ).getUTCDate();
  next.setUTCDate(Math.min(anchor.getUTCDate(), last));
  return next;
}

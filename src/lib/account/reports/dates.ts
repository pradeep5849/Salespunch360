import { REPORT_TIME_ZONE } from "@/lib/reports/config";

/** Render an instant as the application's business calendar date, independent of host timezone. */
export function reportCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Date-only report bounds use April as the financial-year start. */
export function reportFinancialYearStart(date = new Date()) {
  const [year, month] = reportCalendarDate(date).split("-").map(Number);
  return new Date(Date.UTC(year - (month < 4 ? 1 : 0), 3, 1));
}

export type ReportPeriod =
  "TODAY" | "THIS_MONTH" | "LAST_MONTH" | "FINANCIAL_YEAR";
export function reportPeriodBounds(
  period: ReportPeriod,
  today = reportCalendarDate(),
) {
  const [year, month] = today.split("-").map(Number);
  const iso = (value: Date) => value.toISOString().slice(0, 10);
  if (period === "TODAY") return { from: today, to: today };
  if (period === "THIS_MONTH")
    return {
      from: iso(new Date(Date.UTC(year, month - 1, 1))),
      to: iso(new Date(Date.UTC(year, month, 0))),
    };
  if (period === "LAST_MONTH")
    return {
      from: iso(new Date(Date.UTC(year, month - 2, 1))),
      to: iso(new Date(Date.UTC(year, month - 1, 0))),
    };
  const start = year - (month < 4 ? 1 : 0);
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

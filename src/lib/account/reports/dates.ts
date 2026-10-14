import { REPORT_TIME_ZONE } from "@/lib/reports/config";

/** Render an instant as the application's business calendar date, independent of host timezone. */
export function reportCalendarDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: REPORT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Date-only report bounds use April as the financial-year start. */
export function reportFinancialYearStart(date = new Date()) {
  const [year, month] = reportCalendarDate(date).split("-").map(Number);
  return new Date(Date.UTC(year - (month < 4 ? 1 : 0), 3, 1));
}

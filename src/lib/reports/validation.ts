import { z } from "zod";
import { REPORT_DEFAULT_DAYS, REPORT_DEFAULT_PAGE_SIZE, REPORT_MAX_DAYS, REPORT_MAX_PAGE_SIZE, REPORT_TIME_ZONE } from "./config";

export class ReportValidationError extends Error {}
const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

/** Converts an India calendar date boundary to UTC without mutating stored timestamps. */
export function indiaDateBoundary(value: string, end = false) {
  if (!dateOnly.test(value)) throw new ReportValidationError("Dates must use YYYY-MM-DD.");
  const parts = value.split("-").map(Number);
  const checkDate = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 6, 30));
  const check = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit" }).format(checkDate);
  if (check !== value) throw new ReportValidationError("Invalid calendar date.");
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], end ? 18 : -6, 30));
}

export type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => Array.isArray(v) ? v[0] : v;
export function reportUuid(raw:SearchParams,key:"employeeId"|"customerId"|"branchId"){const value=one(raw[key]);if(value===undefined)return undefined;const parsed=z.string().uuid().safeParse(value);if(!parsed.success)throw new ReportValidationError("INVALID_INPUT");return parsed.data}
export function parseReportFilters(raw: SearchParams, now = new Date(), maxPageSize=REPORT_MAX_PAGE_SIZE) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE }).format(now);
  const defaultStart = new Date(indiaDateBoundary(today).getTime() - (REPORT_DEFAULT_DAYS - 1) * 86400000);
  const startDefault = new Intl.DateTimeFormat("en-CA", { timeZone: REPORT_TIME_ZONE }).format(defaultStart);
  const startText = one(raw.start) || startDefault, endText = one(raw.end) || today;
  const start = indiaDateBoundary(startText), endExclusive = indiaDateBoundary(endText, true);
  const days = (endExclusive.getTime() - start.getTime()) / 86400000;
  if (days <= 0) throw new ReportValidationError("Start date must not be after end date.");
  if (days > REPORT_MAX_DAYS) throw new ReportValidationError(`Date range cannot exceed ${REPORT_MAX_DAYS} days.`);
  const page = z.coerce.number().int().min(1).catch(1).parse(one(raw.page));
  const requestedSize = one(raw.pageSize);
  const pageSize = requestedSize === undefined ? REPORT_DEFAULT_PAGE_SIZE : z.coerce.number().int().min(1).max(maxPageSize).parse(requestedSize);
  const employeeId=reportUuid(raw,"employeeId");reportUuid(raw,"customerId");reportUuid(raw,"branchId");
  return { start, endExclusive, startText, endText, page, pageSize, employeeId, q: one(raw.q)?.trim() || undefined };
}

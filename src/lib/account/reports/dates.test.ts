import { expect, it } from "vitest";
import {
  reportCalendarDate,
  reportFinancialYearStart,
  reportPeriodBounds,
} from "./dates";
it.each([
  ["2026-03-31T18:29:59Z", "2026-03-31", "2025-04-01"],
  ["2026-03-31T18:30:00Z", "2026-04-01", "2026-04-01"],
  ["2026-12-31T18:30:00Z", "2027-01-01", "2026-04-01"],
  ["2026-01-10T00:00:00Z", "2026-01-10", "2025-04-01"],
])("uses the business calendar at %s", (instant, day, start) => {
  expect(reportCalendarDate(new Date(instant))).toBe(day);
  expect(
    reportFinancialYearStart(new Date(instant)).toISOString().slice(0, 10),
  ).toBe(start);
});

it("period presets honor full calendar months,leap years and April financial years", () => {
  expect(reportPeriodBounds("THIS_MONTH", "2024-02-12")).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(reportPeriodBounds("LAST_MONTH", "2026-01-16")).toEqual({
    from: "2025-12-01",
    to: "2025-12-31",
  });
  expect(reportPeriodBounds("FINANCIAL_YEAR", "2026-03-16")).toEqual({
    from: "2025-04-01",
    to: "2026-03-31",
  });
  expect(reportPeriodBounds("TODAY", "2026-10-16")).toEqual({
    from: "2026-10-16",
    to: "2026-10-16",
  });
});

it.each([
  ["2026-10-20T18:29:59.999Z", "2026-10-20"],
  ["2026-10-20T18:30:00.000Z", "2026-10-21"],
  ["2026-10-21T06:30:00.000Z", "2026-10-21"],
  ["2026-10-21T18:29:59.999Z", "2026-10-21"],
  ["2026-10-21T18:30:00.000Z", "2026-10-22"],
])("single-day preset follows Kolkata boundary at %s", (instant, expected) => {
  const day = reportCalendarDate(new Date(instant));
  expect(day).toBe(expected);
  expect(reportPeriodBounds("TODAY", day)).toEqual({ from: expected, to: expected });
});

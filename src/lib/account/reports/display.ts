import { Prisma } from "@prisma/client";
import {
  formatCalendarDate,
  formatMoney,
  type DisplayPreferences,
} from "../display-preferences";
import type { ReportResult } from "./service";

// These are the monetary columns emitted by the report service. Quantity,
// percentage, identifiers and arbitrary text must never be treated as money.
const moneyColumns = new Set([
  "Amount",
  "Taxable",
  "CGST",
  "SGST",
  "IGST",
  "CESS",
  "TDS",
  "TCS",
  "Opening Dr",
  "Opening Cr",
  "Period Dr",
  "Period Cr",
  "Closing Dr",
  "Closing Cr",
  "Debit",
  "Credit",
  "Balance",
  "Outstanding",
  "Tax",
  "Total",
  "Opening",
  "Receipts",
  "Payments",
  "Closing",
  "Capital",
  "Drawings",
  "Loan",
  "Revenue",
  "Opening Capital",
  "Net Capital Movement",
  "Period Drawings",
  "COGS",
  "Profit",
  "Unit cost",
  "Value",
  "Revenue Base",
  "Actual Cost",
  "Budget Variance",
]);
const dateColumns = new Set(["Date", "Due"]);
const numeric = /^-?\d+(?:\.\d+)?$/;

export function formatReportCell(
  column: string,
  value: string | number,
  preferences: DisplayPreferences,
  exportValue = false,
): string | number {
  const text = String(value);
  if (dateColumns.has(column) && /^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(text))
    return formatCalendarDate(text, preferences);
  if (!moneyColumns.has(column) || !numeric.test(text)) return value;
  // Exports carry the currency code in their header and keep numeric cells
  // free of grouping/symbols, including currencies unsupported by PDF fonts.
  return exportValue
    ? new Prisma.Decimal(text).toFixed(preferences.displayDecimalPlaces)
    : formatMoney(text, preferences);
}

export function formatReport(
  data: ReportResult,
  preferences: DisplayPreferences,
  exportValue = false,
): ReportResult {
  const row = (cells: Array<string | number>) =>
    cells.map((cell, index) =>
      formatReportCell(data.columns[index], cell, preferences, exportValue),
    );
  return {
    ...data,
    columns: exportValue
      ? data.columns.map((column) =>
          moneyColumns.has(column)
            ? `${column} (${preferences.baseCurrency})`
            : column,
        )
      : data.columns,
    rows: data.rows.map(row),
    ...(data.totals ? { totals: row(data.totals) } : {}),
  };
}

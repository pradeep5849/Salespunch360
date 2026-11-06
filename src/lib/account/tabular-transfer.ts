/** A tagged, reversible CSV text encoding prevents spreadsheet formula evaluation.
 * The marker is per row so plain third-party CSV imports keep literal apostrophes.
 */
export const CSV_ENCODING_COLUMN = "__salespunch_csv_encoding";
export const CSV_ENCODING = "apostrophe-v1";
const unsafe = /^[=+\-@\t\r\n']/;
export function encodeCsv(rows: Record<string, unknown>[], keys: string[]) {
  const quote = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [
    [...keys, CSV_ENCODING_COLUMN].map(quote).join(","),
    ...rows.map((row) =>
      [
        ...keys.map((key) => {
          const value = String(row[key] ?? "");
          return unsafe.test(value) ? `'${value}` : value;
        }),
        CSV_ENCODING,
      ]
        .map(quote)
        .join(","),
    ),
  ].join("\r\n");
}
export function decodeCsvRecord(row: Record<string, string>) {
  if (row[CSV_ENCODING_COLUMN] !== CSV_ENCODING) return row;
  return Object.fromEntries(
    Object.entries(row)
      .filter(([key]) => key !== CSV_ENCODING_COLUMN)
      .map(([key, value]) => [
        key,
        value.startsWith("'") && unsafe.test(value.slice(1))
          ? value.slice(1)
          : value,
      ]),
  );
}
export const EXPORT_TYPES = [
  "customers",
  "vendors",
  "items",
  "projects",
  "chart-of-accounts",
] as const;
export function validateExportRequest(type: string, format: string) {
  if (!(EXPORT_TYPES as readonly string[]).includes(type))
    throw new Error("UNSUPPORTED_EXPORT");
  if (!["csv", "xlsx"].includes(format))
    throw new Error("UNSUPPORTED_EXPORT_FORMAT");
}

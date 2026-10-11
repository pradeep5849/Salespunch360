import type { ReportResult } from "./service";

/** Include the same totals and scope explanations in all download formats. */
export function reportExportRows(data: ReportResult, scope: string) {
  const noteRow = (text: string) => [text, ...Array(Math.max(0, data.columns.length - 1)).fill("")];
  return [
    ...data.rows,
    ...(data.totals ? [data.totals] : []),
    ...(data.note ? [noteRow(data.note)] : []),
    noteRow(`Scope: ${scope || "Current authorized company/branch scope"}`),
  ];
}

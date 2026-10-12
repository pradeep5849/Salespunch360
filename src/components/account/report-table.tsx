"use client";
import Link from "next/link";
import { formatReport } from "@/lib/account/reports/display";
import type { ReportResult } from "@/lib/account/reports/service";
import { useDisplayPreferences } from "./display-preferences";

export function ReportTable({ data }: { data: ReportResult }) {
  const formatted = formatReport(data, useDisplayPreferences());
  return (
    <table>
      <thead>
        <tr>
          {formatted.columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {formatted.rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j}>
                {j === 0 && formatted.rowLinks?.[i] ? (
                  <Link href={formatted.rowLinks[i]}>{cell}</Link>
                ) : (
                  cell
                )}
              </td>
            ))}
          </tr>
        ))}
        {formatted.totals && (
          <tr>
            {formatted.totals.map((cell, j) => (
              <th key={j}>{cell}</th>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

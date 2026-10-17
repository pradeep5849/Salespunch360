"use client";
import Link from "next/link";
import { formatReport } from "@/lib/account/reports/display";
import type { ReportResult } from "@/lib/account/reports/service";
import { useDisplayPreferences } from "./display-preferences";

export function ReportTable({ data }: { data: ReportResult }) {
  const formatted = formatReport(data, useDisplayPreferences());
  return (
    <><table>
      <thead>
        <tr>
          {formatted.columns.map((column) => (
            <th key={column} scope="col">{column}</th>
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
              j === 0 ? <th key={j} scope="row">{cell || "Total"}</th> : <td key={j}>{cell}</td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
    {formatted.breakdown&&<section aria-label="Ledger breakdown">{formatted.breakdown.map(group=><details key={group.title}><summary>{group.title} — {group.total}</summary>{group.rows.length?<ul>{group.rows.map(row=><li key={row.code} style={{overflowWrap:"anywhere"}}>{row.code} {row.name} — {row.amount}</li>)}</ul>:<p>No ledger balances in this section.</p>}</details>)}</section>}</>
  );
}

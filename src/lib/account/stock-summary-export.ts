import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  stockSummaryReportForActor,
  type StockSummaryQuery,
} from "./stock-summary-report";
import { resolveDisplayPreferences } from "./display-preferences";
import { exportExcel, exportPdf } from "./financial-reports";
import type { ProjectActor } from "./projects";

export async function stockSummaryExportForActor(
  actor: ProjectActor,
  query: StockSummaryQuery,
  format: "pdf" | "xlsx",
) {
  const report = await stockSummaryReportForActor(actor, query);
  const [company, settings] = await Promise.all([
    db.company.findUniqueOrThrow({
      where: { id: actor.companyId },
      select: { name: true },
    }),
    db.accountSettings.findUnique({
      where: { companyId: actor.companyId },
      select: { baseCurrency: true, displayDecimalPlaces: true },
    }),
  ]);
  const display = resolveDisplayPreferences(settings),
    context =
      report.context.mode === "BRANCH"
        ? `Branch: ${report.context.branchName}`
        : "All authorized branches";
  const filters = new URLSearchParams(
    Object.entries(report.query).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  const input = {
    title: "Stock Summary",
    company: company.name,
    filter: `${context} · ${filters.toString() || "Current stock"}`,
    columns: [
      "Item",
      "Category",
      "Stock quantity",
      `Stock value (${display.baseCurrency})`,
    ],
    rows: report.filtered.map((row) => [
      row.name,
      row.category,
      new Prisma.Decimal(row.quantity).toFixed(display.displayDecimalPlaces),
      new Prisma.Decimal(row.value).toFixed(display.displayDecimalPlaces),
    ]),
  };
  return format === "xlsx" ? exportExcel(input) : exportPdf(input);
}

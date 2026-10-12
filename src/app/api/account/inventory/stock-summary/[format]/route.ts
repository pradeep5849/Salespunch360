import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import {
  stockSummaryReportForActor,
  stockSummaryQuery,
} from "@/lib/account/stock-summary-report";
import { exportExcel, exportPdf } from "@/lib/account/financial-reports";
import type { ProjectActor } from "@/lib/account/projects";
import { Prisma } from "@prisma/client";
import { resolveDisplayPreferences } from "@/lib/account/display-preferences";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> },
) {
  const actor = (await requirePermission("ACCOUNT_STOCK")) as ProjectActor,
    { format } = await params;
  if (format !== "pdf" && format !== "xlsx")
    return NextResponse.json({ error: "UNKNOWN_FORMAT" }, { status: 404 });
  const parsed = stockSummaryQuery.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success)
    return NextResponse.json(
      { error: "INVALID_REPORT_FILTERS" },
      { status: 400 },
    );
  try {
    const [report, company, settings] = await Promise.all([
      stockSummaryReportForActor(actor, parsed.data),
      db.company.findUniqueOrThrow({
        where: { id: actor.companyId },
        select: { name: true },
      }),
      db.accountSettings.findUnique({
        where: { companyId: actor.companyId },
        select: { baseCurrency: true, displayDecimalPlaces: true },
      }),
    ]);
    const display = resolveDisplayPreferences(settings);
    const rows = report.filtered.map((row) => [
      row.name,
      row.category,
      new Prisma.Decimal(row.quantity).toFixed(display.displayDecimalPlaces),
      new Prisma.Decimal(row.value).toFixed(display.displayDecimalPlaces),
    ]);
    const context =
      report.context.mode === "BRANCH"
        ? `Branch: ${report.context.branchName}`
        : "All authorized branches";
    const filter = `${context} · ${request.nextUrl.searchParams.toString() || "Current stock"}`,
      input = {
        title: "Stock Summary",
        company: company.name,
        filter,
        columns: [
          "Item",
          "Category",
          "Stock quantity",
          `Stock value (${display.baseCurrency})`,
        ],
        rows,
      };
    const bytes =
        format === "xlsx" ? await exportExcel(input) : exportPdf(input),
      contentType =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "application/pdf";
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type": contentType,
        "content-disposition": `attachment; filename="stock-summary.${format}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError)
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    throw error;
  }
}

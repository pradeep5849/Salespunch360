import { NextRequest, NextResponse } from "next/server";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { stockSummaryQuery } from "@/lib/account/stock-summary-report";
import { stockSummaryExportForActor } from "@/lib/account/stock-summary-export";
import type { ProjectActor } from "@/lib/account/projects";
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ format: string }> },
) {
  try {
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
    const bytes = await stockSummaryExportForActor(actor, parsed.data, format);
    const contentType =
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
    if (
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
    )
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    throw error;
  }
}

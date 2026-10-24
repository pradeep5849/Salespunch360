import { NextResponse } from "next/server";
import { authenticateMobileToken } from "@/lib/mobile/auth";
import {
  mobileJson,
  mobileUnauthorized,
  mobileAuthorizationFailure,
  mobileUnexpected,
} from "@/lib/mobile/http";
import { mobileStockSummaryExport } from "@/lib/mobile/account-inventory";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ format: string }> },
) {
  try {
    const user = await authenticateMobileToken(
        request.headers.get("authorization"),
      ),
      { format } = await params;
    if (format !== "pdf" && format !== "xlsx")
      return mobileJson({ error: "UNKNOWN_FORMAT" }, 404);
    const bytes = await mobileStockSummaryExport(
      user,
      Object.fromEntries(new URL(request.url).searchParams),
      format,
    );
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "content-type":
          format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="stock-summary.${format}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return (
      mobileUnauthorized(error) ??
      mobileAuthorizationFailure(error) ??
      mobileUnexpected("MOBILE_STOCK_SUMMARY_EXPORT", error)
    );
  }
}

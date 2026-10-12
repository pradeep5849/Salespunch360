import Link from "next/link";
import { StockSummary } from "@/components/account/stock-summary";
import {
  stockSummaryReportForActor,
  stockSummaryQuery,
  type StockSummaryQuery,
} from "@/lib/account/stock-summary-report";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import type { ProjectActor } from "@/lib/account/projects";
export const metadata = { title: "Stock Summary | SalesPunch360" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<StockSummaryQuery>;
}) {
  const query = await searchParams,
    parsed = stockSummaryQuery.safeParse(query);
  if (!parsed.success)
    return (
      <div role="alert">
        Choose a valid stock-report date and filters.{" "}
        <Link href="/workspace/account/inventory/stock-summary">
          Reset report filters
        </Link>
      </div>
    );
  let report: Awaited<ReturnType<typeof stockSummaryReportForActor>>;
  try {
    const actor = (await requirePermission("ACCOUNT_STOCK")) as ProjectActor;
    report = await stockSummaryReportForActor(actor, parsed.data);
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      (error instanceof Error && error.message.startsWith("MODULE_DISABLED:"))
    )
      return (
        <div role="alert">
          Stock Summary is unavailable for your permissions, branch access or
          Items settings.{" "}
          <Link href="/workspace/account">Return to Account</Link>
        </div>
      );
    throw error;
  }
  const contextQuery =
    report.context.mode === "BRANCH"
      ? { branchId: report.context.branchId }
      : { scope: "all" };
  return (
    <StockSummary
      asOf={report.query.asOf ?? ""}
      contextQuery={contextQuery}
      initialFilters={report.query}
      rows={report.rows}
    />
  );
}

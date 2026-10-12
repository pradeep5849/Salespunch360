import Link from "next/link";
import { StockSummary } from "@/components/account/stock-summary";
import {
  stockSummaryReportForActor,
  stockSummaryQuery,
  type StockSummaryQuery,
} from "@/lib/account/stock-summary-report";
import { requirePermission } from "@/lib/auth/authorization";
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
  const report = await stockSummaryReportForActor(
    (await requirePermission("ACCOUNT_STOCK")) as ProjectActor,
    parsed.data,
  );
  const contextQuery =
    report.context.mode === "BRANCH"
      ? { branchId: report.context.branchId }
      : { scope: "all" };
  return (
    <StockSummary
      asOf={report.query.asOf ?? ""}
      contextQuery={contextQuery}
      rows={report.rows}
    />
  );
}

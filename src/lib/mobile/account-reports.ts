import { canUsePermission } from "@/lib/auth/permissions";
import {
  exportCsv,
  exportExcel,
  exportPdf,
} from "@/lib/account/financial-reports";
import {
  reportOptionsForActor,
  runFinancialReportForActor,
} from "@/lib/account/reports/service";
import { db } from "@/lib/db";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";
export const ACCOUNT_REPORTS = [
  "profit-loss",
  "balance-sheet",
  "trial-balance",
  "cash-flow",
  "general-ledger",
  "customer-ledger",
  "vendor-ledger",
  "receivable-aging",
  "payable-aging",
  "cash-bank",
  "owner-capital",
  "projects",
  "branches",
  "items",
  "invoices",
  "customers",
  "tax",
  "budget-vs-actual",
] as const;
function actor(u: MobileAppPrincipal) {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, "ACCOUNT_REPORTS"))
    throw new Error("MOBILE_FORBIDDEN");
  return a;
}
function valid(name: string) {
  if (!(ACCOUNT_REPORTS as readonly string[]).includes(name))
    throw new Error("INVALID_REPORT");
}
export async function mobileAccountReportOptions(u: MobileAppPrincipal) {
  const a = actor(u),
    options = await reportOptionsForActor(a);
  return {
    reports:
      a.accountRole === "PROJECT_MANAGER" ? ["projects"] : ACCOUNT_REPORTS,
    ...options,
  };
}
export async function mobileAccountReport(
  u: MobileAppPrincipal,
  name: string,
  filters: unknown,
) {
  valid(name);
  return runFinancialReportForActor(actor(u), name, filters);
}
export async function mobileAccountReportExport(
  u: MobileAppPrincipal,
  name: string,
  format: string,
  filters: Record<string, string>,
) {
  valid(name);
  const a = actor(u),
    data = await runFinancialReportForActor(a, name, filters),
    company = await db.company.findUniqueOrThrow({
      where: { id: a.companyId },
      select: { name: true },
    }),
    input = {
      title: data.title,
      company: company.name,
      filter: new URLSearchParams(filters).toString(),
      columns: data.columns,
      rows: data.rows,
    };
  if (format === "csv")
    return {
      bytes: new TextEncoder().encode(exportCsv(data.columns, data.rows)),
      mime: "text/csv",
      extension: "csv",
    };
  if (format === "xlsx")
    return {
      bytes: new Uint8Array(await exportExcel(input)),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
    };
  if (format === "pdf")
    return {
      bytes: new Uint8Array(exportPdf(input)),
      mime: "application/pdf",
      extension: "pdf",
    };
  throw new Error("INVALID_FORMAT");
}

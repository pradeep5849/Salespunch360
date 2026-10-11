import {reportExportRows} from "@/lib/account/reports/export-data";
import {formatReport} from "@/lib/account/reports/display";
import {resolveDisplayPreferences} from "@/lib/account/display-preferences";
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
  "profit-withdrawal",
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
  const a = actor(u);
  const [data, settings] = await Promise.all([runFinancialReportForActor(a, name, filters), db.accountSettings.findUnique({where:{companyId:a.companyId},select:{baseCurrency:true,displayDecimalPlaces:true,dateFormat:true,appLanguage:true}})]);
  return formatReport(data, resolveDisplayPreferences(settings));
}
export async function mobileAccountReportExport(
  u: MobileAppPrincipal,
  name: string,
  format: string,
  filters: Record<string, string>,
) {
  valid(name);
  const a = actor(u),
    raw = await runFinancialReportForActor(a, name, filters),
    settings = await db.accountSettings.findUnique({where:{companyId:a.companyId},select:{baseCurrency:true,displayDecimalPlaces:true,dateFormat:true,appLanguage:true}}),
    data = formatReport(raw, resolveDisplayPreferences(settings), true),
    company = await db.company.findUniqueOrThrow({
      where: { id: a.companyId },
      select: { name: true },
    }),
    input = {
      title: data.title,
      company: company.name,
      filter: new URLSearchParams(filters).toString(),
      columns: data.columns,
      rows: reportExportRows(data, new URLSearchParams(filters).toString()),
    };
  if (format === "csv")
    return {
      bytes: new TextEncoder().encode(exportCsv(data.columns, input.rows)),
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

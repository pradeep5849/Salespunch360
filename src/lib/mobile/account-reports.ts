import {itemDiscountCategoriesForActor} from "@/lib/account/reports/item-discount";
import {bankStatementOptionsForActor} from "@/lib/account/reports/bank-statement";
import {stockDetailCategoriesForActor} from "@/lib/account/reports/stock-detail-options";
import {ACCOUNT_REPORT_KEYS} from "@/lib/account/reports/catalogue";
import {availableReportCatalogueForActor,reportFavouritesForActor,setReportFavouriteForActor} from "@/lib/account/reports/favourites";
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
export const ACCOUNT_REPORTS=ACCOUNT_REPORT_KEYS;
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
    options = await reportOptionsForActor(a),catalogue=await availableReportCatalogueForActor(a);
  return {
    bankAccounts: catalogue.some(x=>x.key === "bank-statement") ? await bankStatementOptionsForActor(a) : [],
    itemCategories: catalogue.some(x=>x.key==="item-discount")?await itemDiscountCategoriesForActor(a):[],
    stockCategories: catalogue.some(x=>["stock-detail","stock-summary","low-stock-summary"].includes(x.key)) ? await stockDetailCategoriesForActor(a) : [],
    reports:catalogue.map(x=>x.key),
    catalogue,
    favourites:await reportFavouritesForActor(a),
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
      bytes: new Uint8Array(await exportPdf(input)),
      mime: "application/pdf",
      extension: "pdf",
    };
  throw new Error("INVALID_FORMAT");
}

export async function mobileSetReportFavourite(u:MobileAppPrincipal,raw:unknown){return {favourites:await setReportFavouriteForActor(actor(u),raw)}}

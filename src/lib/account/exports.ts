import {assertTransferAvailable} from "./transfer-access";
import ExcelJS from "exceljs";
import { requirePermission } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import {
  ACCOUNT_IMPORT_TYPES,
  IMPORT_TEMPLATES,
  type AccountImportType,
} from "./imports";
import {encodeCsv,validateExportRequest} from "./tabular-transfer";
const columns:Record<string,string[]>={
 customers:["name","branch","phone","email","address","gstin","state_code","is_active"],
 vendors:["name","phone","email","address","gstin","state_code","is_active"],
 items:["name","unit","category","code","barcode","sale_rate","purchase_rate","tax_rate","hsn","track_inventory","is_active"],
 projects:["name","customer","branch","project_number","site","status","start_date","target_end_date","project_value"],
 "chart-of-accounts":["code","name","account_class","normal_balance","system_key","is_active"],
};
// Cursor chunks avoid a silent 10,000-row truncation. Refuse oversized exports explicitly.
async function readAll<T extends {id:string}>(read:(cursor?:string)=>Promise<T[]>):Promise<T[]> {
 const rows:T[]=[];let cursor:string|undefined;
 for(;;){const chunk=await read(cursor);rows.push(...chunk);if(rows.length>100000)throw new Error("EXPORT_TOO_LARGE");if(chunk.length<1000)return rows;cursor=chunk[chunk.length-1].id;}
}
const page=(cursor?:string)=>({take:1000,orderBy:{id:"asc" as const},...(cursor?{cursor:{id:cursor},skip:1}:{})});
async function workbook(rows: Record<string, unknown>[], headers?:string[]) {
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("Data"),
    keys = headers ?? (rows.length ? Object.keys(rows[0]) : []);
  sheet.columns = keys.map((key) => ({ header: key, key, width: 22 }));
  rows.forEach((row) =>
    sheet.addRow(
      Object.fromEntries(keys.map((key) => [key, String(row[key] ?? "")])),
    ),
  );
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  return new Uint8Array(await book.xlsx.writeBuffer());
}
export async function exportAccountDataForActor(
  actor: {
    id: string;
    companyId: string;
    accountRole: string | null;
    branchAccessScope?: string;
    branchIds?: string[];
  },
  type: string,
  format: string,
) {
  validateExportRequest(type,format);
  await assertTransferAvailable(actor,type);
  const branchIds =
      actor.branchAccessScope === "SELECTED_BRANCHES"
        ? (actor.branchIds ?? [])
        : undefined,
    companyId = actor.companyId!;
  const branches = type === "customers" ? await db.branch.findMany({where:{companyId,...(branchIds?{id:{in:branchIds}}:{})},select:{id:true,code:true}}) : [];
  const branchCode = new Map(branches.map(branch=>[branch.id,branch.code]));
  let rows: Record<string, unknown>[];
  if (type === "customers")
    rows = (await readAll(cursor=>db.customer.findMany({
      ...page(cursor),
      where: {
        companyId,
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
      },
      select: {
        id:true,
        branchId:true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        stateCode: true,
        isActive: true,
      },
    }))).map(({branchId,stateCode,isActive,...row})=>({...row,branch:branchCode.get(branchId)??"",state_code:stateCode,is_active:isActive}));
  else if (type === "vendors")
    rows = (await readAll(cursor=>db.vendor.findMany({
      ...page(cursor),
      where: { companyId },
      select: {
        id:true,
        name: true,
        phone: true,
        email: true,
        address: true,
        gstin: true,
        stateCode: true,
        isActive: true,
      },
    }))).map(({stateCode,isActive,...row})=>({...row,state_code:stateCode,is_active:isActive}));
  else if (type === "items")
    rows = (await readAll(cursor=>db.accountProduct.findMany({
      ...page(cursor),
      where: { companyId },
      select: {
        id:true,
        unit:{select:{symbol:true}},
        category:{select:{name:true}},
        trackInventory:true,
        name: true,
        code: true,
        barcode: true,
        salePrice: true,
        costPrice: true,
        taxRate: true,
        hsnCode: true,
        isActive: true,
      },
    }))).map(({unit,category,salePrice,costPrice,taxRate,hsnCode,trackInventory,isActive,...row})=>({...row,unit:unit?.symbol??"",category:category?.name??"",sale_rate:salePrice,purchase_rate:costPrice,tax_rate:taxRate,hsn:hsnCode,track_inventory:trackInventory,is_active:isActive}));
  else if (type === "projects")
    rows = (await readAll(cursor=>db.project.findMany({
      ...page(cursor),
      where: {
        companyId,
        ...(branchIds ? { branchId: { in: branchIds } } : {}),
        ...(actor.accountRole === "PROJECT_MANAGER"
          ? { projectManagerId: actor.id }
          : {}),
      },
      select: {
        id:true,
        branch:{select:{code:true}},
        customer:{select:{name:true}},
        projectNumber: true,
        name: true,
        siteName: true,
        status: true,
        startDate: true,
        targetEndDate: true,
        projectValue: true,
      },
    }))).map(({branch,customer,projectNumber,siteName,startDate,targetEndDate,projectValue,...row})=>({...row,branch:branch.code,customer:customer.name,project_number:projectNumber,site:siteName,start_date:startDate,target_end_date:targetEndDate,project_value:projectValue}));
  else if (type === "chart-of-accounts")
    rows = (await readAll(cursor=>db.ledgerAccount.findMany({
      ...page(cursor),
      where: { companyId },
      select: {
        id:true,
        code: true,
        name: true,
        accountClass: true,
        normalBalance: true,
        systemKey: true,
        isActive: true,
      },
    }))).map(({accountClass,normalBalance,systemKey,isActive,...row})=>({...row,account_class:accountClass,normal_balance:normalBalance,system_key:systemKey,is_active:isActive}));
  else throw new Error("UNSUPPORTED_EXPORT");
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [
        k,
        v instanceof Date
          ? v.toISOString().slice(0, 10)
          : (v?.toString() ?? ""),
      ]),
    ),
  );
  return format === "xlsx"
    ? {
        bytes: await workbook(safe,columns[type]),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    : format === "csv"
      ? {
          bytes: new TextEncoder().encode(encodeCsv(safe,columns[type])),
          contentType: "text/csv; charset=utf-8",
        }
      : (() => {
          throw new Error("UNSUPPORTED_EXPORT_FORMAT");
        })();
}
export async function importTemplate(type: AccountImportType, format: string) {
  if (!ACCOUNT_IMPORT_TYPES.includes(type))
    throw new Error("UNSUPPORTED_TEMPLATE");
  if (!["csv","xlsx"].includes(format)) throw new Error("UNSUPPORTED_EXPORT_FORMAT");
  await requirePermission("ACCOUNT_ACCOUNTS");
  const row = Object.fromEntries(
    IMPORT_TEMPLATES[type].map((header) => [
      header,
      header === "effective_date" ? "2026-04-01" : `Example ${header}`,
    ]),
  );
  return format === "xlsx"
    ? {
        bytes: await workbook([row]),
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }
    : {
        bytes: new TextEncoder().encode(encodeCsv([row],IMPORT_TEMPLATES[type])),
        contentType: "text/csv; charset=utf-8",
      };
}

export async function exportAccountData(type: string, format: string) {
  return exportAccountDataForActor(
    (await requirePermission("ACCOUNT_REPORTS")) as never,
    type,
    format,
  );
}

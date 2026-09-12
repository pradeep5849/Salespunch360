import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { Prisma, type AccountImportStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { allocateDocumentNumberInTx } from "./numbering";
import { postJournalInTx } from "@/lib/accounting/service";

export const ACCOUNT_IMPORT_TYPES = ["CUSTOMERS", "VENDORS", "ITEMS", "OPENING_BALANCES", "PROJECTS"] as const;
export type AccountImportType = (typeof ACCOUNT_IMPORT_TYPES)[number];
export type ImportAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";
export type ImportPreviewRow = { rowNumber: number; action: ImportAction; values: Record<string, string>; resolved: Record<string, string>; warnings: string[]; errors: string[] };
export type ImportPreview = { type: AccountImportType; fileName: string; fileHash: string; headers: string[]; rows: ImportPreviewRow[]; validCount: number; invalidCount: number };

const typeSchema = z.enum(ACCOUNT_IMPORT_TYPES);
const normalize = (value: unknown) => String(value ?? "").trim();

/** RFC4180-compatible enough for templates, including quoted commas/newlines and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) { const char = text[i];
    if (quoted) { if (char === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (char === '"') quoted = false; else field += char; }
    else if (char === '"') quoted = true; else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; } else field += char;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  if (quoted) throw new Error("INVALID_CSV_UNCLOSED_QUOTE"); return rows.filter((x) => x.some(Boolean));
}

export async function parseImportFile(fileName: string, bytes: Uint8Array) {
  const extension = fileName.toLowerCase().split(".").pop(); let matrix: string[][];
  if (extension === "csv") matrix = parseCsv(new TextDecoder().decode(bytes));
  else if (extension === "xlsx") { const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes.buffer as ArrayBuffer); const sheet = workbook.worksheets[0]; if (!sheet) throw new Error("EMPTY_WORKBOOK"); matrix = [];
    sheet.eachRow({ includeEmpty: false }, (r) => matrix.push((r.values as unknown[]).slice(1).map(normalize)));
  } else throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  if (matrix.length < 2) throw new Error("IMPORT_HAS_NO_DATA_ROWS");
  const headers = matrix[0].map((h) => normalize(h).toLowerCase().replace(/[ /-]+/g, "_"));
  if (new Set(headers).size !== headers.length || headers.some((h) => !h)) throw new Error("INVALID_IMPORT_HEADERS");
  return { headers, records: matrix.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, normalize(cells[i])]))), fileHash: createHash("sha256").update(bytes).digest("hex") };
}

const requiredHeaders: Record<AccountImportType, string[]> = { CUSTOMERS: ["name", "branch"], VENDORS: ["name"], ITEMS: ["name", "unit", "category"], OPENING_BALANCES: ["ledger", "debit", "credit", "effective_date", "financial_year", "branch"], PROJECTS: ["name", "customer", "branch"] };
export const IMPORT_TEMPLATES = requiredHeaders;

export async function previewAccountImport(input: { type: AccountImportType; fileName: string; bytes: Uint8Array; updateExisting?: boolean }): Promise<ImportPreview> {
  const actor = await requirePermissionForMutation(input.type === "OPENING_BALANCES" ? "ACCOUNT_OPENING_BALANCE" : "ACCOUNT_ACCOUNTS");
  const type = typeSchema.parse(input.type), parsed = await parseImportFile(input.fileName, input.bytes);
  const missing = requiredHeaders[type].filter((h) => !parsed.headers.includes(h)); if (missing.length) throw new Error(`MISSING_COLUMNS:${missing.join(",")}`);
  const branches = await db.branch.findMany({ where: { companyId: actor.companyId!, isActive: true, id: { in: actor.branchIds } }, select: { id: true, name: true, code: true } });
  const branchMap = new Map(branches.flatMap((b) => [[b.name.toLowerCase(), b], [b.code.toLowerCase(), b]]));
  const [customers, vendors, products, units, categories, ledgers, years] = await Promise.all([
    db.customer.findMany({ where: { companyId: actor.companyId! }, select: { id: true, name: true, gstin: true, phone: true, email: true } }),
    db.vendor.findMany({ where: { companyId: actor.companyId! }, select: { id: true, name: true, gstin: true, phone: true, email: true } }),
    db.accountProduct.findMany({ where: { companyId: actor.companyId! }, select: { id: true, name: true, code: true, barcode: true } }),
    db.accountUnit.findMany({ where: { companyId: actor.companyId!, isActive: true }, select: { id: true, name: true, symbol: true } }),
    db.accountCategory.findMany({ where: { companyId: actor.companyId!, isActive: true }, select: { id: true, name: true } }),
    db.ledgerAccount.findMany({ where: { companyId: actor.companyId!, isActive: true, allowPosting: true }, select: { id: true, code: true, name: true } }),
    db.financialYear.findMany({ where: { companyId: actor.companyId! }, select: { id: true, name: true, startDate: true, endDate: true, status: true } }),
  ]);
  const rows = parsed.records.map((values, index): ImportPreviewRow => { const errors: string[] = [], warnings: string[] = [], resolved: Record<string, string> = {}; let action: ImportAction = "CREATE";
    if (!values.name && type !== "OPENING_BALANCES") errors.push("Name is required");
    const branch = values.branch ? branchMap.get(values.branch.toLowerCase()) : undefined; if (["CUSTOMERS", "OPENING_BALANCES", "PROJECTS"].includes(type)) { if (!branch) errors.push("Branch is not active or is outside your authorized scope"); else resolved.branchId = branch.id; }
    const duplicate = type === "CUSTOMERS" ? customers.filter((x) => (values.gstin && x.gstin === values.gstin) || (!values.gstin && ((values.phone && x.phone === values.phone) || (values.email && x.email === values.email)))) : type === "VENDORS" ? vendors.filter((x) => (values.gstin && x.gstin === values.gstin) || (!values.gstin && ((values.phone && x.phone === values.phone) || (values.email && x.email === values.email)))) : type === "ITEMS" ? products.filter((x) => (values.code && x.code === values.code) || (values.barcode && x.barcode === values.barcode)) : [];
    if (duplicate.length > 1) errors.push("Ambiguous duplicate match"); else if (duplicate.length === 1) { resolved.existingId = duplicate[0].id; action = input.updateExisting ? "UPDATE" : "SKIP"; warnings.push(input.updateExisting ? "Existing record will be updated" : "Create-only mode skips existing records"); }
    if (type === "ITEMS") { const unit = units.find((x) => x.name.toLowerCase() === values.unit.toLowerCase() || x.symbol.toLowerCase() === values.unit.toLowerCase()), category = categories.find((x) => x.name.toLowerCase() === values.category.toLowerCase()); if (!unit) errors.push("Unit does not exist"); else resolved.unitId = unit.id; if (!category) errors.push("Category does not exist"); else resolved.categoryId = category.id;
      if (values.price_type || values.tier_rate) { const priceType=values.price_type.toUpperCase();if(!["RETAIL","WHOLESALE","CUSTOMER"].includes(priceType))errors.push("Price type must be RETAIL, WHOLESALE, or CUSTOMER");else resolved.priceType=priceType;try{if(!values.tier_rate||new Prisma.Decimal(values.tier_rate).isNegative())errors.push("Tier rate must be a non-negative Decimal");}catch{errors.push("Invalid tier rate");}if(priceType==="CUSTOMER"){const key=values.customer?.toLowerCase(),customer=customers.find(x=>x.id===values.customer||x.name.toLowerCase()===key||Boolean(values.customer_gstin&&x.gstin===values.customer_gstin));if(!customer)errors.push("Customer does not exist in this Company");else resolved.priceCustomerId=customer.id;}else if(values.customer||values.customer_gstin)warnings.push("Customer is ignored for non-CUSTOMER pricing"); }
    }
    if (type === "PROJECTS") { const customer = customers.find((x) => x.name.toLowerCase() === values.customer.toLowerCase()); if (!customer) errors.push("Customer does not exist in this Company"); else resolved.customerId = customer.id; }
    if (type === "OPENING_BALANCES") { const ledger = ledgers.find((x) => x.code.toLowerCase() === values.ledger.toLowerCase() || x.name.toLowerCase() === values.ledger.toLowerCase()), year = years.find((x) => x.name.toLowerCase() === values.financial_year.toLowerCase()); if (!ledger) errors.push("Posting ledger does not exist"); else resolved.ledgerId = ledger.id; if (!year) errors.push("Financial Year does not exist"); else { resolved.financialYearId = year.id; if (year.status === "CLOSED") errors.push("Financial Year is closed"); const date = new Date(`${values.effective_date}T00:00:00.000Z`); if (Number.isNaN(date.valueOf()) || date < year.startDate || date > year.endDate) errors.push("Effective date is outside Financial Year"); } try { const d = new Prisma.Decimal(values.debit || 0), c = new Prisma.Decimal(values.credit || 0); if (d.isNegative() || c.isNegative() || (d.gt(0) === c.gt(0))) errors.push("Exactly one non-negative debit or credit is required"); } catch { errors.push("Invalid Decimal amount"); } }
    if (errors.length) action = "ERROR"; return { rowNumber: index + 2, action, values, resolved, warnings, errors }; });
  if (type === "OPENING_BALANCES") { const debit = rows.reduce((sum, r) => sum.plus(r.values.debit || 0), new Prisma.Decimal(0)), credit = rows.reduce((sum, r) => sum.plus(r.values.credit || 0), new Prisma.Decimal(0)); if (!debit.equals(credit)) rows.forEach((r) => { r.action = "ERROR"; r.errors.push(`Opening balance is unbalanced (${debit.toFixed(2)} / ${credit.toFixed(2)})`); }); }
  return { type, fileName: input.fileName, fileHash: parsed.fileHash, headers: parsed.headers, rows, validCount: rows.filter((r) => r.action !== "ERROR").length, invalidCount: rows.filter((r) => r.action === "ERROR").length };
}

export async function saveImportPreview(preview: ImportPreview) { const actor = await requirePermissionForMutation(preview.type === "OPENING_BALANCES" ? "ACCOUNT_OPENING_BALANCE" : "ACCOUNT_ACCOUNTS"); return db.accountImportJob.upsert({ where: { companyId_importType_fileHash: { companyId: actor.companyId!, importType: preview.type, fileHash: preview.fileHash } }, create: { companyId: actor.companyId!, importType: preview.type, fileName: preview.fileName, fileHash: preview.fileHash, status: preview.invalidCount ? "VALIDATED" : "READY", rowCount: preview.rows.length, validCount: preview.validCount, invalidCount: preview.invalidCount, createdById: actor.id, metadata: preview as unknown as Prisma.InputJsonValue }, update: {}, select: { id: true, status: true } }); }

export async function executeAccountImport(jobId: string) { const actor = await requirePermissionForMutation("ACCOUNT_ACCOUNTS"); const job = await db.accountImportJob.findFirst({ where: { id: jobId, companyId: actor.companyId! }, select: { id: true, status: true, importType: true, metadata: true } }); if (!job) throw new Error("IMPORT_JOB_NOT_FOUND"); if (job.status === "COMPLETED" || job.status === "PARTIAL") return { id: job.id, status: job.status, idempotent: true }; const preview = job.metadata as unknown as ImportPreview; if (preview.invalidCount || preview.rows.some((r) => r.action === "ERROR")) throw new Error("IMPORT_HAS_BLOCKING_ERRORS");
  const outcome = await db.$transaction(async (tx) => { await tx.accountImportJob.update({ where: { id: job.id }, data: { status: "PROCESSING", confirmedById: actor.id } }); let created = 0, updated = 0, skipped = 0;
    for (const row of preview.rows) { const v = row.values, r = row.resolved; if (row.action === "SKIP") { skipped++; continue; }
      if (preview.type === "CUSTOMERS") { const data = { name: v.name, branchId: r.branchId, phone: v.phone || null, email: v.email || null, address: v.address || null, gstin: v.gstin || null, stateCode: v.state_code || null, isAccountCustomer: true }; if (row.action === "UPDATE") { await tx.customer.updateMany({ where: { id: r.existingId, companyId: actor.companyId! }, data }); updated++; } else { await tx.customer.create({ data: { ...data, companyId: actor.companyId! } }); created++; } }
      else if (preview.type === "VENDORS") { const data = { name: v.name, phone: v.phone || null, email: v.email || null, address: v.address || null, gstin: v.gstin || null, stateCode: v.state_code || null }; if (row.action === "UPDATE") { await tx.vendor.updateMany({ where: { id: r.existingId, companyId: actor.companyId! }, data }); updated++; } else { await tx.vendor.create({ data: { ...data, companyId: actor.companyId! } }); created++; } }
      else if (preview.type === "ITEMS") { const data = { name: v.name, code: v.code || null, barcode: v.barcode || null, unitId: r.unitId, categoryId: r.categoryId, salePrice: v.sale_rate ? new Prisma.Decimal(v.sale_rate) : null, costPrice: v.purchase_rate ? new Prisma.Decimal(v.purchase_rate) : null, taxRate: v.tax_rate ? new Prisma.Decimal(v.tax_rate) : null, hsnCode: v.hsn || null, trackInventory: v.track_inventory?.toLowerCase() === "true" };let productId=r.existingId;if(row.action === "UPDATE") { await tx.accountProduct.updateMany({ where: { id: r.existingId, companyId: actor.companyId! }, data }); updated++; } else { const product=await tx.accountProduct.create({ data: { ...data, companyId: actor.companyId! },select:{id:true} });productId=product.id;created++; }if(r.priceType){const where={companyId:actor.companyId!,productId,priceType:r.priceType as "RETAIL"|"WHOLESALE"|"CUSTOMER",customerId:r.priceCustomerId||null,isActive:true},existing=await tx.productPrice.findFirst({where,select:{id:true}}),price={rate:new Prisma.Decimal(v.tier_rate),effectiveFrom:v.effective_from?new Date(`${v.effective_from}T00:00:00.000Z`):null,effectiveTo:v.effective_to?new Date(`${v.effective_to}T00:00:00.000Z`):null,isActive:v.price_active?.toLowerCase()!=="false"};if(existing)await tx.productPrice.update({where:{id:existing.id},data:price});else await tx.productPrice.create({data:{...where,...price}});} }
      else if (preview.type === "PROJECTS") { const projectNumber = await allocateDocumentNumberInTx(tx, { companyId: actor.companyId!, branchId: r.branchId, seriesKey: "PROJECT", defaults: { prefix: "PRJ-" } }); await tx.project.create({ data: { companyId: actor.companyId!, branchId: r.branchId, customerId: r.customerId, projectNumber, name: v.name, siteName: v.site, projectValue: new Prisma.Decimal(v.project_value || 0), createdById: actor.id } }); created++; }
    }
    if (preview.type === "OPENING_BALANCES") { if (actor.accountRole !== "ACCOUNT_ADMIN") throw new Error("UNAUTHORIZED"); const first = preview.rows[0]; await postJournalInTx(tx, { ...actor, companyId: actor.companyId! }, { financialYearId: first.resolved.financialYearId, branchId: first.resolved.branchId, entryDate: new Date(`${first.values.effective_date}T00:00:00.000Z`), reference: `Import ${job.id}`, narration: "Opening balances imported through Account Utilities", sourceType: "OPENING_BALANCE", sourceId: job.id, postingPurpose: "PRIMARY", lines: preview.rows.map((row) => ({ ledgerAccountId: row.resolved.ledgerId, debit: row.values.debit || "0", credit: row.values.credit || "0", description: `Import row ${row.rowNumber}` })) }, "OPENING_BALANCE_POSTED"); created = preview.rows.length; }
    const status: AccountImportStatus = "COMPLETED"; await tx.accountImportJob.update({ where: { id: job.id }, data: { status, completedAt: new Date(), metadata: { ...preview, result: { created, updated, skipped } } as unknown as Prisma.InputJsonValue } }); return { id: job.id, status, created, updated, skipped, idempotent: false }; }); return outcome; }

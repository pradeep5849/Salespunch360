import { assertTransferAvailable } from "./transfer-access";
import { createHash } from "node:crypto";
import * as XLSX from "@e965/xlsx";
import { decodeCsvRecord } from "./tabular-transfer";
import { Prisma, type AccountImportStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { allocateDocumentNumberInTx } from "./numbering";
import { postJournalInTx } from "@/lib/accounting/service";

export const ACCOUNT_IMPORT_TYPES = [
  "CUSTOMERS",
  "VENDORS",
  "ITEMS",
  "OPENING_BALANCES",
  "PROJECTS",
] as const;
export type AccountImportType = (typeof ACCOUNT_IMPORT_TYPES)[number];
export type ImportAction = "CREATE" | "UPDATE" | "SKIP" | "ERROR";
export type ImportPreviewRow = {
  rowNumber: number;
  action: ImportAction;
  values: Record<string, string>;
  before?:Record<string,string>;
  resolved: Record<string, string>;
  warnings: string[];
  errors: string[];
};
export type ImportPreview = {
  type: AccountImportType;
  fileName: string;
  fileHash: string;
  headers: string[];
  rows: ImportPreviewRow[];
  validCount: number;
  invalidCount: number;
};

const typeSchema = z.enum(ACCOUNT_IMPORT_TYPES);
const normalize = (value: unknown) => String(value ?? "").trim();

/** RFC4180-compatible enough for templates, including quoted commas/newlines and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (quoted) throw new Error("INVALID_CSV_UNCLOSED_QUOTE");
  return rows.filter((x) => x.some(Boolean));
}

export async function parseImportFile(fileName: string, bytes: Uint8Array) {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!["csv", "xlsx", "xls"].includes(extension ?? ""))
    throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  if (!bytes.length || bytes.length > 10 * 1024 * 1024)
    throw new Error("INVALID_IMPORT_FILE");
  let matrix: string[][];
  if (extension === "csv") matrix = parseCsv(new TextDecoder().decode(bytes));
  else if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(bytes, {
      type: "array",
      cellDates: true,
      dateNF: "yyyy-mm-dd",
      sheetRows: 20002,
    });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("EMPTY_WORKBOOK");
    if (
      Object.values(sheet).some(
        (cell) => cell && typeof cell === "object" && "f" in cell,
      )
    )
      throw new Error("IMPORT_FORMULAS_NOT_ALLOWED");
    matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
      dateNF: "yyyy-mm-dd",
    });
  } else throw new Error("UNSUPPORTED_IMPORT_FORMAT");
  if (matrix.length > 20001 || matrix.some((row) => row.length > 200))
    throw new Error("IMPORT_TOO_LARGE");
  if (matrix.length < 2) throw new Error("IMPORT_HAS_NO_DATA_ROWS");
  const aliases: Record<string, string> = {
    item_name: "name",
    item_code: "code",
    sale_price: "sale_rate",
    purchase_price: "purchase_rate",
    hsn_sac_code: "hsn",
    hsn_code: "hsn",
    item_category: "category",
  };
  const headers = matrix[0]
    .map((h) =>
      normalize(h)
        .toLowerCase()
        .replace(/[ /-]+/g, "_"),
    )
    .map((h) => aliases[h] ?? h);
  if (new Set(headers).size !== headers.length || headers.some((h) => !h))
    throw new Error("INVALID_IMPORT_HEADERS");
  return {
    headers,
    records: matrix
      .slice(1)
      .map((cells) =>
        decodeCsvRecord(
          Object.fromEntries(headers.map((h, i) => [h, normalize(cells[i])])),
        ),
      ),
    fileHash: createHash("sha256").update(bytes).digest("hex"),
  };
}

const requiredHeaders: Record<AccountImportType, string[]> = {
  CUSTOMERS: ["name", "branch"],
  VENDORS: ["name"],
  ITEMS: ["name", "unit", "category"],
  OPENING_BALANCES: [
    "ledger",
    "debit",
    "credit",
    "effective_date",
    "financial_year",
    "branch",
  ],
  PROJECTS: ["name", "customer", "branch"],
};
export const IMPORT_TEMPLATES = requiredHeaders;

export function assertImportPreviewScope(
  actor: { branchAccessScope?: string; branchIds?: string[] },
  preview: ImportPreview,
) {
  if (
    actor.branchAccessScope === "SELECTED_BRANCHES" &&
    preview.rows.some(
      (row) =>
        row.resolved.branchId &&
        !(actor.branchIds ?? []).includes(row.resolved.branchId),
    )
  )
    throw new Error("IMPORT_BRANCH_OUTSIDE_SCOPE");
}

export async function previewAccountImportForActor(
  actor: {
    id: string;
    companyId: string;
    accountRole: string | null;
    branchIds?: string[];
    branchAccessScope?: string;
  },
  input: {
    type: AccountImportType;
    fileName: string;
    bytes: Uint8Array;
    updateExisting?: boolean;
  },
): Promise<ImportPreview> {
  const type = typeSchema.parse(input.type);
  await assertTransferAvailable(actor, type);
  const parsed = await parseImportFile(input.fileName, input.bytes);
  const missing = requiredHeaders[type].filter(
    (h) => !parsed.headers.includes(h),
  );
  if (missing.length) throw new Error(`MISSING_COLUMNS:${missing.join(",")}`);
  const branches = await db.branch.findMany({
    where: {
      companyId: actor.companyId!,
      isActive: true,
      ...(actor.branchAccessScope === "SELECTED_BRANCHES"
        ? { id: { in: actor.branchIds ?? [] } }
        : {}),
    },
    select: { id: true, name: true, code: true },
  });
  const branchMap = new Map(
    branches.flatMap((b) => [
      [b.name.toLowerCase(), b],
      [b.code.toLowerCase(), b],
    ]),
  );
  const [customers, vendors, products, units, categories, ledgers, years] =
    await Promise.all([
      db.customer.findMany({
        where: {
          companyId: actor.companyId!,
          ...(actor.branchAccessScope === "SELECTED_BRANCHES"
            ? { branchId: { in: actor.branchIds ?? [] } }
            : {}),
        },
        select: { id: true, name: true, gstin: true, phone: true, email: true,address:true,stateCode:true,isActive:true,branchId:true,updatedAt:true },
      }),
      db.vendor.findMany({
        where: { companyId: actor.companyId! },
        select: { id: true, name: true, gstin: true, phone: true, email: true,address:true,stateCode:true,isActive:true,updatedAt:true },
      }),
      db.accountProduct.findMany({
        where: { companyId: actor.companyId! },
        select: { id: true, name: true, code: true, barcode: true,unitId:true,categoryId:true,salePrice:true,costPrice:true,taxRate:true,hsnCode:true,trackInventory:true,isActive:true,updatedAt:true },
      }),
      db.accountUnit.findMany({
        where: { companyId: actor.companyId!, isActive: true },
        select: { id: true, name: true, symbol: true },
      }),
      db.accountCategory.findMany({
        where: { companyId: actor.companyId!, isActive: true },
        select: { id: true, name: true },
      }),
      db.ledgerAccount.findMany({
        where: {
          companyId: actor.companyId!,
          isActive: true,
          allowPosting: true,
        },
        select: { id: true, code: true, name: true },
      }),
      db.financialYear.findMany({
        where: { companyId: actor.companyId! },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      }),
    ]);
  const seen = new Map<string, number>();
  const rows = parsed.records.map((values, index): ImportPreviewRow => {
    const errors: string[] = [],
      warnings: string[] = [],
      resolved: Record<string, string> = {};
    let action: ImportAction = "CREATE",before:Record<string,string>|undefined;
    const supported: Record<AccountImportType, string[]> = {
      CUSTOMERS: [
        "name",
        "branch",
        "phone",
        "email",
        "address",
        "gstin",
        "state_code",
        "is_active",
      ],
      VENDORS: [
        "name",
        "phone",
        "email",
        "address",
        "gstin",
        "state_code",
        "is_active",
      ],
      ITEMS: [
        "name",
        "unit",
        "category",
        "code",
        "barcode",
        "sale_rate",
        "purchase_rate",
        "tax_rate",
        "hsn",
        "track_inventory",
        "is_active",
        "price_type",
        "tier_rate",
        "customer",
        "customer_gstin",
        "effective_from",
        "effective_to",
        "price_active",
      ],
      PROJECTS: ["name", "customer", "branch", "site", "project_value"],
      OPENING_BALANCES: requiredHeaders.OPENING_BALANCES,
    };
    for (const [field, value] of Object.entries(values))
      if (value && !supported[type].includes(field))
        errors.push(
          `Unsupported column ${field}: its value would not be imported. Remove it or use the relevant workflow.`,
        );
    for (const field of ["is_active", "track_inventory", "price_active"])
      if (
        values[field] &&
        !["true", "false"].includes(values[field].toLowerCase())
      )
        errors.push(`${field} must be true or false`);
    for (const field of ["effective_from", "effective_to"])
      if (values[field]) {
        const date = new Date(`${values[field]}T00:00:00.000Z`);
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(values[field]) ||
          !Number.isFinite(date.getTime()) ||
          date.toISOString().slice(0, 10) !== values[field]
        )
          errors.push(`${field} must be a real YYYY-MM-DD date`);
      }
    if (
      values.effective_from &&
      values.effective_to &&
      values.effective_from > values.effective_to
    )
      errors.push("Price start date must not follow end date");

    if (!values.name && type !== "OPENING_BALANCES")
      errors.push("Name is required");
    const branch = values.branch
      ? branchMap.get(values.branch.toLowerCase())
      : undefined;
    if (["CUSTOMERS", "OPENING_BALANCES", "PROJECTS"].includes(type)) {
      if (!branch)
        errors.push("Branch is not active or is outside your authorized scope");
      else resolved.branchId = branch.id;
    }
    const duplicate =
      type === "CUSTOMERS"
        ? customers.filter(
            (x) =>
              (values.gstin && x.gstin === values.gstin) ||
              (!values.gstin &&
                ((values.phone && x.phone === values.phone) ||
                  (values.email && x.email === values.email))),
          )
        : type === "VENDORS"
          ? vendors.filter(
              (x) =>
                (values.gstin && x.gstin === values.gstin) ||
                (!values.gstin &&
                  ((values.phone && x.phone === values.phone) ||
                    (values.email && x.email === values.email))),
            )
          : type === "ITEMS"
            ? products.filter(
                (x) =>
                  (values.code && x.code === values.code) ||
                  (values.barcode && x.barcode === values.barcode),
              )
            : [];
    if (duplicate.length > 1) errors.push("Ambiguous duplicate match");
    else if (duplicate.length === 1) {
      resolved.existingId = duplicate[0].id;
      const target=duplicate[0] as unknown as Record<string,unknown>;
      if(target.updatedAt instanceof Date)resolved.targetVersion=target.updatedAt.toISOString();
      const fieldMap:Record<string,string>={name:"name",phone:"phone",email:"email",address:"address",gstin:"gstin",state_code:"stateCode",is_active:"isActive",code:"code",barcode:"barcode",sale_rate:"salePrice",purchase_rate:"costPrice",tax_rate:"taxRate",hsn:"hsnCode",track_inventory:"trackInventory"};
      before=Object.fromEntries(Object.entries(fieldMap).filter(([,field])=>field in target).map(([column,field])=>[column,target[field]==null?"":String(target[field])]));
      if(type==="CUSTOMERS")before.branch=branches.find(branch=>branch.id===target.branchId)?.code??String(target.branchId??"");
      if(type==="ITEMS"){before.unit=units.find(unit=>unit.id===target.unitId)?.name??"";before.category=categories.find(category=>category.id===target.categoryId)?.name??"";}
      action = input.updateExisting ? "UPDATE" : "SKIP";
      warnings.push(
        input.updateExisting
          ? "Existing record will be updated"
          : "Create-only mode skips existing records",
      );
    }
    // A second row must never silently overwrite or recreate an earlier row.
    if (type !== "OPENING_BALANCES") {
      const identifiers =
        type === "ITEMS"
          ? ["code", "barcode"]
          : type === "PROJECTS"
            ? ["name"]
            : ["gstin", "phone", "email"];
      for (const key of identifiers) {
        if (!values[key]) continue;
        const identity = `${key}:${values[key].toLowerCase()}`;
        const prior = seen.get(identity);
        if (prior) errors.push(`Duplicate ${key} in file (row ${prior})`);
        else seen.set(identity, index + 2);
      }
    }
    const decimalFields =
      type === "ITEMS"
        ? ["sale_rate", "purchase_rate", "tax_rate", "tier_rate"]
        : type === "PROJECTS"
          ? ["project_value"]
          : [];
    for (const field of decimalFields) {
      if (!values[field]) continue;
      try {
        const amount = new Prisma.Decimal(values[field]);
        if (
          !amount.isFinite() ||
          amount.isNegative() ||
          amount.decimalPlaces() > 2 ||
          amount.gte("10000000000000000") ||
          (field === "tax_rate" && amount.gt(100))
        )
          errors.push(
            `${field} must be a finite non-negative amount with at most two decimals${field === "tax_rate" ? " between 0 and 100" : ""}`,
          );
      } catch {
        errors.push(`Invalid ${field}`);
      }
    }
    if (type === "ITEMS") {
      const unit = units.find(
          (x) =>
            x.name.toLowerCase() === values.unit.toLowerCase() ||
            x.symbol.toLowerCase() === values.unit.toLowerCase(),
        ),
        category = categories.find(
          (x) => x.name.toLowerCase() === values.category.toLowerCase(),
        );
      if (!unit) errors.push("Unit does not exist");
      else resolved.unitId = unit.id;
      if (!category) errors.push("Category does not exist");
      else resolved.categoryId = category.id;
      if (values.price_type || values.tier_rate) {
        const priceType = values.price_type.toUpperCase();
        if (!["RETAIL", "WHOLESALE", "CUSTOMER"].includes(priceType))
          errors.push("Price type must be RETAIL, WHOLESALE, or CUSTOMER");
        else resolved.priceType = priceType;
        try {
          if (
            !values.tier_rate ||
            new Prisma.Decimal(values.tier_rate).isNegative()
          )
            errors.push("Tier rate must be a non-negative Decimal");
        } catch {
          errors.push("Invalid tier rate");
        }
        if (priceType === "CUSTOMER") {
          const key = values.customer?.toLowerCase(),
            customer = customers.find(
              (x) =>
                x.id === values.customer ||
                x.name.toLowerCase() === key ||
                Boolean(
                  values.customer_gstin && x.gstin === values.customer_gstin,
                ),
            );
          if (!customer) errors.push("Customer does not exist in this Company");
          else resolved.priceCustomerId = customer.id;
        } else if (values.customer || values.customer_gstin)
          warnings.push("Customer is ignored for non-CUSTOMER pricing");
      }
    }
    if (type === "PROJECTS") {
      const customer = customers.find(
        (x) => x.name.toLowerCase() === values.customer.toLowerCase(),
      );
      if (!customer) errors.push("Customer does not exist in this Company");
      else resolved.customerId = customer.id;
    }
    if (type === "OPENING_BALANCES") {
      const ledger = ledgers.find(
          (x) =>
            x.code.toLowerCase() === values.ledger.toLowerCase() ||
            x.name.toLowerCase() === values.ledger.toLowerCase(),
        ),
        year = years.find(
          (x) => x.name.toLowerCase() === values.financial_year.toLowerCase(),
        );
      if (!ledger) errors.push("Posting ledger does not exist");
      else resolved.ledgerId = ledger.id;
      if (!year) errors.push("Financial Year does not exist");
      else {
        resolved.financialYearId = year.id;
        if (year.status === "CLOSED") errors.push("Financial Year is closed");
        const date = new Date(`${values.effective_date}T00:00:00.000Z`);
        if (
          Number.isNaN(date.valueOf()) ||
          date.toISOString().slice(0, 10) !== values.effective_date ||
          date < year.startDate ||
          date > year.endDate
        )
          errors.push("Effective date is outside Financial Year");
      }
      try {
        const d = new Prisma.Decimal(values.debit || 0),
          c = new Prisma.Decimal(values.credit || 0);
        if (
          !d.isFinite() ||
          !c.isFinite() ||
          d.decimalPlaces() > 2 ||
          c.decimalPlaces() > 2 ||
          d.isNegative() ||
          c.isNegative() ||
          d.gt(0) === c.gt(0)
        )
          errors.push("Exactly one non-negative debit or credit is required");
      } catch {
        errors.push("Invalid Decimal amount");
      }
    }
    if (errors.length) action = "ERROR";
    return { rowNumber: index + 2, action, values, ...(before?{before}:{}), resolved, warnings, errors };
  });
  if (type === "OPENING_BALANCES") {
    const contexts = new Set(
      rows.map((row) =>
        JSON.stringify([
          row.resolved.branchId,
          row.resolved.financialYearId,
          row.values.effective_date,
        ]),
      ),
    );
    if (contexts.size !== 1)
      rows.forEach((row) => {
        row.action = "ERROR";
        row.errors.push(
          "All opening rows must use the same branch, financial year and effective date",
        );
      });
  }
  if (
    type === "OPENING_BALANCES" &&
    rows.every((row) => row.action !== "ERROR")
  ) {
    const debit = rows.reduce(
        (sum, r) => sum.plus(r.values.debit || 0),
        new Prisma.Decimal(0),
      ),
      credit = rows.reduce(
        (sum, r) => sum.plus(r.values.credit || 0),
        new Prisma.Decimal(0),
      );
    if (!debit.equals(credit))
      rows.forEach((r) => {
        r.action = "ERROR";
        r.errors.push(
          `Opening balance is unbalanced (${debit.toFixed(2)} / ${credit.toFixed(2)})`,
        );
      });
  }
  return {
    type,
    fileName: input.fileName,
    fileHash: parsed.fileHash,
    headers: parsed.headers,
    rows,
    validCount: rows.filter((r) => r.action !== "ERROR").length,
    invalidCount: rows.filter((r) => r.action === "ERROR").length,
  };
}

export async function saveImportPreviewForActor(
  actor: { id: string; companyId: string },
  preview: ImportPreview,
) {
  const planHash = createHash("sha256")
    .update(
      JSON.stringify({
        type: preview.type,
        fileHash: preview.fileHash,
        rows: preview.rows,
      }),
    )
    .digest("hex");
  return db.accountImportJob.upsert({
    where: {
      companyId_importType_fileHash: {
        companyId: actor.companyId!,
        importType: preview.type,
        fileHash: planHash,
      },
    },
    create: {
      companyId: actor.companyId!,
      importType: preview.type,
      fileName: preview.fileName,
      fileHash: planHash,
      status: preview.invalidCount ? "VALIDATED" : "READY",
      rowCount: preview.rows.length,
      validCount: preview.validCount,
      invalidCount: preview.invalidCount,
      createdById: actor.id,
      metadata: preview as unknown as Prisma.InputJsonValue,
    },
    update: {},
    select: { id: true, status: true },
  });
}

export async function executeAccountImportForActor(
  actor: {
    id: string;
    companyId: string;
    accountRole: string | null;
    branchAccessScope?: string;
    branchIds?: string[];
  },
  jobId: string,
) {
  z.string().uuid().parse(jobId);
  if (
    !["ACCOUNT_ADMIN", "ACCOUNTANT", "DATA_ENTRY"].includes(
      actor.accountRole ?? "",
    )
  )
    throw new Error("UNAUTHORIZED");
  const outcome = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id = ${actor.companyId}::uuid FOR UPDATE`;
    const job = await tx.accountImportJob.findFirst({
      where: { id: jobId, companyId: actor.companyId },
      select: { id: true, status: true, importType: true, metadata: true },
    });
    if (!job) throw new Error("IMPORT_JOB_NOT_FOUND");
    assertImportPreviewScope(actor, job.metadata as unknown as ImportPreview);
    if (job.status === "COMPLETED" || job.status === "PARTIAL") {
      const previous = job.metadata as unknown as ImportPreview & {
        result?: { created: number; updated: number; skipped: number };
      };
      return {
        id: job.id,
        status: job.status,
        ...previous.result,
        idempotent: true,
      };
    }
    if (job.status !== "READY") throw new Error("IMPORT_NOT_READY");
    const preview = job.metadata as unknown as ImportPreview;
    // Recheck the current feature policy without opening a nested database transaction.
    if (preview.type === "ITEMS") {
      const settings = await tx.accountSettings.findUnique({
        where: { companyId: actor.companyId },
        select: { itemSettings: true },
      });
      if (
        settings?.itemSettings &&
        typeof settings.itemSettings === "object" &&
        !Array.isArray(settings.itemSettings) &&
        settings.itemSettings.enabled === false
      )
        throw new Error("ITEMS_DISABLED");
    }
    if (preview.type === "PROJECTS") {
      const settings = await tx.accountSettings.findUnique({
        where: { companyId: actor.companyId },
        select: { enabledModules: true },
      });
      if (settings && !settings.enabledModules.includes("PROJECTS"))
        throw new Error("MODULE_DISABLED:PROJECTS");
    }
    if (
      preview.type !== job.importType ||
      !preview.rows.length ||
      preview.invalidCount ||
      preview.rows.some((r) => r.action === "ERROR")
    )
      throw new Error("IMPORT_HAS_BLOCKING_ERRORS");
    if (
      preview.type === "OPENING_BALANCES" &&
      new Set(
        preview.rows.map((row) =>
          JSON.stringify([
            row.resolved.branchId,
            row.resolved.financialYearId,
            row.values.effective_date,
          ]),
        ),
      ).size !== 1
    )
      throw new Error("IMPORT_MIXED_OPENING_CONTEXT");
    const previouslyApplied = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM account_import_jobs
      WHERE "companyId"=${actor.companyId}::uuid AND "importType"=${preview.type}
      AND id<>${job.id}::uuid AND status IN ('COMPLETED','PARTIAL')
      AND ("fileHash"=${preview.fileHash} OR metadata->>'fileHash'=${preview.fileHash})
      AND (metadata->'result'->>'created' IS NULL OR metadata->'result'->>'updated' IS NULL
        OR (metadata->'result'->>'created')::numeric>0 OR (metadata->'result'->>'updated')::numeric>0)
      LIMIT 1`;
    if (previouslyApplied.length)
      throw new Error("IMPORT_FILE_ALREADY_COMPLETED");
    // Resolve every reference again at confirmation using the current company and branch scope.
    for (const row of preview.rows) {
      const r = row.resolved;
      if(row.action==="UPDATE"&&(!r.targetVersion||!z.string().datetime().safeParse(r.targetVersion).success))throw new Error("IMPORT_TARGET_CHANGED");
      if (
        r.branchId &&
        !(await tx.branch.findFirst({
          where: {
            id: r.branchId,
            companyId: actor.companyId,
            isActive: true,
            ...(actor.branchAccessScope === "SELECTED_BRANCHES"
              ? { id: { in: actor.branchIds ?? [], equals: r.branchId } }
              : {}),
          },
          select: { id: true },
        }))
      )
        throw new Error("IMPORT_BRANCH_OUTSIDE_SCOPE");
      for (const id of [r.customerId, r.priceCustomerId].filter(Boolean)) {
        if (
          !(await tx.customer.findFirst({
            where: {
              id,
              companyId: actor.companyId,
              ...(actor.branchAccessScope === "SELECTED_BRANCHES"
                ? { branchId: { in: actor.branchIds ?? [] } }
                : {}),
            },
            select: { id: true },
          }))
        )
          throw new Error("IMPORT_REFERENCE_CHANGED");
      }
      if (
        r.unitId &&
        !(await tx.accountUnit.findFirst({
          where: { id: r.unitId, companyId: actor.companyId, isActive: true },
          select: { id: true },
        }))
      )
        throw new Error("IMPORT_REFERENCE_CHANGED");
      if (
        r.categoryId &&
        !(await tx.accountCategory.findFirst({
          where: {
            id: r.categoryId,
            companyId: actor.companyId,
            isActive: true,
          },
          select: { id: true },
        }))
      )
        throw new Error("IMPORT_REFERENCE_CHANGED");
      if (
        r.ledgerId &&
        !(await tx.ledgerAccount.findFirst({
          where: {
            id: r.ledgerId,
            companyId: actor.companyId,
            isActive: true,
            allowPosting: true,
          },
          select: { id: true },
        }))
      )
        throw new Error("IMPORT_REFERENCE_CHANGED");
    }
    await tx.accountImportJob.update({
      where: { id: job.id },
      data: { status: "PROCESSING", confirmedById: actor.id },
    });
    let created = 0,
      updated = 0,
      skipped = 0;
    for (const row of preview.rows) {
      const v = row.values,
        r = row.resolved;
      if (row.action === "SKIP") {
        skipped++;
        continue;
      }
      if (preview.type === "CUSTOMERS") {
        const data = {
          name: v.name,
          branchId: r.branchId,
          phone: v.phone || null,
          email: v.email || null,
          address: v.address || null,
          gstin: v.gstin || null,
          stateCode: v.state_code || null,
          ...(v.is_active
            ? { isActive: v.is_active.toLowerCase() === "true" }
            : {}),
          isAccountCustomer: true,
        };
        if (row.action === "UPDATE") {
          const changed = await tx.customer.updateMany({
            where: {
              id: r.existingId,
              companyId: actor.companyId!,
              updatedAt:new Date(r.targetVersion),
              ...(actor.branchAccessScope === "SELECTED_BRANCHES"
                ? { branchId: { in: actor.branchIds ?? [] } }
                : {}),
            },
            data,
          });
          if (changed.count !== 1) throw new Error("IMPORT_TARGET_CHANGED");
          updated++;
        } else {
          await tx.customer.create({
            data: { ...data, companyId: actor.companyId! },
          });
          created++;
        }
      } else if (preview.type === "VENDORS") {
        const data = {
          name: v.name,
          phone: v.phone || null,
          email: v.email || null,
          address: v.address || null,
          gstin: v.gstin || null,
          stateCode: v.state_code || null,
          ...(v.is_active
            ? { isActive: v.is_active.toLowerCase() === "true" }
            : {}),
        };
        if (row.action === "UPDATE") {
          const changed = await tx.vendor.updateMany({
            where: { id: r.existingId, companyId: actor.companyId!, updatedAt:new Date(r.targetVersion) },
            data,
          });
          if (changed.count !== 1) throw new Error("IMPORT_TARGET_CHANGED");
          updated++;
        } else {
          await tx.vendor.create({
            data: { ...data, companyId: actor.companyId! },
          });
          created++;
        }
      } else if (preview.type === "ITEMS") {
        const data = {
          name: v.name,
          code: v.code || null,
          barcode: v.barcode || null,
          unitId: r.unitId,
          categoryId: r.categoryId,
          salePrice: v.sale_rate ? new Prisma.Decimal(v.sale_rate) : null,
          costPrice: v.purchase_rate
            ? new Prisma.Decimal(v.purchase_rate)
            : null,
          taxRate: v.tax_rate ? new Prisma.Decimal(v.tax_rate) : null,
          hsnCode: v.hsn || null,
          ...(v.is_active
            ? { isActive: v.is_active.toLowerCase() === "true" }
            : {}),
          trackInventory: v.track_inventory?.toLowerCase() === "true",
        };
        let productId = r.existingId;
        if (row.action === "UPDATE") {
          const changed = await tx.accountProduct.updateMany({
            where: { id: r.existingId, companyId: actor.companyId!, updatedAt:new Date(r.targetVersion) },
            data,
          });
          if (changed.count !== 1) throw new Error("IMPORT_TARGET_CHANGED");
          updated++;
        } else {
          const product = await tx.accountProduct.create({
            data: { ...data, companyId: actor.companyId! },
            select: { id: true },
          });
          productId = product.id;
          created++;
        }
        if (r.priceType) {
          const where = {
              companyId: actor.companyId!,
              productId,
              priceType: r.priceType as "RETAIL" | "WHOLESALE" | "CUSTOMER",
              customerId: r.priceCustomerId || null,
              isActive: true,
            },
            existing = await tx.productPrice.findFirst({
              where,
              select: { id: true },
            }),
            price = {
              rate: new Prisma.Decimal(v.tier_rate),
              effectiveFrom: v.effective_from
                ? new Date(`${v.effective_from}T00:00:00.000Z`)
                : null,
              effectiveTo: v.effective_to
                ? new Date(`${v.effective_to}T00:00:00.000Z`)
                : null,
              isActive: v.price_active?.toLowerCase() !== "false",
            };
          if (existing)
            await tx.productPrice.update({
              where: { id: existing.id },
              data: price,
            });
          else await tx.productPrice.create({ data: { ...where, ...price } });
        }
      } else if (preview.type === "PROJECTS") {
        const projectNumber = await allocateDocumentNumberInTx(tx, {
          companyId: actor.companyId!,
          branchId: r.branchId,
          seriesKey: "PROJECT",
          defaults: { prefix: "PRJ-" },
        });
        await tx.project.create({
          data: {
            companyId: actor.companyId!,
            branchId: r.branchId,
            customerId: r.customerId,
            projectNumber,
            name: v.name,
            siteName: v.site,
            projectValue: new Prisma.Decimal(v.project_value || 0),
            createdById: actor.id,
          },
        });
        created++;
      }
    }
    if (preview.type === "OPENING_BALANCES") {
      if (actor.accountRole !== "ACCOUNT_ADMIN")
        throw new Error("UNAUTHORIZED");
      const first = preview.rows[0];
      await postJournalInTx(
        tx,
        { ...actor, companyId: actor.companyId! },
        {
          financialYearId: first.resolved.financialYearId,
          branchId: first.resolved.branchId,
          entryDate: new Date(`${first.values.effective_date}T00:00:00.000Z`),
          reference: `Import ${job.id}`,
          narration: "Opening balances imported through Account Utilities",
          sourceType: "OPENING_BALANCE",
          sourceId: job.id,
          postingPurpose: "PRIMARY",
          lines: preview.rows.map((row) => ({
            ledgerAccountId: row.resolved.ledgerId,
            debit: row.values.debit || "0",
            credit: row.values.credit || "0",
            description: `Import row ${row.rowNumber}`,
          })),
        },
        "OPENING_BALANCE_POSTED",
      );
      created = preview.rows.length;
    }
    const status: AccountImportStatus = "COMPLETED";
    await tx.accountImportJob.update({
      where: { id: job.id },
      data: {
        status,
        completedAt: new Date(),
        metadata: {
          ...preview,
          result: { created, updated, skipped },
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return { id: job.id, status, created, updated, skipped, idempotent: false };
  });
  return outcome;
}

export async function previewAccountImport(input: {
  type: AccountImportType;
  fileName: string;
  bytes: Uint8Array;
  updateExisting?: boolean;
}) {
  const actor = await requirePermissionForMutation(
    input.type === "OPENING_BALANCES"
      ? "ACCOUNT_OPENING_BALANCE"
      : "ACCOUNT_ACCOUNTS",
  );
  return previewAccountImportForActor(actor as never, input);
}
export async function saveImportPreview(preview: ImportPreview) {
  const actor = await requirePermissionForMutation(
    preview.type === "OPENING_BALANCES"
      ? "ACCOUNT_OPENING_BALANCE"
      : "ACCOUNT_ACCOUNTS",
  );
  return saveImportPreviewForActor(actor as never, preview);
}
export async function executeAccountImport(jobId: string) {
  const actor = await requirePermissionForMutation("ACCOUNT_ACCOUNTS");
  return executeAccountImportForActor(actor as never, jobId);
}

import { EFFECTIVE_ADVANCE_APPLICATION, EFFECTIVE_SETTLEMENT, EFFECTIVE_SETTLEMENT_ALLOCATION } from "./settlement-policy";
import { createHash } from "node:crypto";
import { normalizeTransactionPreferences } from "./transaction-settings";
import {recentSalePrices} from "./recent-sale-prices";
import {transactionRoundingLimit,defaultTransactionRoundOff} from "./transaction-rounding";
import {transactionHeaderFields} from "./transaction-header";
import {applyTransactionDefaults} from "./transaction-defaults";
import { inAccountTransaction } from "./transaction-scope";
import {saveCustomFieldValuesInTx} from "./custom-field-values";
import { commercialCreationHash } from "./commercial-request-identity";
import { retrySerializable } from "./transaction-retry";
import { projectPurchaseReturnsInTx } from "./project-purchase-returns";
import {
  CommercialAuditEventType,
  CommercialDocumentType,
  CommercialLineType,
  DiscountType,
  PaymentMode,
  PaymentReminderStatus,
  Prisma,
  PurchaseAllocationType,
  PurchaseClassification,
  PurchasePurpose,
  MaterialTreatment,
  SettlementType,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { canUsePermission, type Permission } from "@/lib/auth/permissions";
import {
  authorizeProjectForCommercial,
  listOpenProjectOptionsForActor,
  getProjectForActor,
  type ProjectActor,
} from "./projects";
import { postJournalInTx } from "@/lib/accounting/service";
import {
  allocateDocumentNumberInTx,
  SALES_INVOICE_NUMBERING_DEFAULTS,
} from "./numbering";
import {
  enabledModulesForCompany,
  requireAccountModules,
  type ModuleKey,
} from "./modules";
import { calculateTax } from "./tax";
import { signedQuantity, stockValuation } from "./inventory";
import { defaultSaleWarehouse } from "./sale-warehouse";
import { listOpeningOutstandings } from "./opening-balances";
import {
  buildPurchaseAllocations,
  type PurchaseAllocationRequest,
} from "./purchase-allocations";
import {
  assertCommercialItemLine,
  resolveItemSettings,
  type ItemSettings,
} from "./item-settings-policy";

const D = Prisma.Decimal;
type Actor = ProjectActor;
type PurchasePostingRow = {
  allocationType: PurchaseAllocationType;
  taxableAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
};
export function purchasePostingBuckets(
  rows: PurchasePostingRow[],
  eligible: boolean,
) {
  const z = () => new D(0),
    result = {
      inventory: z(),
      generalExpense: z(),
      fixedAsset: z(),
      projectWip: z(),
      itc: z(),
    };
  for (const row of rows) {
    const cost = row.taxableAmount.add(eligible ? 0 : row.taxAmount);
    result.itc = result.itc.add(eligible ? row.taxAmount : 0);
    if (row.allocationType === "INVENTORY")
      result.inventory = result.inventory.add(cost);
    else if (row.allocationType === "GENERAL_EXPENSE")
      result.generalExpense = result.generalExpense.add(cost);
    else if (row.allocationType === "FIXED_ASSET")
      result.fixedAsset = result.fixedAsset.add(cost);
    else result.projectWip = result.projectWip.add(cost);
  }
  return result;
}
export const commercialDocumentPolicies: Record<
  CommercialDocumentType,
  {
    modules: ModuleKey[];
    permission: Permission;
    party: "customer" | "vendor";
    prefix: string;
    financial: boolean;
  }
> = {
  SALES_ORDER: {
    modules: ["SALES", "SALES_ORDER"],
    permission: "ACCOUNT_SALES_ENTRY",
    party: "customer",
    prefix: "SO-",
    financial: false,
  },
  PROFORMA_INVOICE: {
    modules: ["SALES", "PROFORMA_INVOICE"],
    permission: "ACCOUNT_SALES_ENTRY",
    party: "customer",
    prefix: "PI-",
    financial: false,
  },
  SALES_INVOICE: {
    modules: ["SALES"],
    permission: "ACCOUNT_SALES_ENTRY",
    party: "customer",
    prefix: "INV-",
    financial: true,
  },
  DELIVERY_CHALLAN: {
    modules: ["SALES", "DELIVERY_CHALLAN"],
    permission: "ACCOUNT_SALES_ENTRY",
    party: "customer",
    prefix: "DC-",
    financial: false,
  },
  CREDIT_NOTE: {
    modules: ["SALES", "CREDIT_NOTE"],
    permission: "ACCOUNT_SALES_ENTRY",
    party: "customer",
    prefix: "CN-",
    financial: true,
  },
  PURCHASE_ORDER: {
    modules: ["PURCHASES", "PURCHASE_ORDER"],
    permission: "ACCOUNT_PURCHASE_ENTRY",
    party: "vendor",
    prefix: "PO-",
    financial: false,
  },
  PURCHASE_BILL: {
    modules: ["PURCHASES", "PURCHASE_BILLS"],
    permission: "ACCOUNT_PURCHASE_ENTRY",
    party: "vendor",
    prefix: "PB-",
    financial: true,
  },
  DEBIT_NOTE: {
    modules: ["PURCHASES", "DEBIT_NOTE"],
    permission: "ACCOUNT_PURCHASE_ENTRY",
    party: "vendor",
    prefix: "DN-",
    financial: true,
  },
  SUBCONTRACT_PURCHASE: {
    modules: ["PURCHASES", "SUBCONTRACTORS"],
    permission: "ACCOUNT_PURCHASE_ENTRY",
    party: "vendor",
    prefix: "SC-",
    financial: false,
  },
};
const policies = commercialDocumentPolicies;

/** Pure shared policy: a create type requires every module and its centralized permission. */
export function availableCommercialDocumentTypes(
  enabledModules: readonly string[],
  hasPermission: (permission: Permission) => boolean,
) {
  return (
    Object.keys(commercialDocumentPolicies) as CommercialDocumentType[]
  ).filter((type) => {
    const policy = commercialDocumentPolicies[type];
    return (
      policy.modules.every((module) => enabledModules.includes(module)) &&
      hasPermission(policy.permission)
    );
  });
}
export function normalizeVendorInvoiceNumber(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}
export function availablePurchasePurposes(
  projectCapable: boolean,
): PurchasePurpose[] {
  return [
    "INVENTORY_SALES",
    "GENERAL_OFFICE",
    "FIXED_ASSET",
    "MIXED",
    ...(projectCapable ? ["PROJECT" as const] : []),
  ];
}
export function purchaseProjectCapability(
  enabledModules: readonly string[],
  hasProjectPermission: boolean,
) {
  return enabledModules.includes("PROJECTS") && hasProjectPermission;
}
export function assertPurchaseProjectSelection(
  input: { purchasePurpose?: PurchasePurpose; projectId?: string },
  projectCapable: boolean,
) {
  if (input.purchasePurpose !== "PROJECT") {
    if (input.projectId)
      throw new Error("PROJECT_NOT_ALLOWED_FOR_NON_PROJECT_PURCHASE");
    return;
  }
  if (!projectCapable) throw new AuthorizationError();
  if (!input.projectId) throw new Error("PROJECT_ID_REQUIRED");
}

export function resolveCommercialTaxRate(
  explicit: string | undefined,
  master: Prisma.Decimal | null,
) {
  return new Prisma.Decimal(explicit ?? master ?? 0);
}
export function selectMasterRate(
  purchase: boolean,
  sellingRate: Prisma.Decimal | null,
  costRate: Prisma.Decimal | null,
) {
  return purchase ? costRate : sellingRate;
}
export function purchaseClassificationForPosting(
  type: CommercialDocumentType,
  documentClassification: PurchaseClassification | null,
  sourceClassification: PurchaseClassification | null,
) {
  return type === "DEBIT_NOTE" ? sourceClassification : documentClassification;
}
export function assertAdjustmentWithinSource(
  current: {
    taxableTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
    payableAmount?: Prisma.Decimal | null;
  },
  source: {
    taxableTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
  },
  used: {
    taxableTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    grandTotal: Prisma.Decimal;
  },
  outstanding: Prisma.Decimal,
) {
  const limits = [
    [current.taxableTotal, source.taxableTotal, used.taxableTotal, "TAXABLE"],
    [current.taxTotal, source.taxTotal, used.taxTotal, "TAX"],
    [current.grandTotal, source.grandTotal, used.grandTotal, "GRAND_TOTAL"],
  ] as const;
  for (const [amount, maximum, prior, label] of limits)
    if (prior.add(amount).gt(maximum))
      throw new Error(`ADJUSTMENT_${label}_EXCEEDS_SOURCE`);
  if ((current.payableAmount ?? current.grandTotal).gt(outstanding))
    throw new Error("ADJUSTMENT_EXCEEDS_OUTSTANDING");
}
const decimal = z.union([z.string(), z.number()]).transform(String);
const lineSchema = z.object({
  servicePeriodDays:z.number().int().min(1).max(3650).optional(),
  lineType: z.nativeEnum(CommercialLineType),
  sourceId: z.string().uuid().optional(),
  itemName: z.string().trim().min(1).max(240).optional(),
  itemCode: z.string().max(80).optional(),
  description: z.string().max(10_000).optional(),
  specification: z.string().max(20_000).optional(),
  unitName: z.string().max(80).optional(),
  unitSymbol: z.string().max(20).optional(),
  quantity: decimal,
  rate: decimal.optional(),
  discountType: z.nativeEnum(DiscountType).nullable().optional(),
  discountValue: decimal.nullable().optional(),
  taxRate: decimal.optional(),
  cessRate: decimal.optional(),
  warehouseId: z.string().uuid().optional(),
  batchId: z.string().uuid().optional(),
  serialNumberId: z.string().uuid().optional(),
  stockReturnQuantity: decimal.optional(),
  sourceCommercialLineId: z.string().uuid().optional(),
  purchaseAllocations: z
    .array(
      z
        .object({
          allocationType: z.enum([
            "INVENTORY",
            "PROJECT",
            "GENERAL_EXPENSE",
            "FIXED_ASSET",
          ]),
          quantity: decimal,
          projectId: z.string().uuid().optional(),
          projectBudgetLineId: z.string().uuid().optional(),
          warehouseId: z.string().uuid().optional(),
          materialTreatment: z
            .enum(["DIRECT_TO_PROJECT", "RECEIVE_IN_INVENTORY"])
            .optional(),
        })
        .strict(),
    )
    .optional(),
});
export const commercialDocumentInput = z
  .object({
    ...transactionHeaderFields,
    idempotencyKey: z.string().trim().min(1).max(120).optional(),
    customFields:z.record(z.string(),z.string().max(10000)).optional(),
    type: z.nativeEnum(CommercialDocumentType),
    branchId: z.string().uuid(),
    partyId: z.string().uuid(),
    documentNumber: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9][A-Za-z0-9 ./_-]*$/)
      .optional(),
    sourceDocumentId: z.string().uuid().optional(),
    sourcePurchaseOrderId: z.string().uuid().optional(),
    purchasePurpose: z.nativeEnum(PurchasePurpose).optional(),
    purchaseClassification: z.nativeEnum(PurchaseClassification).optional(),
    projectReference: z.string().trim().max(240).optional(),
    projectId: z.string().uuid().optional(),
    projectBudgetLineId: z.string().uuid().optional(),
    materialTreatment: z.nativeEnum(MaterialTreatment).optional(),
    vendorInvoiceNumber: z.string().trim().min(1).max(120).optional(),
    vendorInvoiceDate: z.coerce.date().optional(),
    postingDate: z.coerce.date().optional(),
    paymentTerms: z.string().trim().max(500).optional(),
    grnReference: z.string().trim().max(160).optional(),
    purchaseLocation: z.string().trim().max(240).optional(),
    freightAmount: decimal.optional(),
    otherChargesAmount: decimal.optional(),
    roundOffAmount: z
      .union([z.string(), z.number()])
      .transform(String)
      .optional(),
    issueDate: z.coerce.date(),
    dueDate: z.coerce.date().optional(),
    notes: z.string().max(5000).optional(),
    taxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]).default("EXCLUSIVE"),
    stateOfSupplyCode: z
      .string()
      .regex(/^\d{2}$/)
      .optional(),
    reverseCharge: z.boolean().default(false),
    taxCreditTreatment: z
      .enum(["ELIGIBLE", "INELIGIBLE", "BLOCKED"])
      .default("ELIGIBLE"),
    tdsRate: decimal.optional(),
    tcsRate: decimal.optional(),
    lines: z.array(lineSchema).min(1).max(500),
  })
  .strict()
  .superRefine((v, c) => {
    const purchase = policies[v.type].party === "vendor";
    if (purchase && !v.purchasePurpose)
      c.addIssue({
        code: "custom",
        message: "Purchase purpose is required",
        path: ["purchasePurpose"],
      });
    if (
      v.type === "PURCHASE_BILL" &&
      (!v.vendorInvoiceNumber || !v.vendorInvoiceDate)
    )
      c.addIssue({
        code: "custom",
        message: "Vendor invoice number and date are required",
        path: ["vendorInvoiceNumber"],
      });
    if (
      v.type !== "DEBIT_NOTE" &&
      v.purchasePurpose === "PROJECT" &&
      !v.projectId &&
      !v.projectReference
    )
      c.addIssue({
        code: "custom",
        message: "Project is required",
        path: ["projectId"],
      });
    if (
      v.purchasePurpose !== "PROJECT" &&
      (v.projectBudgetLineId || v.materialTreatment)
    )
      c.addIssue({
        code: "custom",
        message: "Project fields require Project purchase",
        path: ["purchasePurpose"],
      });
    if (!purchase && v.purchasePurpose)
      c.addIssue({
        code: "custom",
        message: "Purchase fields are not valid for Sales",
        path: ["purchasePurpose"],
      });
    if (["CREDIT_NOTE", "DEBIT_NOTE"].includes(v.type) && v.projectId)
      c.addIssue({
        code: "custom",
        message: "Adjustment project is inherited from its source",
        path: ["projectId"],
      });
  });
function scope(a: Actor) {
  return a.branchAccessScope === "SELECTED_BRANCHES"
    ? { branchId: { in: a.branchIds ?? [] } }
    : {};
}
function assertBranch(a: Actor, branchId: string) {
  if (
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !a.branchIds?.includes(branchId)
  )
    throw new Error("INVALID_BRANCH");
}
function financialRole(a: Actor) {
  if (a.accountRole !== "ACCOUNT_ADMIN" && a.accountRole !== "ACCOUNTANT")
    throw new AuthorizationError();
}
async function systemContext(
  tx: Prisma.TransactionClient,
  a: Actor,
  date: Date,
  keys: string[],
) {
  const [fy, accounts, lock] = await Promise.all([
    tx.financialYear.findFirst({
      where: {
        companyId: a.companyId,
        isActive: true,
        status: "OPEN",
        startDate: { lte: date },
        endDate: { gte: date },
      },
      orderBy: { startDate: "desc" },
    }),
    tx.ledgerAccount.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        allowPosting: true,
        systemKey: { in: keys },
      },
    }),
    tx.accountingPeriodLock.findFirst({
      where: {
        companyId: a.companyId,
        financialYear: { startDate: { lte: date }, endDate: { gte: date } },
      },
    }),
  ]);
  if (!fy) throw new Error("INVALID_FINANCIAL_YEAR");
  if (lock?.lockedThrough && date <= lock.lockedThrough)
    throw new Error("PERIOD_LOCKED");
  const byKey = new Map(accounts.map((x) => [x.systemKey!, x.id]));
  for (const key of keys)
    if (!byKey.has(key)) throw new Error(`SYSTEM_LEDGER_MISSING:${key}`);
  return { fy, account: (key: string) => byKey.get(key)! };
}
async function audit(
  tx: Prisma.TransactionClient,
  a: Actor,
  eventType: CommercialAuditEventType,
  entityType: string,
  entityId: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.commercialAuditEvent.create({
    data: {
      companyId: a.companyId,
      actorId: a.id,
      eventType,
      entityType,
      entityId,
      metadata,
    },
  });
}
async function snapshotLine(
  tx: Prisma.TransactionClient,
  a: Actor,
  type: CommercialDocumentType,
  row: z.infer<typeof lineSchema>,
  position: number,
  branchId: string,
  sourceDocumentId?: string,
  sourceTaxMode?: "EXCLUSIVE" | "INCLUSIVE",
  itemSettings: ItemSettings = resolveItemSettings(null),
  purchaseInventory = true,
  transactionDefaults?:Prisma.JsonValue,
) {
  assertCommercialItemLine(itemSettings, row);
  const purchase = policies[type].party === "vendor",
    allowed = purchase
      ? ["MATERIAL", "SERVICE", "SUBCONTRACT", "CUSTOM"]
      : ["PRODUCT", "SERVICE", "WORK_PACKAGE", "CUSTOM"];
  if (!allowed.includes(row.lineType)) throw new Error("INVALID_LINE_TYPE");
  let master: {
    id: string;
    name: string;
    code: string | null;
    description: string | null;
    rate: Prisma.Decimal | null;
    tax: Prisma.Decimal | null;
    hsnSacCode: string | null;
    trackInventory: boolean;
    trackingMode: string;
    unit: { name: string; symbol: string } | null;
  } | null = null;
  if (row.lineType === "PRODUCT" || row.lineType === "MATERIAL") {
    if (!row.sourceId) throw new Error("LINE_SOURCE_REQUIRED");
    const x = await tx.accountProduct.findFirst({
      where: { companyId: a.companyId, id: row.sourceId, isActive: true },
      include: { unit: true },
    });
    if (x)
      master = {
        id: x.id,
        name: x.name,
        code: x.code,
        description: x.description,
        rate: selectMasterRate(purchase, x.salePrice, x.costPrice),
        tax: x.taxRate,
        hsnSacCode: x.hsnCode,
        trackInventory:
          x.trackInventory &&
          itemSettings.stockMaintenance &&
          purchaseInventory,
        trackingMode:
          itemSettings.stockMaintenance && purchaseInventory
            ? x.trackingMode
            : "NONE",
        unit: x.unit,
      };
  }
  if (row.lineType === "SERVICE") {
    if (!row.sourceId) throw new Error("LINE_SOURCE_REQUIRED");
    const x = await tx.accountService.findFirst({
      where: { companyId: a.companyId, id: row.sourceId, isActive: true },
      include: { unit: true },
    });
    if (x)
      master = {
        id: x.id,
        name: x.name,
        code: x.code,
        description: x.description,
        rate: selectMasterRate(purchase, x.sellingRate, x.estimatedCost),
        tax: x.taxRate,
        hsnSacCode: x.sacCode,
        trackInventory: false,
        trackingMode: "NONE",
        unit: x.unit,
      };
  }
  if (row.lineType === "WORK_PACKAGE" || row.lineType === "SUBCONTRACT") {
    if (!row.sourceId) throw new Error("LINE_SOURCE_REQUIRED");
    const x = await tx.workPackage.findFirst({
      where: { companyId: a.companyId, id: row.sourceId, isActive: true },
      include: { unit: true },
    });
    if (x)
      master = {
        id: x.id,
        name: x.name,
        code: x.code,
        description: x.description,
        rate: selectMasterRate(purchase, x.sellingRate, x.estimatedCost),
        tax: null,
        hsnSacCode: null,
        trackInventory: false,
        trackingMode: "NONE",
        unit: x.unit,
      };
  }
  if (row.lineType !== "CUSTOM" && !master)
    throw new Error("INVALID_LINE_SOURCE");
  const quantity = new D(row.quantity),
    rate = new D(row.rate ?? master?.rate ?? 0),
    taxRate = resolveCommercialTaxRate(row.taxRate, master?.tax ?? null),
    discountValue = new D(row.discountValue ?? 0);
  if (quantity.lte(0) || rate.lt(0) || taxRate.lt(0) || discountValue.lt(0))
    throw new Error("INVALID_AMOUNT");
  const baseAmount = quantity.mul(rate).toDecimalPlaces(2),
    discountAmount =
      row.discountType === "PERCENTAGE"
        ? baseAmount.mul(discountValue).div(100).toDecimalPlaces(2)
        : discountValue.toDecimalPlaces(2);
  if (
    discountAmount.gt(baseAmount) ||
    (row.discountType === "PERCENTAGE" && discountValue.gt(100))
  )
    throw new Error("INVALID_DISCOUNT");
  if (
    master?.trackInventory &&
    ["PURCHASE_BILL", "SALES_INVOICE", "CREDIT_NOTE", "DEBIT_NOTE"].includes(
      type,
    )
  ) {
    if (type === "SALES_INVOICE" && !row.warehouseId) {
      const warehouses = await tx.warehouse.findMany({
        where: { companyId: a.companyId, branchId, isActive: true },
        select: { id: true, branchId: true, isDefault: true },
      });
      row.warehouseId = defaultSaleWarehouse(warehouses, branchId)?.id;
    }
    if (!row.warehouseId) throw new Error("WAREHOUSE_REQUIRED_FOR_INVENTORY");
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: row.warehouseId,
        companyId: a.companyId,
        branchId,
        isActive: true,
      },
    });
    if (!warehouse) {
      if (type === "SALES_INVOICE")
        throw new Error("INVALID_INVENTORY_WAREHOUSE");
      throw new AuthorizationError();
    }
    if (master.trackingMode === "BATCH" && !row.batchId)
      throw new Error("BATCH_REQUIRED");
    if (
      master.trackingMode === "SERIAL" &&
      (!row.serialNumberId || !new D(row.quantity).equals(1))
    )
      throw new Error("SERIAL_QUANTITY_MISMATCH");
    if (new D(row.stockReturnQuantity ?? 0).gt(new D(row.quantity)))
      throw new Error("INVALID_RETURN_QUANTITY");
  }
  const enteredAmount = baseAmount.sub(discountAmount);
  let taxableAmount = enteredAmount,
    taxAmount = taxableAmount.mul(taxRate).div(100).toDecimalPlaces(2);
  let sourceTax: null | {
    taxRate: Prisma.Decimal;
    cessRate: Prisma.Decimal;
    hsnSacCode: string | null;
    cgstAmount: Prisma.Decimal;
    sgstAmount: Prisma.Decimal;
    igstAmount: Prisma.Decimal;
    cessAmount: Prisma.Decimal;
  } = null;
  if (["CREDIT_NOTE", "DEBIT_NOTE"].includes(type)) {
    if (!row.sourceCommercialLineId || !sourceDocumentId)
      throw new Error("SOURCE_LINE_REQUIRED");
    const sourceLine = await tx.commercialDocumentLine.findFirst({
      where: {
        id: row.sourceCommercialLineId,
        companyId: a.companyId,
        documentId: sourceDocumentId,
      },
    });
    if (
      !sourceLine ||
      sourceLine.productId !==
        (["PRODUCT", "MATERIAL"].includes(row.lineType) ? master?.id : null) ||
      sourceLine.serviceId !==
        (row.lineType === "SERVICE" ? master?.id : null) ||
      sourceLine.workPackageId !==
        (["WORK_PACKAGE", "SUBCONTRACT"].includes(row.lineType)
          ? master?.id
          : null)
    )
      throw new Error("INVALID_SOURCE_LINE");
    taxableAmount = adjustmentTaxableBasis(
      sourceLine.taxableAmount,
      sourceLine.lineTotal,
      enteredAmount,
      sourceTaxMode ?? "EXCLUSIVE",
    );
    taxAmount = enteredAmount.sub(taxableAmount);
    const used = await tx.commercialDocumentLine.aggregate({
      where: {
        companyId: a.companyId,
        sourceCommercialLineId: sourceLine.id,
        document: { status: "POSTED" },
      },
      _sum: { taxableAmount: true },
    });
    if (
      taxableAmount
        .add(used._sum.taxableAmount ?? 0)
        .gt(sourceLine.taxableAmount)
    )
      throw new Error("ADJUSTMENT_LINE_EXCEEDS_SOURCE");
    sourceTax = {
      taxRate: sourceLine.taxRate,
      cessRate: sourceLine.cessRate,
      hsnSacCode: sourceLine.hsnSacCode,
      cgstAmount: proportionalTaxReversal(
        sourceLine.cgstAmount,
        sourceLine.taxableAmount,
        taxableAmount,
      ),
      sgstAmount: proportionalTaxReversal(
        sourceLine.sgstAmount,
        sourceLine.taxableAmount,
        taxableAmount,
      ),
      igstAmount: proportionalTaxReversal(
        sourceLine.igstAmount,
        sourceLine.taxableAmount,
        taxableAmount,
      ),
      cessAmount: proportionalTaxReversal(
        sourceLine.cessAmount,
        sourceLine.taxableAmount,
        taxableAmount,
      ),
    };
  }
  let servicePeriodDays:number|undefined;
  if(type==="SALES_INVOICE"&&row.sourceId){
    const service=((transactionDefaults as {reminderSettings?:{service?:{enabled?:boolean;selectedItemIds?:string[];periodDays?:number;allowSalePeriodOverride?:boolean}}}|null)?.reminderSettings?.service);
    if(service?.enabled===true&&service.selectedItemIds?.includes(row.sourceId)&&Number.isInteger(service.periodDays)){
      if(row.servicePeriodDays!==undefined&&service.allowSalePeriodOverride!==true)throw new Error("SERVICE_PERIOD_OVERRIDE_DISABLED");
      servicePeriodDays=row.servicePeriodDays??service.periodDays;
      if(servicePeriodDays===undefined||servicePeriodDays<1||servicePeriodDays>3650)throw new Error("INVALID_SERVICE_PERIOD");
    }else if(row.servicePeriodDays!==undefined)throw new Error("INVALID_SERVICE_REMINDER_ITEM");
  }else if(row.servicePeriodDays!==undefined)throw new Error("INVALID_SERVICE_REMINDER_ITEM");
  return {
    companyId: a.companyId,
    servicePeriodDays,
    position,
    lineType: row.lineType,
    productId: ["PRODUCT", "MATERIAL"].includes(row.lineType)
      ? master?.id
      : null,
    serviceId: row.lineType === "SERVICE" ? master?.id : null,
    workPackageId: ["WORK_PACKAGE", "SUBCONTRACT"].includes(row.lineType)
      ? master?.id
      : null,
    itemName: row.itemName ?? master?.name ?? "Custom",
    itemCode: row.itemCode ?? master?.code,
    description: row.description ?? master?.description,
    specification: row.specification,
    unitName: row.unitName ?? master?.unit?.name,
    unitSymbol: row.unitSymbol ?? master?.unit?.symbol,
    quantity,
    rate,
    discountType: row.discountType,
    discountValue: row.discountValue,
    taxRate: sourceTax?.taxRate ?? taxRate,
    cessRate: sourceTax?.cessRate ?? new D(row.cessRate ?? 0),
    sourceCommercialLineId: row.sourceCommercialLineId,
    warehouseId: row.warehouseId,
    batchId: row.batchId,
    serialNumberId: row.serialNumberId,
    stockReturnQuantity: new D(row.stockReturnQuantity ?? 0),
    hsnSacCode: sourceTax?.hsnSacCode ?? master?.hsnSacCode,
    cgstAmount: sourceTax?.cgstAmount,
    sgstAmount: sourceTax?.sgstAmount,
    igstAmount: sourceTax?.igstAmount,
    cessAmount: sourceTax?.cessAmount,
    baseAmount,
    discountAmount,
    taxableAmount,
    taxAmount,
    lineTotal: taxableAmount.add(taxAmount),
  };
}
/** Prisma inherits the composite tenant key from the parent document. */
function nestedSalesInvoiceLine<T extends { companyId: string | null }>(
  line: T,
) {
  const { companyId, ...nestedLine } = line;
  void companyId;
  return nestedLine;
}
export async function createCommercialDocumentForActor(
  actor: Actor,
  raw: unknown,
  transaction?: Prisma.TransactionClient,
) {
  const d = commercialDocumentInput.parse(raw),
    p = policies[d.type];
  await requireAccountModules(actor, ...p.modules);
  assertBranch(actor, d.branchId);
  const [enabled, companyPolicy] = await Promise.all([
    enabledModulesForCompany(actor.companyId),
    db.company.findUniqueOrThrow({
      where: { id: actor.companyId },
      select: { productEdition: true },
    }),
  ]);
  if (!canUsePermission(actor, companyPolicy.productEdition, p.permission))
    throw new AuthorizationError();
  if (p.party === "vendor" && d.type !== "DEBIT_NOTE")
    assertPurchaseProjectSelection(
      d,
      purchaseProjectCapability(
        enabled,
        canUsePermission(
          actor,
          companyPolicy.productEdition,
          "ACCOUNT_PROJECTS",
        ),
      ),
    );
  return inAccountTransaction(transaction,
      async (tx) => {
        const [branch, settings] = await Promise.all([
          tx.branch.findFirst({
            where: {
              companyId: actor.companyId,
              id: d.branchId,
              isActive: true,
            },
          }),
          tx.accountSettings.findUnique({
            where: { companyId: actor.companyId! },
          }),
        ]);
        if (!branch) throw new Error("INVALID_BRANCH");
        const resolvedDefaults=applyTransactionDefaults(d,settings?.transactionDefaults);
        const creationRequestHash = d.idempotencyKey
          ? commercialCreationHash(d)
          : null;
        if (d.idempotencyKey) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`commercial-create:${actor.companyId}:${d.idempotencyKey}`},0))`;
          const existing = await tx.commercialDocument.findUnique({
            where: {
              companyId_creationRequestKey: {
                companyId: actor.companyId,
                creationRequestKey: d.idempotencyKey,
              },
            },
          });
          if (existing) {
            if (existing.creationRequestHash !== creationRequestHash)
              throw new Error("IDEMPOTENCY_KEY_REUSED");
            // Replays still require current Project visibility and module entitlement.
            // Final Project status is readable: replay creates no new business movement.
            const projectIds = new Set<string>();
            if (existing.projectId) projectIds.add(existing.projectId);
            const allocations = await tx.purchaseLineAllocation.findMany({
              where: {
                companyId: actor.companyId,
                projectId: { not: null },
                documentLine: {
                  documentId: {
                    in: [
                      existing.id,
                      ...(existing.sourceDocumentId
                        ? [existing.sourceDocumentId]
                        : []),
                    ],
                  },
                },
              },
              select: { projectId: true },
            });
            for (const allocation of allocations)
              projectIds.add(allocation.projectId!);
            for (const projectId of projectIds)
              await getProjectForActor(actor, projectId);
            return existing;
          }
        }

        if (d.type === "SALES_INVOICE" && d.reverseCharge &&
            !normalizeTransactionPreferences((settings?.transactionDefaults as Record<string,unknown>|null)?.transactionPreferences).reverseCharge)
          throw new Error("REVERSE_CHARGE_DISABLED");
        const party =
          p.party === "customer"
            ? await tx.customer.findFirst({
                where: {
                  companyId: actor.companyId,
                  id: d.partyId,
                  branchId: d.branchId,
                  isActive: true,
                  isAccountCustomer: true,
                },
                select: {
                  id: true,
                  name: true,
                  gstin: true,
                  stateCode: true,
                  address: true,
                },
              })
            : await tx.vendor.findFirst({
                where: {
                  companyId: actor.companyId,
                  id: d.partyId,
                  isActive: true,
                },
                select: {
                  id: true,
                  name: true,
                  gstin: true,
                  stateCode: true,
                  address: true,
                },
              });
        if (!party) throw new Error(`INVALID_${p.party.toUpperCase()}`);
        const postingDate = d.postingDate ?? d.issueDate,
          purchaseFy =
            p.party === "vendor"
              ? await tx.financialYear.findFirst({
                  where: {
                    companyId: actor.companyId,
                    isActive: true,
                    startDate: { lte: postingDate },
                    endDate: { gte: postingDate },
                  },
                  orderBy: { startDate: "desc" },
                })
              : null,
          vendorInvoiceNormalized = d.vendorInvoiceNumber
            ? normalizeVendorInvoiceNumber(d.vendorInvoiceNumber)
            : null;
        if (d.vendorInvoiceNumber && !vendorInvoiceNormalized)
          throw new Error("INVALID_VENDOR_INVOICE_NUMBER");
        if (d.type === "PURCHASE_BILL" && !purchaseFy)
          throw new Error("INVALID_FINANCIAL_YEAR");
        if (
          vendorInvoiceNormalized &&
          purchaseFy &&
          (await tx.commercialDocument.findFirst({
            where: {
              companyId: actor.companyId,
              vendorId: d.partyId,
              purchaseFinancialYearId: purchaseFy.id,
              vendorInvoiceNumberNormalized: vendorInvoiceNormalized,
              status: { not: "CANCELLED" },
            },
          }))
        )
          throw new Error("DUPLICATE_VENDOR_INVOICE");
        const authorizedProject = d.projectId
          ? await authorizeProjectForCommercial(
              actor,
              d.projectId,
              d.branchId,
              p.party === "customer" ? d.partyId : undefined,
              tx,
            )
          : null;
        if (
          d.projectBudgetLineId &&
          !(await tx.projectBudgetLine.findFirst({
            where: {
              id: d.projectBudgetLineId,
              companyId: actor.companyId,
              projectId: authorizedProject?.id,
            },
          }))
        )
          throw new AuthorizationError();
        let source: null | {
          id: string;
          branchId: string;
          partyId: string;
          status: string;
          type: CommercialDocumentType;
          grandTotal: Prisma.Decimal;
          taxableTotal: Prisma.Decimal;
          taxTotal: Prisma.Decimal;
          purchasePurpose: PurchasePurpose | null;
          purchaseClassification: PurchaseClassification | null;
          materialTreatment: MaterialTreatment | null;
          projectBudgetLineId: string | null;
          projectReference: string | null;
          projectId: string | null;
          taxMode: "EXCLUSIVE" | "INCLUSIVE";
          reverseCharge: boolean;
          taxCreditTreatment: "ELIGIBLE" | "INELIGIBLE" | "BLOCKED";
          sellerGstin: string | null;
          partyGstin: string | null;
          stateOfSupplyCode: string | null;
          tdsAmount: Prisma.Decimal;
          tcsAmount: Prisma.Decimal;
        } = null;
        if (d.sourceDocumentId) {
          await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${d.sourceDocumentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
          source = await tx.commercialDocument.findFirst({
            where: { id: d.sourceDocumentId, companyId: actor.companyId },
          });
          if (
            !source ||
            source.status !== "POSTED" ||
            source.branchId !== d.branchId ||
            source.partyId !== d.partyId ||
            (d.type === "CREDIT_NOTE" && source.type !== "SALES_INVOICE") ||
            (d.type === "DEBIT_NOTE" && source.type !== "PURCHASE_BILL")
          )
            throw new Error("INVALID_SOURCE_DOCUMENT");
          const used = await tx.commercialDocument.aggregate({
            where: {
              companyId: actor.companyId,
              sourceDocumentId: source.id,
              status: "POSTED",
            },
            _sum: { grandTotal: true },
          });
          if (new D(used._sum.grandTotal ?? 0).gte(source.grandTotal))
            throw new Error("SOURCE_FULLY_ADJUSTED");
        }
        if (["CREDIT_NOTE", "DEBIT_NOTE"].includes(d.type) && !source)
          throw new Error("SOURCE_DOCUMENT_REQUIRED");
        if (source?.projectId)
          await authorizeProjectForCommercial(
            actor,
            source.projectId,
            d.branchId,
            undefined,
            tx,
          );
        if (d.type === "DEBIT_NOTE" && source) {
          const allocations = await tx.purchaseLineAllocation.findMany({
            where: {
              companyId: actor.companyId,
              projectId: { not: null },
              documentLine: { documentId: source.id },
            },
            select: { projectId: true },
          });
          for (const projectId of new Set(
            allocations.map((row) => row.projectId!),
          ))
            await authorizeProjectForCommercial(
              actor,
              projectId,
              d.branchId,
              undefined,
              tx,
            );
        }
        if (d.sourcePurchaseOrderId) {
          if (d.type !== "PURCHASE_BILL")
            throw new Error("PURCHASE_ORDER_SOURCE_ONLY_FOR_BILL");
          const po = await tx.commercialDocument.findFirst({
            where: {
              id: d.sourcePurchaseOrderId,
              companyId: actor.companyId,
              type: "PURCHASE_ORDER",
              status: "POSTED",
            },
          });
          if (
            !po ||
            po.branchId !== d.branchId ||
            po.vendorId !== d.partyId ||
            po.projectId !== (d.projectId ?? null)
          )
            throw new Error("INVALID_SOURCE_PURCHASE_ORDER");
        }
        const rawLines = await Promise.all(
            d.lines.map((x, i) =>
              snapshotLine(
                tx,
                actor,
                d.type,
                x,
                i,
                d.branchId,
                d.sourceDocumentId,
                source?.taxMode,
                resolveItemSettings(settings?.itemSettings),
                p.party !== "vendor" ||
                  d.purchasePurpose === "INVENTORY_SALES" ||
                  d.purchasePurpose === "PROJECT" ||
                  (d.purchasePurpose === "MIXED" &&
                    !!x.purchaseAllocations?.some(
                      (row) =>
                        row.allocationType === "INVENTORY" ||
                        row.allocationType === "PROJECT",
                    )),
                settings?.transactionDefaults??undefined,
              ),
            ),
          ),
          calculatedLines = rawLines.map((line) => {
            const tax = line.sourceCommercialLineId
              ? {
                  taxable: line.taxableAmount,
                  cgst: line.cgstAmount ?? new D(0),
                  sgst: line.sgstAmount ?? new D(0),
                  igst: line.igstAmount ?? new D(0),
                  cess: line.cessAmount ?? new D(0),
                  totalTax: (line.cgstAmount ?? new D(0))
                    .add(line.sgstAmount ?? 0)
                    .add(line.igstAmount ?? 0)
                    .add(line.cessAmount ?? 0),
                  grandTotal: line.taxableAmount
                    .add(line.cgstAmount ?? 0)
                    .add(line.sgstAmount ?? 0)
                    .add(line.igstAmount ?? 0)
                    .add(line.cessAmount ?? 0),
                }
              : calculateTax({
                  amount: line.taxableAmount,
                  taxRate: line.taxRate,
                  cessRate: line.cessRate,
                  taxMode: d.taxMode,
                  sellerStateCode: branch.gstStateCode ?? null,
                  stateOfSupplyCode: d.stateOfSupplyCode ?? party.stateCode,
                  reverseCharge: d.reverseCharge,
                  composition: settings?.compositionEnabled ?? false,
                  itcEligible: d.taxCreditTreatment === "ELIGIBLE",
                });
            return {
              ...line,
              taxableAmount: tax.taxable,
              taxAmount: tax.totalTax,
              lineTotal: tax.grandTotal,
              cgstAmount: tax.cgst,
              sgstAmount: tax.sgst,
              igstAmount: tax.igst,
              cessAmount: tax.cess,
            };
          }),
          lines = calculatedLines.map((line, i) => {
            if (p.party !== "vendor" || d.type === "DEBIT_NOTE") return line;
            const allocations = buildPurchaseAllocations({
              purpose: d.purchasePurpose!,
              treatment: d.materialTreatment,
              quantity: line.quantity,
              money: {
                baseAmount: line.baseAmount,
                discountAmount: line.discountAmount,
                taxableAmount: line.taxableAmount,
                taxAmount: line.taxAmount,
                cessAmount: line.cessAmount,
                lineTotal: line.lineTotal,
              },
              requests: d.lines[i].purchaseAllocations as
                PurchaseAllocationRequest[] | undefined,
              documentProjectId: d.projectId,
              documentBudgetLineId: d.projectBudgetLineId,
              warehouseId: line.warehouseId,
            });
            return {
              ...line,
              purchaseAllocations: {
                create: allocations,
              },
            };
          }),
          subtotal = lines.reduce((n, x) => n.add(x.baseAmount), new D(0)),
          discountTotal = lines.reduce(
            (n, x) => n.add(x.discountAmount),
            new D(0),
          ),
          taxableTotal = lines.reduce(
            (n, x) => n.add(x.taxableAmount),
            new D(0),
          ),
          cgstTotal = lines.reduce((n, x) => n.add(x.cgstAmount), new D(0)),
          sgstTotal = lines.reduce((n, x) => n.add(x.sgstAmount), new D(0)),
          igstTotal = lines.reduce((n, x) => n.add(x.igstAmount), new D(0)),
          cessTotal = lines.reduce((n, x) => n.add(x.cessAmount), new D(0)),
          freightAmount = new D(d.freightAmount ?? 0).toDecimalPlaces(2),
          otherChargesAmount = new D(d.otherChargesAmount ?? 0).toDecimalPlaces(
            2,
          ),
          roundOffAmount = d.roundOffAmount===undefined&&d.type==="SALES_INVOICE"?defaultTransactionRoundOff(taxableTotal.add(d.reverseCharge?0:cgstTotal.add(sgstTotal).add(igstTotal).add(cessTotal)).add(freightAmount).add(otherChargesAmount).add(taxableTotal.mul(d.tcsRate??0).div(100).toDecimalPlaces(2)),settings?.transactionDefaults):new D(d.roundOffAmount ?? 0).toDecimalPlaces(2);
        if (
          freightAmount.lt(0) ||
          otherChargesAmount.lt(0) ||
          roundOffAmount.abs().gt(transactionRoundingLimit(settings?.transactionDefaults))
        )
          throw new Error("INVALID_PURCHASE_CHARGES");
        const taxTotal = cgstTotal.add(sgstTotal).add(igstTotal).add(cessTotal),
          tdsAmount = source
            ? proportionalTaxReversal(
                source.tdsAmount,
                source.taxableTotal,
                taxableTotal,
              )
            : taxableTotal
                .mul(d.tdsRate ?? 0)
                .div(100)
                .toDecimalPlaces(2),
          tcsAmount = source
            ? proportionalTaxReversal(
                source.tcsAmount,
                source.taxableTotal,
                taxableTotal,
              )
            : taxableTotal
                .mul(d.tcsRate ?? 0)
                .div(100)
                .toDecimalPlaces(2),
          grandTotal = taxableTotal
            .add(taxTotal)
            .add(tcsAmount)
            .add(freightAmount)
            .add(otherChargesAmount)
            .add(roundOffAmount);
        for (const line of lines) {
          const rows =
            (
              line as typeof line & {
                purchaseAllocations?: {
                  create: Array<{
                    allocationType: string;
                    projectId?: string;
                    projectBudgetLineId?: string;
                    warehouseId?: string;
                  }>;
                };
              }
            ).purchaseAllocations?.create ?? [];
          for (const allocation of rows) {
            if (allocation.allocationType === "INVENTORY") {
              if (!line.productId)
                throw new Error("SERVICE_INVENTORY_ALLOCATION_NOT_ALLOWED");
              if (
                !(await tx.warehouse.findFirst({
                  where: {
                    id: allocation.warehouseId,
                    companyId: actor.companyId,
                    branchId: d.branchId,
                    isActive: true,
                  },
                }))
              )
                throw new AuthorizationError();
            }
            if (allocation.allocationType === "PROJECT") {
              if (
                !purchaseProjectCapability(
                  enabled,
                  canUsePermission(
                    actor,
                    companyPolicy.productEdition,
                    "ACCOUNT_PROJECTS",
                  ),
                )
              )
                throw new AuthorizationError();
              await authorizeProjectForCommercial(
                actor,
                allocation.projectId!,
                d.branchId,
                undefined,
                tx,
              );
              if (
                allocation.projectBudgetLineId &&
                !(await tx.projectBudgetLine.findFirst({
                  where: {
                    id: allocation.projectBudgetLineId,
                    companyId: actor.companyId,
                    projectId: allocation.projectId,
                  },
                }))
              )
                throw new AuthorizationError();
            }
          }
        }
        if (d.sourcePurchaseOrderId) {
          const po = await tx.commercialDocument.findFirst({
            where: {
              id: d.sourcePurchaseOrderId,
              companyId: actor.companyId,
              type: "PURCHASE_ORDER",
              status: "POSTED",
            },
          });
          if (!po) throw new Error("INVALID_SOURCE_PURCHASE_ORDER");
          const used = await tx.commercialDocument.aggregate({
            where: {
              companyId: actor.companyId,
              sourcePurchaseOrderId: po.id,
              type: "PURCHASE_BILL",
              status: { not: "CANCELLED" },
            },
            _sum: { taxableTotal: true },
          });
          if (
            new D(used._sum.taxableTotal ?? 0)
              .add(taxableTotal)
              .gt(po.taxableTotal)
          )
            throw new Error("PURCHASE_ORDER_OVERBILLED");
        }
        if (source) {
          const used = await tx.commercialDocument.aggregate({
            where: {
              companyId: actor.companyId,
              sourceDocumentId: source.id,
              status: "POSTED",
            },
            _sum: { grandTotal: true },
          });
          if (grandTotal.add(used._sum.grandTotal ?? 0).gt(source.grandTotal))
            throw new Error("ADJUSTMENT_EXCEEDS_SOURCE");
        }
        if (
          d.documentNumber &&
          (await tx.commercialDocument.findFirst({
            where: {
              companyId: actor.companyId,
              branchId: d.branchId,
              type: d.type,
              documentNumber: d.documentNumber,
            },
          }))
        )
          throw new Error("DUPLICATE_DOCUMENT_NUMBER");
        const documentNumber =
            d.documentNumber ??
            (await allocateDocumentNumberInTx(tx, {
              companyId: actor.companyId,
              branchId: d.branchId,
              seriesKey: d.type,
              defaults:
                d.type === "SALES_INVOICE"
                  ? SALES_INVOICE_NUMBERING_DEFAULTS
                  : { prefix: p.prefix, padding: 6 },
            })),
          document = await tx.commercialDocument.create({
            data: {
              creationRequestKey: d.idempotencyKey,
              creationRequestHash,
              companyId: actor.companyId,
              branchId: d.branchId,
              type: d.type,
              documentNumber,
              customerId: p.party === "customer" ? party.id : null,
              vendorId: p.party === "vendor" ? party.id : null,
              partyId: party.id,
              partyName: party.name,
              billingName: d.billingName || null,
              customerPoNumber: d.customerPoNumber || null,
              customerPoDate: d.customerPoDate,
              transactionTime: d.transactionTime,
              ewayBillNumber: d.ewayBillNumber,
              sourceDocumentId: d.sourceDocumentId,
              sourcePurchaseOrderId: d.sourcePurchaseOrderId,
              purchasePurpose:
                d.type === "DEBIT_NOTE"
                  ? source?.purchasePurpose
                  : d.purchasePurpose,
              purchaseClassification:
                d.type === "DEBIT_NOTE"
                  ? source?.purchaseClassification
                  : d.purchaseClassification,
              materialTreatment:
                d.type === "DEBIT_NOTE"
                  ? source?.materialTreatment
                  : d.materialTreatment,
              projectBudgetLineId:
                d.type === "DEBIT_NOTE"
                  ? source?.projectBudgetLineId
                  : d.projectBudgetLineId,
              projectId: ["CREDIT_NOTE", "DEBIT_NOTE"].includes(d.type)
                ? source?.projectId
                : d.projectId,
              projectReference: ["CREDIT_NOTE", "DEBIT_NOTE"].includes(d.type)
                ? source?.projectReference
                : authorizedProject
                  ? `${authorizedProject.projectNumber} - ${authorizedProject.name}`
                  : d.projectReference,
              vendorInvoiceNumber: d.vendorInvoiceNumber,
              vendorInvoiceNumberNormalized: vendorInvoiceNormalized,
              vendorInvoiceDate: d.vendorInvoiceDate,
              postingDate,
              paymentTerms: d.paymentTerms,
              partyAddress: party.address,
              grnReference: d.grnReference,
              purchaseLocation: d.purchaseLocation,
              purchaseFinancialYearId: purchaseFy?.id,
              freightAmount,
              otherChargesAmount,
              roundOffAmount,
              issueDate: d.issueDate,
              dueDate: resolvedDefaults.dueDate,
              notes: resolvedDefaults.notes,
              sellerGstin: source?.sellerGstin ?? branch.gstin,
              partyGstin: source?.partyGstin ?? party.gstin,
              stateOfSupplyCode:
                source?.stateOfSupplyCode ??
                d.stateOfSupplyCode ??
                party.stateCode,
              taxMode: source?.taxMode ?? d.taxMode,
              reverseCharge: source?.reverseCharge ?? d.reverseCharge,
              taxCreditTreatment:
                source?.taxCreditTreatment ?? d.taxCreditTreatment,
              cgstTotal,
              sgstTotal,
              igstTotal,
              cessTotal,
              tdsAmount,
              tcsAmount,
              subtotal,
              discountTotal,
              taxableTotal,
              taxTotal,
              grandTotal,
              payableAmount: ((source?.reverseCharge ?? d.reverseCharge)
                ? grandTotal.sub(taxTotal)
                : grandTotal
              ).sub(tdsAmount),
              balanceDue: ((source?.reverseCharge ?? d.reverseCharge)
                ? grandTotal.sub(taxTotal)
                : grandTotal
              ).sub(tdsAmount),
              createdById: actor.id,
              lines: {
                create: lines.map(nestedSalesInvoiceLine),
              },
            },
          });
        if(d.type==="SALES_INVOICE"||d.type==="PURCHASE_BILL")await saveCustomFieldValuesInTx(tx,actor.companyId,d.type,document.id,d.customFields??{});
        await audit(
          tx,
          actor,
          "DOCUMENT_CREATED",
          "COMMERCIAL_DOCUMENT",
          document.id,
          { type: d.type },
        );
        return document;
      },
  );
}
export async function finalizeNonFinancialDocument(raw: unknown) {
  const { documentId } = z
      .object({ documentId: z.string().uuid() })
      .strict()
      .parse(raw),
    actor = (await requirePermissionForMutation(
      "ACCOUNT_PURCHASE_ENTRY",
    )) as Actor;
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
      const doc = await tx.commercialDocument.findFirst({
        where: { id: documentId, companyId: actor.companyId },
      });
      if (!doc) throw new AuthorizationError();
      assertBranch(actor, doc.branchId);
      const policy = policies[doc.type];
      await requireAccountModules(actor, ...policy.modules);
      if (policy.financial || doc.type !== "PURCHASE_ORDER")
        throw new Error("DOCUMENT_NOT_FINALIZABLE");
      if (doc.status === "POSTED") return doc;
      if (doc.status !== "DRAFT" || doc.journalEntryId)
        throw new Error("DOCUMENT_NOT_FINALIZABLE");
      const signature = await tx.authorizedSignatureVersion.findFirst({
          where: { companyId: actor.companyId, isCurrent: true },
          orderBy: { createdAt: "desc" },
        }),
        updated = await tx.commercialDocument.update({
          where: { id: doc.id },
          data: { status: "POSTED", signatureVersionId: signature?.id },
        });
      await tx.accountOperationalAudit.create({
        data: {
          companyId: actor.companyId,
          actorUserId: actor.id,
          eventType: "PURCHASE_ORDER_FINALIZED",
          entityType: "COMMERCIAL_DOCUMENT",
          entityId: doc.id,
        },
      });
      return updated;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
async function purchaseInventoryFromAllocationsInTx(
  tx: Prisma.TransactionClient,
  actor: Actor,
  doc: Prisma.CommercialDocumentGetPayload<{
    include: { lines: { include: { purchaseAllocations: true } } };
  }>,
) {
  let inventoryPurchase = new D(0),
    trackedTaxable = new D(0),
    trackedTax = new D(0);
  for (const line of doc.lines) {
    if (!line.productId) continue;
    const product = await tx.accountProduct.findFirst({
      where: {
        id: line.productId,
        companyId: actor.companyId,
        trackInventory: true,
        isActive: true,
      },
    });
    if (!product) continue;
    for (const allocation of line.purchaseAllocations) {
      if (allocation.allocationType !== "INVENTORY" || !allocation.warehouseId)
        continue;
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: allocation.warehouseId,
          companyId: actor.companyId,
          branchId: doc.branchId,
          isActive: true,
        },
      });
      if (!warehouse) throw new Error("INVALID_INVENTORY_WAREHOUSE");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${warehouse.id}:${product.id}`}))`;
      if (
        line.batchId &&
        !(await tx.inventoryBatch.findFirst({
          where: {
            id: line.batchId,
            companyId: actor.companyId,
            productId: product.id,
          },
        }))
      )
        throw new Error("INVALID_INVENTORY_BATCH");
      if (line.serialNumberId) {
        if (!allocation.quantity.equals(1))
          throw new Error("SERIAL_QUANTITY_MISMATCH");
        const serial = await tx.inventorySerialNumber.findFirst({
          where: {
            id: line.serialNumberId,
            companyId: actor.companyId,
            productId: product.id,
          },
        });
        if (!serial) throw new Error("INVALID_INVENTORY_SERIAL");
        const prior = await tx.stockMovement.aggregate({
          where: {
            companyId: actor.companyId,
            warehouseId: warehouse.id,
            productId: product.id,
            serialNumberId: line.serialNumberId,
          },
          _sum: { quantity: true },
        });
        if (new D(prior._sum.quantity ?? 0).gt(0))
          throw new Error("SERIAL_ALREADY_IN_STOCK");
      }
      let unitCost = allocation.taxableAmount.div(allocation.quantity);
      if (doc.taxCreditTreatment !== "ELIGIBLE")
        unitCost = unitCost.add(allocation.taxAmount.div(allocation.quantity));
      const totalCost = allocation.quantity.mul(unitCost).toDecimalPlaces(2);
      await tx.stockMovement.create({
        data: {
          companyId: actor.companyId!,
          branchId: doc.branchId,
          warehouseId: warehouse.id,
          productId: product.id,
          movementType: "PURCHASE",
          quantity: allocation.quantity,
          unitCost,
          totalCost,
          sourceType: doc.type,
          sourceId: doc.id,
          sourceLineId: allocation.id,
          batchId: line.batchId,
          serialNumberId: line.serialNumberId,
          movementDate: doc.issueDate,
          createdById: actor.id,
        },
      });
      inventoryPurchase = inventoryPurchase.add(totalCost);
      trackedTaxable = trackedTaxable.add(allocation.taxableAmount);
      trackedTax = trackedTax.add(allocation.taxAmount);
    }
  }
  return {
    inventoryPurchase: inventoryPurchase.toDecimalPlaces(2),
    nonInventoryPurchase: doc.taxableTotal
      .sub(trackedTaxable)
      .add(
        doc.taxCreditTreatment === "ELIGIBLE"
          ? 0
          : doc.taxTotal.sub(trackedTax),
      ),
    cogs: new D(0),
    returnCost: new D(0),
  };
}
async function commercialInventoryInTx(
  tx: Prisma.TransactionClient,
  actor: Actor,
  doc: Prisma.CommercialDocumentGetPayload<{
    include: { lines: { include: { purchaseAllocations: true } } };
  }>,
) {
  if (doc.type === "PURCHASE_BILL")
    return purchaseInventoryFromAllocationsInTx(tx, actor, doc);
  const candidates = doc.lines.filter(
    (line) => line.productId && line.warehouseId,
  );
  if (!candidates.length)
    return {
      inventoryPurchase: new D(0),
      nonInventoryPurchase: doc.taxableTotal.add(
        doc.taxCreditTreatment === "ELIGIBLE" ? 0 : doc.taxTotal,
      ),
      cogs: new D(0),
      returnCost: new D(0),
    };
  const products = await tx.accountProduct.findMany({
      where: {
        companyId: actor.companyId,
        id: { in: candidates.map((x) => x.productId!) },
        trackInventory: true,
        isActive: true,
      },
    }),
    byId = new Map(products.map((x) => [x.id, x]));
  const trackedTaxable = candidates.reduce(
      (n, x) => n.add(x.taxableAmount),
      new D(0),
    ),
    trackedTax = candidates.reduce((n, x) => n.add(x.taxAmount), new D(0));
  const inventoryPurchase = new D(0);
  let cogs = new D(0),
    returnCost = new D(0);
  for (const line of candidates) {
    const product = byId.get(line.productId!);
    if (!product) continue;
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: line.warehouseId!,
        companyId: actor.companyId,
        branchId: doc.branchId,
        isActive: true,
      },
    });
    if (!warehouse) throw new Error("INVALID_INVENTORY_WAREHOUSE");
    await tx.$queryRaw`WITH "stock_lock" AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${warehouse.id}:${product.id}`}))) SELECT 1::int AS "locked" FROM "stock_lock"`;
    if (line.batchId) {
      const batch = await tx.inventoryBatch.findFirst({
        where: {
          id: line.batchId,
          companyId: actor.companyId,
          productId: product.id,
        },
      });
      if (!batch) throw new Error("INVALID_INVENTORY_BATCH");
      if (
        (doc.type === "SALES_INVOICE" || doc.type === "DEBIT_NOTE") &&
        batch.expiryDate &&
        batch.expiryDate < doc.issueDate
      )
        throw new Error("EXPIRED_STOCK");
    }
    if (line.serialNumberId) {
      const serial = await tx.inventorySerialNumber.findFirst({
        where: {
          id: line.serialNumberId,
          companyId: actor.companyId,
          productId: product.id,
        },
      });
      if (!serial) throw new Error("INVALID_INVENTORY_SERIAL");
      if (
        (doc.type === "SALES_INVOICE" || doc.type === "DEBIT_NOTE") &&
        serial.expiryDate &&
        serial.expiryDate < doc.issueDate
      )
        throw new Error("EXPIRED_STOCK");
    }
    const prior = await tx.stockMovement.findMany({
        where: {
          companyId: actor.companyId,
          warehouseId: warehouse.id,
          productId: product.id,
          ...(line.batchId ? { batchId: line.batchId } : {}),
          ...(line.serialNumberId
            ? { serialNumberId: line.serialNumberId }
            : {}),
        },
        orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
      }),
      valuation = stockValuation(prior),
      physicalReturn = ["CREDIT_NOTE", "DEBIT_NOTE"].includes(doc.type)
        ? line.stockReturnQuantity
        : new D(0),
      quantity = ["CREDIT_NOTE", "DEBIT_NOTE"].includes(doc.type)
        ? physicalReturn
        : line.quantity;
    if (quantity.lte(0)) continue;
    let movementType: "PURCHASE" | "SALE" | "PURCHASE_RETURN" | "SALES_RETURN",
      unitCost: Prisma.Decimal;
    if (doc.type === "SALES_INVOICE") {
      movementType = "SALE";
      unitCost = valuation.quantity.gt(0) ? valuation.stockValue.div(valuation.quantity) : valuation.averageUnitCost;
      cogs = cogs.add(quantity.mul(unitCost));
    } else if (doc.type === "DEBIT_NOTE") {
      movementType = "PURCHASE_RETURN";
      unitCost = valuation.quantity.gt(0) ? valuation.stockValue.div(valuation.quantity) : valuation.averageUnitCost;
      returnCost = returnCost.add(quantity.mul(unitCost));
    } else {
      movementType = "SALES_RETURN";
      // Reverse the original cost, even after a serial or batch is sold out.
      const sourceSale = prior.find(movement => movement.movementType === "SALE" && movement.sourceId === doc.sourceDocumentId && movement.sourceLineId === line.sourceCommercialLineId);
      unitCost = sourceSale?.unitCost ?? (valuation.quantity.gt(0) ? valuation.stockValue.div(valuation.quantity) : valuation.averageUnitCost);
      returnCost = returnCost.add(quantity.mul(unitCost));
    }
    if (
      ["SALE", "PURCHASE_RETURN"].includes(movementType) &&
      !(
        movementType === "SALE" &&
        product.trackingMode === "NONE" &&
        !line.batchId &&
        !line.serialNumberId
      )
    ) {
      const settings = await tx.accountSettings.findUnique({
        where: { companyId: actor.companyId! },
      });
      if (
        !(settings?.negativeStockAllowed ?? false) &&
        valuation.quantity.lt(quantity)
      )
        throw new Error("INSUFFICIENT_STOCK");
    }
    if (line.serialNumberId) {
      const serialQty = prior.reduce(
        (n, x) => n.add(signedQuantity(x.movementType, x.quantity)),
        new D(0),
      );
      if (
        ["PURCHASE", "SALES_RETURN"].includes(movementType) &&
        serialQty.gt(0)
      )
        throw new Error("SERIAL_ALREADY_IN_STOCK");
      if (
        ["SALE", "PURCHASE_RETURN"].includes(movementType) &&
        !serialQty.equals(1)
      )
        throw new Error("SERIAL_NOT_AVAILABLE");
    }
    await tx.stockMovement.create({
      data: {
        companyId: actor.companyId!,
        branchId: doc.branchId,
        warehouseId: warehouse.id,
        productId: product.id,
        movementType,
        quantity,
        unitCost,
        totalCost: quantity.mul(unitCost).toDecimalPlaces(2),
        sourceType: doc.type,
        sourceId: doc.id,
        sourceLineId: line.id,
        batchId: line.batchId,
        serialNumberId: line.serialNumberId,
        movementDate: doc.issueDate,
        createdById: actor.id,
      },
    });
  }
  const nonInventoryPurchase = doc.taxableTotal
    .sub(trackedTaxable)
    .add(
      doc.taxCreditTreatment === "ELIGIBLE" ? 0 : doc.taxTotal.sub(trackedTax),
    );
  return {
    inventoryPurchase: inventoryPurchase.toDecimalPlaces(2),
    nonInventoryPurchase: Prisma.Decimal.max(0, nonInventoryPurchase),
    cogs: cogs.toDecimalPlaces(2),
    returnCost: returnCost.toDecimalPlaces(2),
  };
}
type ProjectPurchasePostingDocument = Prisma.CommercialDocumentGetPayload<{
  include: { lines: { include: { purchaseAllocations: true } } };
}>;
/** New physical Project purchases always touch Inventory before the linked Project issue. */
export async function postProjectPurchaseMaterialsInTx(
  tx: Prisma.TransactionClient,
  actor: Actor,
  doc: ProjectPurchasePostingDocument,
) {
  if (
    doc.type !== "PURCHASE_BILL" ||
    !["PROJECT", "MIXED"].includes(doc.purchasePurpose ?? "")
  )
    return [];
  const created = [];
  for (const line of doc.lines) {
    if (!line.productId) continue;
    const product = await tx.accountProduct.findFirst({
      where: {
        id: line.productId,
        companyId: actor.companyId,
        trackInventory: true,
        isActive: true,
      },
    });
    if (!product) continue;
    for (const allocation of line.purchaseAllocations) {
      if (allocation.allocationType !== "PROJECT" || !allocation.projectId)
        continue;
      if (!(allocation.warehouseId ?? line.warehouseId))
        throw new Error("PROJECT_PURCHASE_WAREHOUSE_REQUIRED");
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: allocation.warehouseId ?? line.warehouseId!,
          companyId: actor.companyId,
          branchId: doc.branchId,
          isActive: true,
        },
      });
      if (!warehouse) throw new Error("INVALID_INVENTORY_WAREHOUSE");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${actor.companyId}:${warehouse.id}:${line.productId}`}))`;
      if (
        line.batchId &&
        !(await tx.inventoryBatch.findFirst({
          where: {
            id: line.batchId,
            companyId: actor.companyId,
            productId: line.productId,
          },
        }))
      )
        throw new Error("INVALID_INVENTORY_BATCH");
      if (line.serialNumberId) {
        if (
          !allocation.quantity.equals(1) ||
          !(await tx.inventorySerialNumber.findFirst({
            where: {
              id: line.serialNumberId,
              companyId: actor.companyId,
              productId: line.productId,
            },
          }))
        )
          throw new Error("INVALID_INVENTORY_SERIAL");
        const prior = await tx.stockMovement.aggregate({
          where: {
            companyId: actor.companyId,
            warehouseId: warehouse.id,
            productId: line.productId,
            serialNumberId: line.serialNumberId,
          },
          _sum: { quantity: true },
        });
        if (new D(prior._sum.quantity ?? 0).gt(0))
          throw new Error("SERIAL_ALREADY_IN_STOCK");
      }
      const unitCost = allocation.taxableAmount
          .add(doc.taxCreditTreatment === "ELIGIBLE" ? 0 : allocation.taxAmount)
          .div(allocation.quantity),
        totalCost = allocation.quantity.mul(unitCost).toDecimalPlaces(2);
      await tx.stockMovement.create({
        data: {
          companyId: actor.companyId!,
          branchId: doc.branchId,
          warehouseId: warehouse.id,
          productId: line.productId,
          movementType: "PURCHASE",
          quantity: allocation.quantity,
          unitCost,
          totalCost,
          sourceType: "PURCHASE_BILL",
          sourceId: doc.id,
          sourceLineId: allocation.id,
          batchId: line.batchId,
          serialNumberId: line.serialNumberId,
          movementDate: doc.issueDate,
          createdById: actor.id,
        },
      });
      const movement = await tx.projectMaterialMovement.create({
        data: {
          companyId: actor.companyId!,
          branchId: doc.branchId,
          projectId: allocation.projectId,
          movementType: "INVENTORY_ISSUE_TO_PROJECT",
          purchaseDocumentId: doc.id,
          purchaseLineId: line.id,
          purchaseAllocationId: allocation.id,
          productId: line.productId,
          warehouseId: warehouse.id,
          batchId: line.batchId,
          serialNumberId: line.serialNumberId,
          quantity: allocation.quantity,
          originalUnitCost: unitCost,
          totalCost,
          movementDate: doc.issueDate,
          projectBudgetLineId: allocation.projectBudgetLineId,
          createdById: actor.id,
          idempotencyKey: `purchase:${doc.id}:${allocation.id}:project-issue`,
        },
      });
      await tx.stockMovement.create({
        data: {
          companyId: actor.companyId!,
          branchId: doc.branchId,
          warehouseId: warehouse.id,
          productId: line.productId,
          movementType: "TRANSFER_OUT",
          quantity: allocation.quantity,
          unitCost,
          totalCost,
          sourceType: "PROJECT_MATERIAL_ISSUE",
          sourceId: movement.id,
          sourceLineId: allocation.id,
          batchId: line.batchId,
          serialNumberId: line.serialNumberId,
          movementDate: doc.issueDate,
          createdById: actor.id,
        },
      });
      await tx.projectAuditEvent.create({
        data: {
          companyId: actor.companyId!,
          projectId: allocation.projectId,
          actorUserId: actor.id,
          eventType: "PROJECT_MATERIAL_POSTED",
          metadata: {
            movementId: movement.id,
            movementType: movement.movementType,
            purchaseDocumentId: doc.id,
            purchaseAllocationId: allocation.id,
            quantity: allocation.quantity.toString(),
            totalCost: totalCost.toString(),
          },
        },
      });
      created.push(movement);
    }
  }
  return created;
}
export async function postCommercialDocumentForActor(
  actor: Actor,
  raw: unknown,
  transaction?: Prisma.TransactionClient,
) {
  const { documentId } = z
    .object({ documentId: z.string().uuid() })
    .strict()
    .parse(raw);
  financialRole(actor);
  return inAccountTransaction(transaction,
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
        const doc = await tx.commercialDocument.findFirst({
          where: { id: documentId, companyId: actor.companyId },
          include: { lines: { include: { purchaseAllocations: true } } },
        });
        if (!doc) throw new Error("NOT_FOUND");
        assertBranch(actor, doc.branchId);
        const p = policies[doc.type];
        await requireAccountModules(actor, ...p.modules);
        if (doc.projectId)
          await authorizeProjectForCommercial(
            actor,
            doc.projectId,
            doc.branchId,
            doc.customerId ?? undefined,
            tx,
          );
        for (const allocation of doc.lines.flatMap(
          (line) => line.purchaseAllocations,
        ))
          if (allocation.projectId)
            await authorizeProjectForCommercial(
              actor,
              allocation.projectId,
              doc.branchId,
              undefined,
              tx,
            );
        if (doc.type === "DEBIT_NOTE" && doc.sourceDocumentId) {
          // A mixed purchase can have Project allocations without a header Project.
          // Entitlement/scoping also applies to already-posted request replays.
          const allocations = await tx.purchaseLineAllocation.findMany({
            where: {
              companyId: actor.companyId,
              projectId: { not: null },
              documentLine: { documentId: doc.sourceDocumentId },
            },
            select: { projectId: true },
          });
          for (const projectId of new Set(
            allocations.map((row) => row.projectId!),
          ))
            await authorizeProjectForCommercial(
              actor,
              projectId,
              doc.branchId,
              undefined,
              tx,
            );
        }
        if (doc.status === "POSTED" && doc.journalEntryId)
          return tx.journalEntry.findFirstOrThrow({
            where: { id: doc.journalEntryId, companyId: actor.companyId },
          });
        if (doc.status !== "DRAFT" || !p.financial)
          throw new Error("DOCUMENT_NOT_POSTABLE");
        let source: Prisma.CommercialDocumentGetPayload<{
            include: { lines: { include: { purchaseAllocations: true } } };
          }> | null = null,
          debitSourceClassification: PurchaseClassification | null = null;
        if (doc.type === "CREDIT_NOTE" || doc.type === "DEBIT_NOTE") {
          if (!doc.sourceDocumentId)
            throw new Error("SOURCE_DOCUMENT_REQUIRED");
          await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${doc.sourceDocumentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
          source = await tx.commercialDocument.findFirst({
            where: {
              id: doc.sourceDocumentId,
              companyId: actor.companyId,
              type:
                doc.type === "CREDIT_NOTE" ? "SALES_INVOICE" : "PURCHASE_BILL",
              status: "POSTED",
            },
            include: { lines: { include: { purchaseAllocations: true } } },
          });
          if (
            !source ||
            source.branchId !== doc.branchId ||
            source.customerId !== doc.customerId ||
            source.vendorId !== doc.vendorId
          )
            throw new Error("INVALID_SOURCE_DOCUMENT");
          const used = await tx.commercialDocument.aggregate({
              where: {
                companyId: actor.companyId,
                sourceDocumentId: source.id,
                status: "POSTED",
                type: doc.type,
                id: { not: doc.id },
              },
              _sum: { taxableTotal: true, taxTotal: true, grandTotal: true },
            }),
            outstanding = await documentOutstandingInTx(
              tx,
              actor.companyId!,
              source.id,
            );
          assertAdjustmentWithinSource(
            doc,
            source,
            {
              taxableTotal: new D(used._sum.taxableTotal ?? 0),
              taxTotal: new D(used._sum.taxTotal ?? 0),
              grandTotal: new D(used._sum.grandTotal ?? 0),
            },
            outstanding.outstanding,
          );
          debitSourceClassification = source.purchaseClassification;
        }
        const projectReturns =
          doc.type === "DEBIT_NOTE" && source
            ? await projectPurchaseReturnsInTx(tx, actor, doc, source)
            : {
                projectReturnCost: new D(0),
                projectReturnQuantities: new Map<string, Prisma.Decimal>(),
              };
        const inventoryDocument = projectReturns.projectReturnQuantities.size
          ? {
              ...doc,
              lines: doc.lines.map((line) => ({
                ...line,
                stockReturnQuantity: line.stockReturnQuantity.sub(
                  projectReturns.projectReturnQuantities.get(line.id) ?? 0,
                ),
              })),
            }
          : doc;
        const inventory = await commercialInventoryInTx(
            tx,
            actor,
            inventoryDocument,
          ),
          sale = doc.type === "SALES_INVOICE" || doc.type === "CREDIT_NOTE",
          classification = purchaseClassificationForPosting(
            doc.type,
            doc.purchaseClassification,
            debitSourceClassification,
          ),
          purchaseCounter =
            classification === "GENERAL_EXPENSES"
              ? "GENERAL_EXPENSES"
              : classification === "FIXED_ASSET"
                ? "FIXED_ASSETS"
                : "PURCHASE_COST",
          purchaseRows =
            doc.type === "PURCHASE_BILL"
              ? doc.lines.flatMap((line) =>
                  line.purchaseAllocations.map((a) => ({
                    allocationType: a.allocationType,
                    taxableAmount: a.taxableAmount,
                    taxAmount: a.taxAmount,
                  })),
                )
              : [],
          purchaseBuckets = purchasePostingBuckets(
            purchaseRows,
            doc.taxCreditTreatment === "ELIGIBLE",
          ),
          keys = [
            sale ? "ACCOUNTS_RECEIVABLE" : "ACCOUNTS_PAYABLE",
            sale ? "SALES_INCOME" : purchaseCounter,
            "CGST_PAYABLE",
            "SGST_PAYABLE",
            "IGST_PAYABLE",
            "CESS_PAYABLE",
            "CGST_ITC",
            "SGST_ITC",
            "IGST_ITC",
            "CESS_ITC",
            "TDS_PAYABLE",
            "TCS_PAYABLE",
            "INVENTORY_ASSET",
            "COGS",
            ...(doc.type === "PURCHASE_BILL"
              ? ["GENERAL_EXPENSES", "FIXED_ASSETS", "PROJECT_MATERIAL_WIP"]
              : projectReturns.projectReturnCost.gt(0)
                ? ["PROJECT_MATERIAL_WIP"]
                : []),
          ],
          ctx = await systemContext(tx, actor, doc.issueDate, keys),
          creditSide =
            doc.type === "SALES_INVOICE" || doc.type === "DEBIT_NOTE",
          counterDebit =
            doc.type === "PURCHASE_BILL" || doc.type === "CREDIT_NOTE",
          m = (x: Prisma.Decimal) => x.toFixed(2),
          lines: Array<{
            ledgerAccountId: string;
            debit: string;
            credit: string;
            description: string;
          }> = [];
        const push = (key: string, amount: Prisma.Decimal, debit: boolean) => {
          if (amount.gt(0))
            lines.push({
              ledgerAccountId: ctx.account(key),
              debit: debit ? m(amount) : "0",
              credit: debit ? "0" : m(amount),
              description: doc.documentNumber,
            });
        };
        if (sale && doc.reverseCharge) doc.payableAmount = doc.grandTotal.sub(doc.taxTotal).sub(doc.tdsAmount);
        const partyAmount =
          doc.payableAmount ??
          (doc.reverseCharge
            ? doc.grandTotal.sub(doc.taxTotal)
            : doc.grandTotal.sub(doc.tdsAmount));
        push(keys[0], partyAmount, creditSide);
        if (doc.type === "PURCHASE_BILL") {
          push("INVENTORY_ASSET", purchaseBuckets.inventory, counterDebit);
          push(
            "GENERAL_EXPENSES",
            purchaseBuckets.generalExpense
              .add(doc.freightAmount)
              .add(doc.otherChargesAmount)
              .add(doc.roundOffAmount),
            counterDebit,
          );
          push("FIXED_ASSETS", purchaseBuckets.fixedAsset, counterDebit);
          push(
            "PROJECT_MATERIAL_WIP",
            purchaseBuckets.projectWip,
            counterDebit,
          );
        } else {
          if (doc.type === "DEBIT_NOTE") {
            // Source material retains its original valuation. Differences between
            // the supplier credit and returned stock are signed purchase variance.
            const costCorrection = doc.taxableTotal
              .add(doc.taxCreditTreatment === "ELIGIBLE" ? 0 : doc.taxTotal)
              .sub(inventory.returnCost)
              .sub(projectReturns.projectReturnCost);
            push(keys[1], costCorrection.abs(), costCorrection.lt(0));
            push(
              "PROJECT_MATERIAL_WIP",
              projectReturns.projectReturnCost,
              false,
            );
          } else
            push(
              keys[1],
              sale ? doc.taxableTotal.add(doc.freightAmount).add(doc.otherChargesAmount).add(doc.roundOffAmount) : inventory.nonInventoryPurchase,
              counterDebit,
            );
          if (inventory.inventoryPurchase.gt(0))
            push("INVENTORY_ASSET", inventory.inventoryPurchase, counterDebit);
        }
        const components = [
          ["CGST", doc.cgstTotal],
          ["SGST", doc.sgstTotal],
          ["IGST", doc.igstTotal],
          ["CESS", doc.cessTotal],
        ] as const;
        for (const [name, amount] of components) {
          if (amount.lte(0)) continue;
          if (sale) { if (!doc.reverseCharge) push(`${name}_PAYABLE`, amount, !creditSide); }
          else if (doc.reverseCharge) {
            push(`${name}_PAYABLE`, amount, !counterDebit);
            if (doc.taxCreditTreatment === "ELIGIBLE")
              push(`${name}_ITC`, amount, counterDebit);
          } else if (doc.taxCreditTreatment === "ELIGIBLE")
            push(`${name}_ITC`, amount, counterDebit);
          else {
            /* non-creditable tax is already included exactly once in the inventory/non-inventory cost buckets */
          }
        }
        push("TDS_PAYABLE", doc.tdsAmount, !counterDebit);
        push("TCS_PAYABLE", doc.tcsAmount, !creditSide);
        if (doc.type === "SALES_INVOICE" && inventory.cogs.gt(0)) {
          push("COGS", inventory.cogs, true);
          push("INVENTORY_ASSET", inventory.cogs, false);
        }
        if (doc.type === "CREDIT_NOTE" && inventory.returnCost.gt(0)) {
          push("INVENTORY_ASSET", inventory.returnCost, true);
          push("COGS", inventory.returnCost, false);
        }
        if (doc.type === "DEBIT_NOTE" && inventory.returnCost.gt(0)) {
          push("INVENTORY_ASSET", inventory.returnCost, false);
        }
        const journal = await postJournalInTx(tx, actor, {
          financialYearId: ctx.fy.id,
          branchId: doc.branchId,
          entryDate: doc.issueDate,
          sourceType: doc.type,
          sourceId: doc.id,
          postingPurpose: "PRIMARY",
          lines,
        });
        await postProjectPurchaseMaterialsInTx(tx, actor, doc);
        const signature = await tx.authorizedSignatureVersion.findFirst({
            where: { companyId: actor.companyId, isCurrent: true },
            orderBy: { createdAt: "desc" },
          }),
          changed = await tx.commercialDocument.updateMany({
            where: {
              id: doc.id,
              companyId: actor.companyId,
              status: "DRAFT",
              journalEntryId: null,
            },
            data: {
              status: "POSTED",
              journalEntryId: journal.id,
              signatureVersionId: signature?.id,
              ...(sale && doc.reverseCharge ? {payableAmount:partyAmount,balanceDue:partyAmount} : {}),
            },
          });
        if (changed.count !== 1) throw new Error("STALE");
        if (doc.type === "SALES_INVOICE") {
          const settings = await tx.accountSettings.findUnique({where:{companyId:actor.companyId}});
          const defaults = settings?.transactionDefaults as Record<string, unknown> | null;
          if (normalizeTransactionPreferences(defaults?.transactionPreferences).linkPayments &&
              (await enabledModulesForCompany(actor.companyId)).includes("CUSTOMER_ADVANCES")) {
            // Apply only matching customer/branch/project advances. This is part of
            // posting, so a failed application rolls back the invoice as well.
            const advances = await tx.accountSettlement.findMany({
              where:{ ...EFFECTIVE_SETTLEMENT,companyId:actor.companyId,type:"CUSTOMER_ADVANCE",partyId:doc.partyId,
                branchId:doc.branchId,projectId:doc.projectId,remainingAmount:{gt:0}},
              orderBy:[{transactionDate:"asc"},{createdAt:"asc"},{id:"asc"}],
            });
            for (const advance of advances) {
              const {outstanding} = await documentOutstandingInTx(tx,actor.companyId,doc.id);
              if (outstanding.lte(0)) break;
              const amount = D.min(outstanding,advance.remainingAmount);
              await applyAdvanceForActor(actor,{
                advanceId:advance.id,documentId:doc.id,amount:amount.toFixed(2),
                applicationDate:advance.transactionDate > doc.issueDate ? advance.transactionDate : doc.issueDate,
                idempotencyKey:`invoice-advance:${doc.id}:${advance.id}`,
              },tx);
            }
          }
        }

        await audit(
          tx,
          actor,
          (
            {
              SALES_INVOICE: "INVOICE_POSTED",
              CREDIT_NOTE: "CREDIT_NOTE_POSTED",
              PURCHASE_BILL: "PURCHASE_BILL_POSTED",
              DEBIT_NOTE: "DEBIT_NOTE_POSTED",
            } as const
          )[
            doc.type as
              "SALES_INVOICE" | "CREDIT_NOTE" | "PURCHASE_BILL" | "DEBIT_NOTE"
          ],
          "COMMERCIAL_DOCUMENT",
          doc.id,
          { journalEntryId: journal.id },
        );
        return journal;
      },
  );
}
export async function documentOutstandingInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  documentId: string,
) {
  const doc = await tx.commercialDocument.findFirst({
    where: { id: documentId, companyId, status: "POSTED" },
    select: { grandTotal: true, payableAmount: true, type: true },
  });
  if (!doc || !["SALES_INVOICE", "PURCHASE_BILL"].includes(doc.type))
    throw new Error("INVALID_FINANCIAL_DOCUMENT");
  const adjustmentWhere = {
      companyId,
      sourceDocumentId: documentId,
      status: "POSTED" as const,
      type:
        doc.type === "SALES_INVOICE"
          ? ("CREDIT_NOTE" as const)
          : ("DEBIT_NOTE" as const),
    },
    adjustmentQuery =
      typeof tx.commercialDocument.findMany === "function"
        ? tx.commercialDocument.findMany({
            where: adjustmentWhere,
            select: { grandTotal: true, payableAmount: true },
          })
        : tx.commercialDocument
            .aggregate({ where: adjustmentWhere, _sum: { grandTotal: true } })
            .then((x) => [
              { grandTotal: x._sum.grandTotal, payableAmount: null },
            ]);
  const [adjustmentRows, allocations, applications] = await Promise.all([
      adjustmentQuery,
      tx.settlementAllocation.aggregate({
        where: { ...EFFECTIVE_SETTLEMENT_ALLOCATION, companyId, documentId },
        _sum: { amount: true },
      }),
      tx.advanceApplication.aggregate({
        where: { ...EFFECTIVE_ADVANCE_APPLICATION, companyId, documentId },
        _sum: { amount: true },
      }),
    ]),
    base = new D(doc.payableAmount ?? doc.grandTotal),
    adjusted = adjustmentRows.reduce(
      (n, x) => n.add(x.payableAmount ?? x.grandTotal ?? 0),
      new D(0),
    ),
    outstanding = base
      .sub(adjusted)
      .sub(allocations._sum.amount ?? 0)
      .sub(applications._sum.amount ?? 0);
  if (outstanding.lt(0)) throw new Error("NEGATIVE_OUTSTANDING");
  return {
    outstanding,
    paymentStatus: outstanding.isZero()
      ? ("PAID" as const)
      : outstanding.eq(base)
        ? ("UNPAID" as const)
        : ("PARTIALLY_PAID" as const),
  };
}
export async function documentOutstanding(documentId: string) {
  const a = (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor;
  return db.$transaction(async (tx) => {
    const authorized = await tx.commercialDocument.findFirst({
      where: {
        id: documentId,
        companyId: a.companyId,
        status: "POSTED",
        type: { in: ["SALES_INVOICE", "PURCHASE_BILL"] },
        ...scope(a),
      },
      select: { id: true },
    });
    if (!authorized) throw new Error("NOT_FOUND");
    return documentOutstandingInTx(tx, a.companyId, authorized.id);
  });
}
/** A full-payment save collects only the remaining balance after advances.
 * Preserve the original amount on retries so the receipt key remains stable. */
export async function saleReceiptBalanceForActor(actor: Actor, documentId: string, idempotencyKey: string) {
  return db.$transaction(async tx => {
    const doc = await tx.commercialDocument.findFirst({where:{id:documentId,companyId:actor.companyId,type:"SALES_INVOICE",status:"POSTED"}});
    if (!doc) throw new Error("NOT_FOUND");
    assertBranch(actor,doc.branchId);
    const existing = await tx.accountSettlement.findUnique({where:{companyId_idempotencyKey:{companyId:actor.companyId,idempotencyKey}}});
    return existing?.amount ?? (await documentOutstandingInTx(tx,actor.companyId,documentId)).outstanding;
  });
}
export async function saleReceiptBalance(documentId: string, idempotencyKey: string) {
  return saleReceiptBalanceForActor((await requirePermissionForMutation("ACCOUNT_SETTLEMENT_ENTRY")) as Actor,documentId,idempotencyKey);
}

export async function partyOutstanding(
  partyId: string,
  party: "customer" | "vendor",
) {
  const a = (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor,
    [docs, opening] = await Promise.all([
      db.commercialDocument.findMany({
        where: {
          companyId: a.companyId,
          partyId,
          type: party === "customer" ? "SALES_INVOICE" : "PURCHASE_BILL",
          status: "POSTED",
          ...scope(a),
        },
        select: { id: true },
      }),
      listOpeningOutstandings({
        companyId: a.companyId,
        partyId,
        partyType: party === "customer" ? "CUSTOMER" : "VENDOR",
        branchIds:
          a.branchAccessScope === "SELECTED_BRANCHES"
            ? (a.branchIds ?? [])
            : undefined,
      }),
    ]),
    rows = await db.$transaction((tx) =>
      Promise.all(
        docs.map((x) => documentOutstandingInTx(tx, a.companyId, x.id)),
      ),
    );
  return [
    ...rows.map((x) => x.outstanding),
    ...opening.map((x) => x.outstanding),
  ].reduce((n, x) => n.add(x), new D(0));
}
const settlementInput = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(120),
    type: z.nativeEnum(SettlementType),
    branchId: z.string().uuid(),
    partyId: z.string().uuid(),
    projectId: z.string().uuid().optional(),
    paymentMode: z.nativeEnum(PaymentMode),
    moneyAccountId: z.string().uuid().optional(),
    amount: decimal.pipe(z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)),
    transactionDate: z.coerce.date(),
    reference: z.string().max(160).optional(),
    chequeNumber: z.string().trim().min(1).max(80).optional(),
    chequeDate: z.coerce.date().optional(),
    notes: z.string().max(5000).optional(),
    allocations: z
      .array(
        z
          .object({
            documentId: z.string().uuid().optional(),
            openingBalanceId: z.string().uuid().optional(),
            amount: decimal,
            discountAmount: decimal.pipe(z.string().regex(/^\d{1,16}(\.\d{1,2})?$/)).default("0"),
          })
          .refine(
            (x) => Boolean(x.documentId) !== Boolean(x.openingBalanceId),
            "Exactly one allocation target is required",
          ),
      )
      .default([]),
  })
  .strict();
const settlementPolicy: Record<
  SettlementType,
  {
    modules: ModuleKey[];
    party: "customer" | "vendor";
    prefix: string;
    advance: boolean;
  }
> = {
  CUSTOMER_RECEIPT: {
    modules: ["SALES", "CUSTOMER_RECEIPTS"],
    party: "customer",
    prefix: "CR-",
    advance: false,
  },
  CUSTOMER_ADVANCE: {
    modules: ["SALES", "CUSTOMER_ADVANCES"],
    party: "customer",
    prefix: "CA-",
    advance: true,
  },
  VENDOR_PAYMENT: {
    modules: ["PURCHASES", "VENDOR_PAYMENTS"],
    party: "vendor",
    prefix: "VP-",
    advance: false,
  },
  VENDOR_ADVANCE: {
    modules: ["PURCHASES", "VENDOR_ADVANCES"],
    party: "vendor",
    prefix: "VA-",
    advance: true,
  },
};
export async function createSettlementForActor(actor: Actor, raw: unknown, transaction?: Prisma.TransactionClient, chequeLifecycle?: { closeChequeId?: string; reuseChequeId?: string }) {
  financialRole(actor);
  const d = settlementInput.parse(raw);
  if (d.paymentMode === "CHEQUE" && !d.chequeNumber) throw new Error("CHEQUE_NUMBER_REQUIRED");
  if (d.paymentMode === "CHEQUE" && !new D(d.amount).gt(0)) throw new Error("CHEQUE_AMOUNT_REQUIRED");
  const requestHash = createHash("sha256").update(JSON.stringify({
    ...d, amount: new D(d.amount).toFixed(2),
    transactionDate: d.transactionDate.toISOString().slice(0,10),
    chequeDate: d.chequeDate?.toISOString().slice(0,10),
    allocations: d.allocations.map(row => [row.documentId ?? row.openingBalanceId, new D(row.amount).toString(), new D(row.discountAmount).toString()].join(":" )).sort(),
  })).digest("hex");
  const p = settlementPolicy[d.type];
  await requireAccountModules(actor, ...p.modules);
  assertBranch(actor, d.branchId);
  const amount = new D(d.amount);
  const discountAmount=d.allocations.reduce((sum,row)=>sum.add(row.discountAmount),new D(0));
  if(d.allocations.some(row=>new D(row.discountAmount).lt(0)||(new D(row.discountAmount).gt(0)&&new D(row.discountAmount).gte(row.amount))))throw new Error("INVALID_PAYMENT_DISCOUNT");
  if(discountAmount.gt(0)&&(d.type!=="CUSTOMER_RECEIPT"||d.allocations.some(row=>row.openingBalanceId)))throw new Error("INVALID_PAYMENT_DISCOUNT");
  if (amount.lte(0)) throw new Error("INVALID_AMOUNT");
  if (
    (p.advance && d.allocations.length) ||
    (!p.advance && !d.allocations.length)
  )
    throw new Error(
      p.advance ? "ADVANCE_CANNOT_ALLOCATE" : "RECEIPT_MUST_BE_ALLOCATED",
    );
  if (
    !p.advance &&
    !d.allocations.reduce((n, x) => n.add(x.amount), new D(0)).eq(amount.add(discountAmount))
  )
    throw new Error("ALLOCATION_TOTAL_MISMATCH");
  if (
    new Set(d.allocations.map((x) => x.documentId ?? x.openingBalanceId))
      .size !== d.allocations.length
  )
    throw new Error("DUPLICATE_ALLOCATION");
  return inAccountTransaction(transaction, async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
        const settlementProject = d.projectId
          ? await authorizeProjectForCommercial(
              actor,
              d.projectId,
              d.branchId,
              p.party === "customer" ? d.partyId : undefined,
              tx,
            )
          : null;
        const linkedDocuments = await tx.commercialDocument.findMany({
          where: {
            companyId: actor.companyId,
            id: {
              in: d.allocations.flatMap((row) =>
                row.documentId ? [row.documentId] : [],
              ),
            },
          },
          select: { projectId: true, branchId: true, customerId: true },
        });
        for (const doc of linkedDocuments)
          if (doc.projectId)
            await authorizeProjectForCommercial(
              actor,
              doc.projectId,
              doc.branchId,
              doc.customerId ?? undefined,
              tx,
            );
        const existing = await tx.accountSettlement.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing && !chequeLifecycle?.closeChequeId && existing.creationRequestHash) {
          if (existing.creationRequestHash !== requestHash) throw new Error("IDEMPOTENCY_KEY_REUSED");
          return existing;
        }
        if (chequeLifecycle?.closeChequeId && (!existing || existing.status !== "PENDING_CHEQUE" || existing.chequeId !== chequeLifecycle.closeChequeId)) throw new Error("INVALID_CHEQUE_SOURCE");
        if (existing) {
          if (
            existing.type !== d.type ||
            existing.partyId !== d.partyId ||
            existing.branchId !== d.branchId ||
            existing.projectId !== (d.projectId ?? null) ||
            !existing.amount.eq(amount) ||
            !(existing.discountAmount??new D(0)).eq(discountAmount) ||
            existing.paymentMode !== d.paymentMode ||
            (!chequeLifecycle?.closeChequeId && existing.moneyAccountId !== (d.moneyAccountId ?? null)) ||
            (!chequeLifecycle?.closeChequeId && existing.transactionDate.toISOString().slice(0, 10) !== d.transactionDate.toISOString().slice(0, 10)) ||
            (existing.reference ?? "") !== (d.reference ?? "") ||
            (existing.notes ?? "") !== (d.notes ?? "")
          )
            throw new Error("IDEMPOTENCY_KEY_REUSED");
          const stored = [
            ...(await tx.settlementAllocation.findMany({
              where: { companyId: actor.companyId, settlementId: existing.id },
            })),
            ...(await tx.openingBalanceAllocation.findMany({
              where: { companyId: actor.companyId, settlementId: existing.id },
            })),
          ]
            .map((row) =>
              [
                "documentId" in row ? row.documentId : row.openingBalanceId,
                row.amount.toString(),
                "discountAmount" in row?row.discountAmount.toString():"0",
              ].join(":"),
            )
            .sort();
          const requested = d.allocations
            .map((row) =>
              [
                row.documentId ?? row.openingBalanceId,
                new D(row.amount).toString(),
                new D(row.discountAmount).toString(),
              ].join(":"),
            )
            .sort();
          if (JSON.stringify(stored) !== JSON.stringify(requested))
            throw new Error("IDEMPOTENCY_KEY_REUSED");
          if (!chequeLifecycle?.closeChequeId) return existing;
        }
        if(discountAmount.gt(0)){const settings=await tx.accountSettings.findUnique({where:{companyId:actor.companyId},select:{transactionDefaults:true}});const defaults=settings?.transactionDefaults as {transactionPreferences?:{discountDuringPayment?:boolean}}|null;if(defaults?.transactionPreferences?.discountDuringPayment!==true)throw new Error("PAYMENT_DISCOUNT_DISABLED");}
        const party =
          p.party === "customer"
            ? await tx.customer.findFirst({
                where: {
                  id: d.partyId,
                  companyId: actor.companyId,
                  branchId: d.branchId,
                  isActive: true,
                  isAccountCustomer: true,
                },
              })
            : await tx.vendor.findFirst({
                where: {
                  id: d.partyId,
                  companyId: actor.companyId,
                  isActive: true,
                },
              });
        if (!party) throw new Error("INVALID_PARTY");
        const expected =
          p.party === "customer" ? "SALES_INVOICE" : "PURCHASE_BILL";
        for (const allocation of d.allocations) {
          if (allocation.openingBalanceId) {
            await tx.$queryRaw`SELECT "id" FROM "party_opening_balances" WHERE "id"=${allocation.openingBalanceId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
            const opening = await tx.partyOpeningBalance.findFirst({
                where: {
                  id: allocation.openingBalanceId,
                  companyId: actor.companyId,
                  branchId: d.branchId,
                  partyId: d.partyId,
                  partyType: p.party === "customer" ? "CUSTOMER" : "VENDOR",
                },
              }),
              used = opening
                ? await tx.openingBalanceAllocation.aggregate({
                    where: { ...EFFECTIVE_SETTLEMENT_ALLOCATION,
                      companyId: actor.companyId,
                      openingBalanceId: opening.id,
                    },
                    _sum: { amount: true },
                  })
                : null;
            if (!opening) throw new Error("INVALID_OPENING_ALLOCATION");
            const value = new D(allocation.amount);
            if (
              value.lte(0) ||
              value.add(used?._sum.amount ?? 0).gt(opening.amount)
            )
              throw new Error("ALLOCATION_EXCEEDS_OUTSTANDING");
            continue;
          }
          await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${allocation.documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
          const doc = await tx.commercialDocument.findFirst({
            where: {
              id: allocation.documentId,
              companyId: actor.companyId,
              type: expected,
              status: "POSTED",
              partyId: d.partyId,
              branchId: d.branchId,
            },
          });
          if (!doc || (d.projectId && doc.projectId !== d.projectId))
            throw new Error("INVALID_ALLOCATION_DOCUMENT");
          const out = await documentOutstandingInTx(
            tx,
            actor.companyId,
            doc.id,
          );
          if (
            new D(allocation.amount).lte(0) ||
            new D(allocation.amount).gt(out.outstanding)
          )
            throw new Error("ALLOCATION_EXCEEDS_OUTSTANDING");
        }
        const selectedMoney = d.moneyAccountId
          ? await tx.moneyAccount.findFirst({
              where: {
                id: d.moneyAccountId,
                companyId: actor.companyId,
                isActive: true,
                OR: [{ branchId: null }, { branchId: d.branchId }],
              },
            })
          : null;
        if (d.moneyAccountId && !selectedMoney)
          throw new Error("INVALID_MONEY_ACCOUNT");
        if (d.paymentMode === "CHEQUE" && !chequeLifecycle?.closeChequeId) {
          const bank = selectedMoney ?? await tx.moneyAccount.findFirst({ where: { companyId: actor.companyId, isActive: true, type: "BANK", OR: [{ branchId: null }, { branchId: d.branchId }] }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
          if (!bank || (!chequeLifecycle?.reuseChequeId && bank.type !== "BANK")) throw new Error("CHEQUE_BANK_REQUIRED");
          const number = await allocateDocumentNumberInTx(tx, { companyId: actor.companyId, branchId: d.branchId, seriesKey: d.type, defaults: { prefix: p.prefix, padding: 6 } });
          await tx.$executeRaw`SELECT set_config('app.financial_write_company_id', ${actor.companyId}, true)`;
          const pending = await tx.accountSettlement.create({ data: {
            companyId: actor.companyId, branchId: d.branchId, type: d.type, status: "PENDING_CHEQUE", settlementNumber: number,
            partyId: d.partyId, customerId: p.party === "customer" ? d.partyId : null, vendorId: p.party === "vendor" ? d.partyId : null,
            idempotencyKey: d.idempotencyKey, creationRequestHash: requestHash, paymentMode: "CHEQUE", moneyAccountId: bank.id, projectId: settlementProject?.id,
            amount, discountAmount, remainingAmount: 0, transactionDate: d.transactionDate, reference: d.reference, notes: d.notes, createdById: actor.id,
            allocations: { create: d.allocations.filter(row => row.documentId).map(row => ({ documentId: row.documentId!, amount: row.amount, discountAmount: row.discountAmount })) },
          } });
          if (d.allocations.some(row => row.openingBalanceId)) await tx.openingBalanceAllocation.createMany({ data: d.allocations.filter(row => row.openingBalanceId).map(row => ({ companyId: actor.companyId, settlementId: pending.id, openingBalanceId: row.openingBalanceId!, amount: row.amount })) });
          let cheque;
          if (chequeLifecycle?.reuseChequeId) {
            const current = await tx.cheque.findFirst({ where: { id: chequeLifecycle.reuseChequeId, companyId: actor.companyId, branchId: d.branchId } });
            if (!current || current.amount?.toFixed(2) !== amount.toFixed(2) || !["ISSUED", "RECEIVED"].includes(current.status)) throw new Error("INVALID_CHEQUE_SOURCE");
            cheque = await tx.cheque.update({ where: { id: current.id }, data: { settlementId: pending.id } });
          } else {
            if (await tx.cheque.findFirst({ where: { companyId: actor.companyId, moneyAccountId: bank.id, chequeNumber: d.chequeNumber! } })) throw new Error("CHEQUE_NUMBER_EXISTS");
            cheque = await tx.cheque.create({ data: { companyId: actor.companyId, branchId: d.branchId, moneyAccountId: bank.id, chequeNumber: d.chequeNumber!, chequeDate: d.chequeDate ?? d.transactionDate, partyName: party.name.slice(0,240), amount, settlementId: pending.id, status: p.party === "customer" ? "RECEIVED" : "ISSUED", reference: d.reference } });
          }
          const linked = await tx.accountSettlement.update({ where: { id: pending.id }, data: { chequeId: cheque.id } });
          await tx.accountOperationalAudit.create({ data: { companyId: actor.companyId, actorUserId: actor.id, eventType: "CHEQUE_PAYMENT_RECORDED", entityType: "CHEQUE", entityId: cheque.id, metadata: { settlementId: pending.id, amount: amount.toFixed(2), type: d.type } } });
          return linked;
        }
        const moneyKey = d.paymentMode === "CASH" ? "CASH" : "BANK",
          balanceKey = p.advance
            ? p.party === "customer"
              ? "CUSTOMER_ADVANCES"
              : "ADVANCES"
            : p.party === "customer"
              ? "ACCOUNTS_RECEIVABLE"
              : "ACCOUNTS_PAYABLE",
          ctx = await systemContext(
            tx,
            actor,
            d.transactionDate,
            [...(selectedMoney ? [balanceKey] : [moneyKey, balanceKey]),...(discountAmount.gt(0)?["SALES_INCOME"]:[])],
          ),
          settlementNumber = existing?.settlementNumber ?? await allocateDocumentNumberInTx(tx, {
            companyId: actor.companyId,
            branchId: d.branchId,
            seriesKey: d.type,
            defaults: { prefix: p.prefix, padding: 6 },
          }),
          money = amount.toFixed(2),
          cashDebit = p.party === "customer",
          lines =
            p.advance || p.party === "customer"
              ? [
                  {
                    description: "Payment",
                    ledgerAccountId:
                      selectedMoney?.ledgerAccountId ?? ctx.account(moneyKey),
                    debit: cashDebit ? money : "0",
                    credit: cashDebit ? "0" : money,
                  },
                  {
                    description: "Payment",
                    ledgerAccountId: ctx.account(balanceKey),
                    debit: cashDebit ? "0" : money,
                    credit: cashDebit ? money : "0",
                  },
                ]
              : [
                  {
                    description: "Payment",
                    ledgerAccountId: ctx.account(balanceKey),
                    debit: money,
                    credit: "0",
                  },
                  {
                    description: "Payment",
                    ledgerAccountId:
                      selectedMoney?.ledgerAccountId ?? ctx.account(moneyKey),
                    debit: "0",
                    credit: money,
                  },
                ],
          placeholder = existing?.id ?? crypto.randomUUID();
        if(discountAmount.gt(0)){lines.push({ledgerAccountId:ctx.account("SALES_INCOME"),debit:discountAmount.toFixed(2),credit:"0",description:"Payment discount"});const receivable=lines.find(line=>line.ledgerAccountId===ctx.account(balanceKey));if(receivable)receivable.credit=amount.add(discountAmount).toFixed(2);}
        await tx.$executeRaw`SELECT set_config('app.financial_write_company_id', ${actor.companyId}, true)`;
        const journal = await postJournalInTx(tx, actor, {
            financialYearId: ctx.fy.id,
            branchId: d.branchId,
            entryDate: d.transactionDate,
            sourceType: d.type,
            sourceId: placeholder,
            postingPurpose: "PRIMARY",
            lines,
          }),
          settlement = existing && chequeLifecycle?.closeChequeId
            ? await tx.accountSettlement.update({ where: { id: existing.id }, data: { status: "POSTED", journalEntryId: journal.id, moneyAccountId: d.moneyAccountId, transactionDate: d.transactionDate, remainingAmount: p.advance ? amount : 0 } })
            : await tx.accountSettlement.create({
            data: {
              id: placeholder,
              companyId: actor.companyId,
              branchId: d.branchId,
              type: d.type,
              settlementNumber,
              partyId: d.partyId,
              customerId: p.party === "customer" ? d.partyId : null,
              vendorId: p.party === "vendor" ? d.partyId : null,
              idempotencyKey: d.idempotencyKey,
              creationRequestHash: requestHash,
              paymentMode: d.paymentMode,
              moneyAccountId: d.moneyAccountId,
              projectId: settlementProject?.id,
              amount,
              discountAmount,
              remainingAmount: p.advance ? amount : 0,
              transactionDate: d.transactionDate,
              reference: d.reference,
              notes: d.notes,
              journalEntryId: journal.id,
              createdById: actor.id,
              allocations: {
                create: d.allocations
                  .filter((x) => x.documentId)
                  .map((x) => ({
                    documentId: x.documentId!,
                    amount: x.amount,
                    discountAmount:x.discountAmount,
                  })),
              },
            },
          });
        if (!existing && d.allocations.some((x) => x.openingBalanceId))
          await tx.openingBalanceAllocation.createMany({
            data: d.allocations
              .filter((x) => x.openingBalanceId)
              .map((x) => ({
                companyId: actor.companyId,
                settlementId: settlement.id,
                openingBalanceId: x.openingBalanceId!,
                amount: x.amount,
              })),
          });
        await audit(
          tx,
          actor,
          (
            {
              CUSTOMER_RECEIPT: "CUSTOMER_RECEIPT_POSTED",
              CUSTOMER_ADVANCE: "CUSTOMER_ADVANCE_POSTED",
              VENDOR_PAYMENT: "VENDOR_PAYMENT_POSTED",
              VENDOR_ADVANCE: "VENDOR_ADVANCE_POSTED",
            } as const
          )[d.type],
          "SETTLEMENT",
          settlement.id,
          { journalEntryId: journal.id },
        );
        return settlement;
      },
  );
}
export async function applyAdvanceForActor(actor: Actor, raw: unknown, transaction?: Prisma.TransactionClient) {
  const d = z
    .object({
      advanceId: z.string().uuid(),
      documentId: z.string().uuid(),
      amount: decimal,
      applicationDate: z.coerce.date(),
      idempotencyKey: z.string().trim().min(8).max(120),
    })
    .strict()
    .parse(raw);
  financialRole(actor);
  const amount = new D(d.amount);
  if (amount.lte(0)) throw new Error("INVALID_AMOUNT");
  return inAccountTransaction(transaction,
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "account_settlements" WHERE "id"=${d.advanceId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "commercial_documents" WHERE "id"=${d.documentId}::uuid AND "companyId"=${actor.companyId}::uuid FOR UPDATE`;
        const advance = await tx.accountSettlement.findFirst({
            where: {
              id: d.advanceId,
              ...EFFECTIVE_SETTLEMENT,
              companyId: actor.companyId,
              type: { in: ["CUSTOMER_ADVANCE", "VENDOR_ADVANCE"] },
            },
          }),
          doc = await tx.commercialDocument.findFirst({
            where: {
              id: d.documentId,
              companyId: actor.companyId,
              status: "POSTED",
            },
          });
        if (
          !advance ||
          !doc ||
          advance.partyId !== doc.partyId ||
          advance.branchId !== doc.branchId ||
          advance.projectId !== doc.projectId ||
          (advance.type === "CUSTOMER_ADVANCE" &&
            doc.type !== "SALES_INVOICE") ||
          (advance.type === "VENDOR_ADVANCE" && doc.type !== "PURCHASE_BILL")
        )
          throw new Error("INVALID_ADVANCE_APPLICATION");
        assertBranch(actor, doc.branchId);
        await requireAccountModules(
          actor,
          ...settlementPolicy[advance.type].modules,
        );
        if (doc.projectId)
          await authorizeProjectForCommercial(
            actor,
            doc.projectId,
            doc.branchId,
            doc.customerId ?? undefined,
            tx,
          );
        const existing = await tx.advanceApplication.findUnique({
          where: {
            companyId_idempotencyKey: {
              companyId: actor.companyId,
              idempotencyKey: d.idempotencyKey,
            },
          },
        });
        if (existing) {
          if (
            existing.advanceId !== d.advanceId ||
            existing.documentId !== d.documentId ||
            !existing.amount.eq(amount) ||
            existing.applicationDate.toISOString().slice(0, 10) !==
              d.applicationDate.toISOString().slice(0, 10)
          )
            throw new Error("IDEMPOTENCY_KEY_REUSED");
          return existing;
        }
        const outstanding = await documentOutstandingInTx(
          tx,
          actor.companyId,
          doc.id,
        );
        if (
          amount.gt(advance.remainingAmount) ||
          amount.gt(outstanding.outstanding)
        )
          throw new Error("ADVANCE_APPLICATION_EXCEEDS_BALANCE");
        const customer = advance.type === "CUSTOMER_ADVANCE",
          keys = customer
            ? ["CUSTOMER_ADVANCES", "ACCOUNTS_RECEIVABLE"]
            : ["ACCOUNTS_PAYABLE", "ADVANCES"],
          ctx = await systemContext(tx, actor, d.applicationDate, keys),
          money = amount.toFixed(2),
          id = crypto.randomUUID(),
          journal = await postJournalInTx(tx, actor, {
            financialYearId: ctx.fy.id,
            branchId: doc.branchId,
            entryDate: d.applicationDate,
            sourceType: "ADVANCE_APPLICATION",
            sourceId: id,
            postingPurpose: "PRIMARY",
            lines: [
              {
                ledgerAccountId: ctx.account(keys[0]),
                debit: money,
                credit: "0",
              },
              {
                ledgerAccountId: ctx.account(keys[1]),
                debit: "0",
                credit: money,
              },
            ],
          }),
          application = await tx.advanceApplication.create({
            data: {
              id,
              companyId: actor.companyId,
              advanceId: advance.id,
              documentId: doc.id,
              projectId: advance.projectId,
              amount,
              applicationDate: d.applicationDate,
              idempotencyKey: d.idempotencyKey,
              journalEntryId: journal.id,
              createdById: actor.id,
            },
          });
        await tx.accountSettlement.update({
          where: { id: advance.id },
          data: { remainingAmount: { decrement: amount } },
        });
        await audit(
          tx,
          actor,
          customer ? "CUSTOMER_ADVANCE_APPLIED" : "VENDOR_ADVANCE_APPLIED",
          "ADVANCE_APPLICATION",
          application.id,
          { journalEntryId: journal.id },
        );
        return application;
      },
  );
}
export async function applyAdvance(raw: unknown) {
  return applyAdvanceForActor(
    (await requirePermissionForMutation("ACCOUNT_SETTLEMENT_ENTRY")) as Actor,
    raw,
  );
}
export async function schedulePaymentReminder(raw: unknown) {
  const d = z
      .object({
        documentId: z.string().uuid(),
        remindAt: z.coerce.date(),
        message: z.string().trim().min(1).max(1000),
      })
      .strict()
      .parse(raw),
    actor = (await requirePermissionForMutation(
      "ACCOUNT_SALES_ENTRY",
    )) as Actor;
  financialRole(actor);
  await requireAccountModules(actor, "SALES", "PAYMENT_REMINDERS");
  const doc = await db.commercialDocument.findFirst({
    where: {
      id: d.documentId,
      companyId: actor.companyId,
      type: "SALES_INVOICE",
      status: "POSTED",
      ...scope(actor),
    },
  });
  if (!doc || !doc.customerId) throw new Error("INVALID_INVOICE");
  const reminder = await db.paymentReminder.create({
    data: {
      companyId: actor.companyId,
      documentId: doc.id,
      customerId: doc.customerId,
      createdById: actor.id,
      remindAt: d.remindAt,
      message: d.message,
    },
  });
  await db.commercialAuditEvent.create({
    data: {
      companyId: actor.companyId,
      actorId: actor.id,
      eventType: "REMINDER_CREATED",
      entityType: "PAYMENT_REMINDER",
      entityId: reminder.id,
    },
  });
  return reminder;
}
export async function setPaymentReminderStatus(raw: unknown) {
  const d = z
      .object({ id: z.string().uuid(), status: z.enum(["SENT", "DISMISSED"]) })
      .strict()
      .parse(raw),
    actor = (await requirePermissionForMutation(
      "ACCOUNT_SALES_ENTRY",
    )) as Actor;
  financialRole(actor);
  await requireAccountModules(actor, "SALES", "PAYMENT_REMINDERS");
  return db.$transaction(async (tx) => {
    const row = await tx.paymentReminder.findFirst({
      where: {
        id: d.id,
        companyId: actor.companyId,
        status: "PENDING",
        document: scope(actor),
      },
    });
    if (!row) throw new Error("REMINDER_NOT_PENDING");
    const updated = await tx.paymentReminder.update({
      where: { id: row.id },
      data: {
        status: d.status as PaymentReminderStatus,
        sentAt: d.status === "SENT" ? new Date() : null,
      },
    });
    await audit(
      tx,
      actor,
      "REMINDER_STATUS_CHANGED",
      "PAYMENT_REMINDER",
      row.id,
      { status: d.status },
    );
    return updated;
  });
}
export async function listCommercialDocumentsForActor(actor: Actor) {
  return db.commercialDocument.findMany({
    where: { companyId: actor.companyId, ...scope(actor) },
    include: { lines: true },
    orderBy: { createdAt: "desc" },
  });
}
export async function getCommercialDocumentForActor(actor: Actor, id: string, transaction?: Prisma.TransactionClient) {
  const reader = transaction ?? db;
  const row = await reader.commercialDocument.findFirst({
    where: { id, companyId: actor.companyId, ...scope(actor) },
    include: {
      branch: true,
      journalEntry: { select: { status: true } },
      project: true,
      sourcePurchaseOrder: true,
      lines: {
        orderBy: { position: "asc" },
        include: { purchaseAllocations: true },
      },
      reminders: { orderBy: { createdAt: "desc" } },
      adjustments: { where: { status: "POSTED" } },
      allocations: { where: EFFECTIVE_SETTLEMENT_ALLOCATION, include: { settlement: true } },
      advanceApplications: { where: EFFECTIVE_ADVANCE_APPLICATION, include: { advance: true } },
    },
  });
  if (!row) throw new Error("NOT_FOUND");
  const [stockMovements, projectMaterialMovements] = await Promise.all([
    reader.stockMovement.findMany({
      where: { companyId: actor.companyId, sourceId: row.id },
      orderBy: { createdAt: "asc" },
    }),
    reader.projectMaterialMovement.findMany({
      where: { companyId: actor.companyId, purchaseDocumentId: row.id },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const financial =
    row.status === "POSTED" &&
    ["SALES_INVOICE", "PURCHASE_BILL"].includes(row.type)
      ? transaction ? await documentOutstandingInTx(transaction, actor.companyId, row.id) : await db.$transaction((tx) =>
          documentOutstandingInTx(tx, actor.companyId, row.id),
        )
      : null;
  const customRows=row.type==="SALES_INVOICE"||row.type==="PURCHASE_BILL"?await reader.customFieldValue.findMany({where:{companyId:actor.companyId,entityType:row.type,entityId:row.id,definition:{isActive:true}},include:{definition:{select:{fieldKey:true}}}}):[];
  return { ...row, financial, stockMovements, projectMaterialMovements, customValues:Object.fromEntries(customRows.map(value=>[value.definition.fieldKey,value.value])) };
}
async function safeSalesInvoiceNumberingSeriesOptions(companyId: string) {
  try {
    return (
      await db.numberingSeries.findMany({
        where: { companyId, seriesKey: "SALES_INVOICE", isActive: true },
        select: {
          branchId: true,
          prefix: true,
          suffix: true,
          padding: true,
          nextSequence: true,
        },
      })
    ).map((row) => ({ ...row, nextSequence: Number(row.nextSequence) }));
  } catch (error) {
    console.error("SALES_INVOICE_NUMBERING_PREVIEW_UNAVAILABLE", error);
    return [];
  }
}
export async function commercialEditorOptionsForActor(actor: Actor) {
  const company = await db.company.findUniqueOrThrow({
      where: { id: actor.companyId },
      select: { productEdition: true },
    }),
    sourceRows = await db.commercialDocument.findMany({
      where: {
        companyId: actor.companyId,
        status: "POSTED",
        type: { in: ["SALES_INVOICE", "PURCHASE_BILL"] },
        ...scope(actor),
      },
      select: {
        id: true,
        type: true,
        branchId: true,
        customerId: true,
        vendorId: true,
        documentNumber: true,
        grandTotal: true,
        adjustments: {
          where: { status: "POSTED" },
          select: { grandTotal: true },
        },
        allocations: { where: EFFECTIVE_SETTLEMENT_ALLOCATION, select: { amount: true } },
        advanceApplications: { where: EFFECTIVE_ADVANCE_APPLICATION, select: { amount: true } },
        lines: {
          select: {
            id: true,
            lineType: true,
            itemName: true,
            productId: true,
            serviceId: true,
            workPackageId: true,
            warehouseId: true,
            batchId: true,
            serialNumberId: true,
            quantity: true,
            rate: true,
            taxRate: true,
            lineTotal: true,
          },
        },
      },
    }),
    sourceDocuments = sourceRows
      .map((x) => ({
        ...x,
        remainingAmount: x.advanceApplications.reduce(
          (n, a) => n.sub(a.amount),
          x.allocations.reduce(
            (n, a) => n.sub(a.amount),
            x.adjustments.reduce(
              (n, a) => n.sub(a.grandTotal),
              new D(x.grandTotal),
            ),
          ),
        ),
      }))
      .filter((x) => x.remainingAmount.gt(0));
  const openingCustomerRows = await listOpeningOutstandings({
      companyId: actor.companyId,
      partyType: "CUSTOMER",
      branchIds:
        actor.branchAccessScope === "SELECTED_BRANCHES"
          ? (actor.branchIds ?? [])
          : undefined,
    }),
    customerBalances = new Map<string, Prisma.Decimal>();
  for (const row of sourceDocuments) {
    if (row.type !== "SALES_INVOICE" || !row.customerId) continue;
    customerBalances.set(
      row.customerId,
      (customerBalances.get(row.customerId) ?? new D(0)).add(
        row.remainingAmount,
      ),
    );
  }
  for (const row of openingCustomerRows)
    customerBalances.set(
      row.partyId,
      (customerBalances.get(row.partyId) ?? new D(0)).add(row.outstanding),
    );
  const enabledModules = await enabledModulesForCompany(actor.companyId),
    projectPurchasesAvailable = purchaseProjectCapability(
      enabledModules,
      canUsePermission(actor, company.productEdition, "ACCOUNT_PROJECTS"),
    ),
    projects = projectPurchasesAvailable
      ? await listOpenProjectOptionsForActor(actor, company.productEdition)
      : [],
    projectBudgetLines = projects.length
      ? await db.projectBudgetLine.findMany({
          where: {
            companyId: actor.companyId,
            projectId: { in: projects.map((x) => x.id) },
          },
          select: { id: true, projectId: true, category: true, title: true },
          orderBy: [{ projectId: "asc" }, { position: "asc" }],
        })
      : [],
    purchaseOrders = await db.commercialDocument.findMany({
      where: {
        companyId: actor.companyId,
        type: "PURCHASE_ORDER",
        status: "POSTED",
        ...scope(actor),
      },
      select: {
        id: true,
        documentNumber: true,
        branchId: true,
        vendorId: true,
        projectId: true,
        projectReference: true,
        grandTotal: true,
        taxableTotal: true,
        status: true,
      },
    });
  const editorSettings=await db.accountSettings.findUnique({where:{companyId:actor.companyId}});
  const storedPreferences=((editorSettings?.transactionDefaults as Record<string,unknown>|null)?.transactionPreferences??{}) as Record<string,unknown>;
  const customerAdvances = enabledModules.includes("CUSTOMER_ADVANCES") ? await db.accountSettlement.findMany({
    where:{ ...EFFECTIVE_SETTLEMENT,companyId:actor.companyId,type:"CUSTOMER_ADVANCE",remainingAmount:{gt:0},...scope(actor)},
    select:{partyId:true,branchId:true,projectId:true,remainingAmount:true},
  }) : [];
  for (const advance of customerAdvances) customerBalances.set(advance.partyId,
    (customerBalances.get(advance.partyId) ?? new D(0)).sub(advance.remainingAmount));
  const allowedDocumentTypes = availableCommercialDocumentTypes(
    enabledModules,
    (permission) => canUsePermission(actor, company.productEdition, permission),
  );
  return {
    customerAdvances,
    recentSalePrices:await recentSalePrices(actor,storedPreferences.lastFiveSalePrices===true),
    sourceDocuments,
    purchaseOrders,
    enabledModules,
    allowedDocumentTypes,
    projectPurchasesAvailable,
    projects,
    projectBudgetLines,
    branches: await db.branch.findMany({
      where: {
        companyId: actor.companyId,
        isActive: true,
        ...(actor.branchAccessScope === "SELECTED_BRANCHES"
          ? { id: { in: actor.branchIds ?? [] } }
          : {}),
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      select: { id: true, name: true, code: true },
    }),
    customers: (
      await db.customer.findMany({
        where: {
          companyId: actor.companyId,
          isActive: true,
          isAccountCustomer: true,
          ...scope(actor),
        },
        select: { id: true, name: true, phone: true, branchId: true, stateCode:true },
      })
    ).map((customer) => ({
      ...customer,
      balance: (customerBalances.get(customer.id) ?? new D(0)).toFixed(2),
    })),
    vendors: await db.vendor.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: { id: true, name: true },
    }),
    units: await db.accountUnit.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: { id: true, name: true, symbol: true },
      orderBy: { name: "asc" },
    }),
    products: await db.accountProduct.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        barcode: true,
        salePrice: true,
        costPrice: true,
        taxRate: true,
        trackInventory: true,
        trackingMode: true,
      },
    }),
    warehouses: await db.warehouse.findMany({
      where: { companyId: actor.companyId, isActive: true, ...scope(actor) },
      select: { id: true, name: true, branchId: true, isDefault: true },
    }),
    batches: await db.inventoryBatch.findMany({
      where: { companyId: actor.companyId },
      select: {
        id: true,
        productId: true,
        batchNumber: true,
        expiryDate: true,
      },
    }),
    serials: await db.inventorySerialNumber.findMany({
      where: { companyId: actor.companyId },
      select: {
        id: true,
        productId: true,
        serialNumber: true,
        expiryDate: true,
      },
    }),
    invoiceCustomFields:await db.customFieldDefinition.findMany({where:{companyId:actor.companyId,entityType:{in:["SALES_INVOICE","PURCHASE_BILL"]},isActive:true},orderBy:{position:"asc"}}),
    accountSettings: editorSettings,
    numberingSeries: await safeSalesInvoiceNumberingSeriesOptions(
      actor.companyId,
    ),
    services: await db.accountService.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        sellingRate: true,
        taxRate: true,
      },
    }),
    workPackages: await db.workPackage.findMany({
      where: { companyId: actor.companyId, isActive: true },
      select: { id: true, name: true, code: true, sellingRate: true },
    }),
  };
}
export async function commercialDocumentControls(documentId: string) {
  const actor = (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor,
    document = await db.commercialDocument.findFirst({
      where: {
        id: documentId,
        companyId: actor.companyId,
        status: "POSTED",
        ...scope(actor),
      },
      select: {
        id: true,
        type: true,
        branchId: true,
        customerId: true,
        vendorId: true,
        projectId: true,
        balanceDue: true,
      },
    });
  if (!document)
    return {
      canManage: false,
      canRemind: false,
      advances: [],
      enabledModules: [] as ModuleKey[],
    };
  const enabledModules = await enabledModulesForCompany(actor.companyId),
    canManage =
      actor.accountRole === "ACCOUNT_ADMIN" ||
      actor.accountRole === "ACCOUNTANT",
    customer = document.type === "SALES_INVOICE",
    advanceType = customer ? "CUSTOMER_ADVANCE" : "VENDOR_ADVANCE",
    advanceModule = customer ? "CUSTOMER_ADVANCES" : "VENDOR_ADVANCES",
    advances =
      canManage && enabledModules.includes(advanceModule)
        ? await db.accountSettlement.findMany({
            where: { ...EFFECTIVE_SETTLEMENT,
              companyId: actor.companyId,
              branchId: document.branchId,
              type: advanceType,
              remainingAmount: { gt: 0 },
              ...(customer
                ? { customerId: document.customerId }
                : { vendorId: document.vendorId }),
              projectId: document.projectId,
            },
            select: { id: true, settlementNumber: true, remainingAmount: true },
          })
        : [];
  return {
    canManage,
    canRemind:
      canManage &&
      customer &&
      enabledModules.includes("SALES") &&
      enabledModules.includes("PAYMENT_REMINDERS"),
    advances,
    enabledModules,
  };
}

export async function documentOutstandingsBatch(
  companyId: string,
  documents: Array<{
    id: string;
    grandTotal: Prisma.Decimal;
    payableAmount: Prisma.Decimal | null;
  }>,
) {
  if (!documents.length) return new Map<string, Prisma.Decimal>();
  const ids = documents.map((x) => x.id),
    [adjustments, allocations, applications] = await Promise.all([
      db.commercialDocument.findMany({
        where: { companyId, status: "POSTED", sourceDocumentId: { in: ids } },
        select: {
          sourceDocumentId: true,
          grandTotal: true,
          payableAmount: true,
        },
      }),
      db.settlementAllocation.groupBy({
        by: ["documentId"],
        where: { ...EFFECTIVE_SETTLEMENT_ALLOCATION, companyId, documentId: { in: ids } },
        _sum: { amount: true },
      }),
      db.advanceApplication.groupBy({
        by: ["documentId"],
        where: { ...EFFECTIVE_ADVANCE_APPLICATION, companyId, documentId: { in: ids } },
        _sum: { amount: true },
      }),
    ]),
    adjustmentMap = adjustments.reduce(
      (map, x) =>
        map.set(
          x.sourceDocumentId!,
          (map.get(x.sourceDocumentId!) ?? new D(0)).add(
            x.payableAmount ?? x.grandTotal,
          ),
        ),
      new Map<string, Prisma.Decimal>(),
    ),
    allocationMap = new Map(
      allocations.map((x) => [x.documentId, new D(x._sum.amount ?? 0)]),
    ),
    applicationMap = new Map(
      applications.map((x) => [x.documentId, new D(x._sum.amount ?? 0)]),
    );
  return new Map(
    documents.map((doc) => {
      const outstanding = new D(doc.payableAmount ?? doc.grandTotal)
        .sub(adjustmentMap.get(doc.id) ?? 0)
        .sub(allocationMap.get(doc.id) ?? 0)
        .sub(applicationMap.get(doc.id) ?? 0);
      if (outstanding.lt(0)) throw new Error("NEGATIVE_OUTSTANDING");
      return [doc.id, outstanding];
    }),
  );
}

export function purchasePostingAllocation(input: {
  taxable: Prisma.Decimal;
  tax: Prisma.Decimal;
  trackedTaxable: Prisma.Decimal;
  trackedTax: Prisma.Decimal;
  eligible: boolean;
  reverseCharge: boolean;
  tds?: Prisma.Decimal;
}) {
  const inventory = input.trackedTaxable.add(
      input.eligible ? 0 : input.trackedTax,
    ),
    nonInventory = input.taxable
      .sub(input.trackedTaxable)
      .add(input.eligible ? 0 : input.tax.sub(input.trackedTax)),
    itc = input.eligible ? input.tax : new D(0),
    rcmLiability = input.reverseCharge ? input.tax : new D(0),
    vendorPayable = input.taxable
      .add(input.reverseCharge ? 0 : input.tax)
      .sub(input.tds ?? 0);
  return {
    inventory,
    nonInventory,
    itc,
    rcmLiability,
    vendorPayable,
    totalDebit: inventory.add(nonInventory).add(itc),
    totalCredit: vendorPayable.add(rcmLiability).add(input.tds ?? 0),
  };
}
export function proportionalTaxReversal(
  sourceTax: Prisma.Decimal,
  sourceTaxable: Prisma.Decimal,
  adjustmentTaxable: Prisma.Decimal,
) {
  if (sourceTax.isZero() && sourceTaxable.isZero() && adjustmentTaxable.isZero()) return new D(0);
  if (
    sourceTaxable.lte(0) ||
    adjustmentTaxable.lt(0) ||
    adjustmentTaxable.gt(sourceTaxable)
  )
    throw new Error("INVALID_ADJUSTMENT_BASIS");
  return sourceTax.mul(adjustmentTaxable).div(sourceTaxable).toDecimalPlaces(2);
}

export function adjustmentTaxableBasis(
  sourceTaxable: Prisma.Decimal,
  sourceTotal: Prisma.Decimal,
  enteredAmount: Prisma.Decimal,
  taxMode: "EXCLUSIVE" | "INCLUSIVE",
) {
  if (sourceTaxable.isZero() && sourceTotal.isZero() && enteredAmount.isZero()) return new D(0);
  if (
    enteredAmount.lt(0) ||
    sourceTaxable.lt(0) ||
    sourceTotal.lte(0) ||
    enteredAmount.gt(sourceTotal)
  )
    throw new Error("INVALID_ADJUSTMENT_BASIS");
  return taxMode === "INCLUSIVE"
    ? sourceTaxable.mul(enteredAmount).div(sourceTotal).toDecimalPlaces(2)
    : enteredAmount.toDecimalPlaces(2);
}

export async function createCommercialDocument(raw: unknown) {
  const parsed = commercialDocumentInput.parse(raw),
    policy = policies[parsed.type],
    actor = (await requirePermissionForMutation(policy.permission)) as Actor;
  return createCommercialDocumentForActor(actor, parsed);
}
export async function createSettlement(raw: unknown) {
  const actor = (await requirePermissionForMutation(
    "ACCOUNT_SETTLEMENT_ENTRY",
  )) as Actor;
  return createSettlementForActor(actor, raw);
}
export async function listCommercialDocuments() {
  return listCommercialDocumentsForActor(
    (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor,
  );
}
export async function getCommercialDocument(id: string) {
  return getCommercialDocumentForActor(
    (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor,
    id,
  );
}
export async function commercialEditorOptions() {
  return commercialEditorOptionsForActor(
    (await requirePermission("ACCOUNT_LEDGER_VIEW")) as Actor,
  );
}

export async function postCommercialDocument(raw: unknown) {
  return postCommercialDocumentForActor(
    (await requirePermissionForMutation("ACCOUNT_JOURNAL_POST")) as Actor,
    raw,
  );
}

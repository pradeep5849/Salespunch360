import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import {
  ACCOUNT_MODULE_CATALOG,
  IMPLEMENTED_ACCOUNT_MODULES,
  enabledModulesForCompany,
  validateEnabledModules,
} from "@/lib/account/modules";
import { taxProfileInput } from "@/lib/account/tax";
import { verifyAccountDataForActor } from "@/lib/account/utilities";
import { mobileAccountActor } from "./account-transactions";
import type { MobileAppPrincipal } from "./auth";

const actor = (
  u: MobileAppPrincipal,
  permission: Parameters<typeof canUsePermission>[2],
) => {
  const a = mobileAccountActor(u);
  if (!canUsePermission(a, u.productEdition, permission))
    throw new Error("MOBILE_FORBIDDEN");
  return a;
};
const admin = (u: MobileAppPrincipal) => {
  const a = actor(u, "ACCOUNT_SETTINGS");
  if (a.accountRole !== "ACCOUNT_ADMIN") throw new Error("MOBILE_FORBIDDEN");
  return a;
};
const branchWhere = (a: ReturnType<typeof mobileAccountActor>) =>
  a.branchAccessScope === "SELECTED_BRANCHES"
    ? { id: { in: a.branchIds ?? [] } }
    : {};
export async function mobileSettings(u: MobileAppPrincipal) {
  const a = actor(u, "ACCOUNT_SETTINGS");
  const [settings, fields, templates, modules, branches] = await Promise.all([
    db.accountSettings.findUnique({ where: { companyId: a.companyId } }),
    db.customFieldDefinition.findMany({
      where: { companyId: a.companyId },
      orderBy: [{ entityType: "asc" }, { position: "asc" }],
    }),
    db.printTemplate.findMany({
      where: { companyId: a.companyId },
      orderBy: [{ documentType: "asc" }, { version: "desc" }],
    }),
    enabledModulesForCompany(a.companyId),
    db.branch.findMany({
      where: { companyId: a.companyId, ...branchWhere(a) },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    settings,
    fields,
    templates,
    modules,
    catalog: IMPLEMENTED_ACCOUNT_MODULES.map((key) => ({
      key,
      ...ACCOUNT_MODULE_CATALOG[key],
    })),
    branches,
  };
}
export async function mobileSaveSettings(
  u: MobileAppPrincipal,
  section: string,
  raw: unknown,
) {
  const a = admin(u);
  await assertOperationalWrite(a.companyId);
  if (section === "settings") {
    const schema = z
        .object({
          expenseApprovalRequired: z.boolean(),
          expenseApprovalThreshold: z.string(),
          negativeStockAllowed: z.boolean(),
          transactionDefaults: z.record(z.string(), z.unknown()),
          printProfile: z.record(z.string(), z.unknown()),
        })
        .strict(),
      v = schema.parse(raw),
      threshold = new Prisma.Decimal(v.expenseApprovalThreshold);
    if (threshold.isNegative()) throw new Error("INVALID_APPROVAL_THRESHOLD");
    const transactionDefaults = v.transactionDefaults as Prisma.InputJsonValue;
    const printProfile = v.printProfile as Prisma.InputJsonValue;
    return db.accountSettings.upsert({
      where: { companyId: a.companyId },
      create: {
        companyId: a.companyId,
        ...v,
        transactionDefaults,
        printProfile,
        expenseApprovalThreshold: threshold,
      },
      update: {
        ...v,
        transactionDefaults,
        printProfile,
        expenseApprovalThreshold: threshold,
      },
    });
  }
  if (section === "modules") {
    const v = z
      .object({
        businessType: z.enum([
          "INTERIOR_CONSTRUCTION",
          "RETAIL_TRADING",
          "SERVICE_BUSINESS",
          "MANUFACTURING",
          "OTHER_MIXED",
        ]),
        enabledModules: z.array(z.enum(IMPLEMENTED_ACCOUNT_MODULES)),
      })
      .parse(raw);
    return db.accountSettings.upsert({
      where: { companyId: a.companyId },
      create: {
        companyId: a.companyId,
        ...v,
        enabledModules: validateEnabledModules(v.enabledModules),
      },
      update: {
        ...v,
        enabledModules: validateEnabledModules(v.enabledModules),
      },
    });
  }
  if (section === "custom-fields") {
    const v = z
      .object({
        id: z.string().uuid().optional(),
        entityType: z.enum([
          "CUSTOMER",
          "VENDOR",
          "PRODUCT",
          "SERVICE",
          "PROJECT",
          "ASSET",
          "QUOTATION",
          "SALES_INVOICE",
          "PURCHASE_BILL",
        ]),
        fieldKey: z.string().regex(/^[a-z][a-z0-9_]{1,59}$/),
        label: z.string().min(1).max(100),
        dataType: z.enum([
          "TEXT",
          "TEXTAREA",
          "NUMBER",
          "DATE",
          "BOOLEAN",
          "SELECT",
        ]),
        isRequired: z.boolean(),
        position: z.number().int().min(0).max(1000),
        options: z.array(z.string()).optional(),
        isActive: z.boolean().optional(),
      })
      .parse(raw);
    if (v.dataType === "SELECT" && !v.options?.length)
      throw new Error("SELECT_OPTIONS_REQUIRED");
    const { id, ...data } = v;
    return id
      ? db.customFieldDefinition.updateMany({
          where: { id, companyId: a.companyId },
          data: { ...data, options: data.options ?? Prisma.JsonNull },
        })
      : db.customFieldDefinition.create({
          data: {
            ...data,
            companyId: a.companyId,
            options: data.options ?? Prisma.JsonNull,
          },
        });
  }
  if (section === "print-templates") {
    const v = z
      .object({
        documentType: z.enum([
          "INVOICE",
          "QUOTATION",
          "PURCHASE_ORDER",
          "RECEIPT",
          "BOQ",
        ]),
        name: z.string().min(1).max(120),
        paperSize: z.enum(["A4", "THERMAL_80MM"]),
        isDefault: z.boolean(),
        config: z.object({
          accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
          showBank: z.boolean(),
          showUpiQr: z.boolean(),
          showSignature: z.boolean(),
          footer: z.string().max(500),
        }),
        branchId: z.string().uuid().nullable().optional(),
      })
      .parse(raw);
    if (
      v.branchId &&
      !(await db.branch.findFirst({
        where: { id: v.branchId, companyId: a.companyId, ...branchWhere(a) },
      }))
    )
      throw new Error("MOBILE_FORBIDDEN");
    const latest = await db.printTemplate.aggregate({
      where: {
        companyId: a.companyId,
        branchId: v.branchId ?? null,
        documentType: v.documentType,
        name: v.name,
      },
      _max: { version: true },
    });
    return db.printTemplate.create({
      data: {
        ...v,
        branchId: v.branchId ?? null,
        companyId: a.companyId,
        version: (latest._max.version ?? 0) + 1,
        createdById: a.id,
      },
    });
  }
  throw new Error("INVALID_SECTION");
}
export async function mobileNotifications(u: MobileAppPrincipal) {
  const a = actor(u, "ACCOUNT_DASHBOARD");
  const rows = await db.expenseTransaction.findMany({
    where: {
      companyId: a.companyId,
      status: "PENDING_APPROVAL",
      ...(a.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: a.branchIds ?? [] } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      transactionNumber: true,
      reference: true,
      createdAt: true,
      totalAmount: true,
      status: true,
      branchId: true,
    },
  });
  return rows.map((x) => ({ ...x, type: "EXPENSE_APPROVAL", isRead: false }));
}
export async function mobileTax(
  u: MobileAppPrincipal,
  raw?: Record<string, string>,
) {
  const a = actor(u, "ACCOUNT_REPORTS");
  const settings = await db.accountSettings.findUnique({
      where: { companyId: a.companyId },
    }),
    branches = await db.branch.findMany({
      where: { companyId: a.companyId, isActive: true, ...branchWhere(a) },
      orderBy: { name: "asc" },
    });
  if (!raw) return { settings, branches };
  return { settings, branches, report: await gstReportForMobile(a, raw) };
}
async function gstReportForMobile(
  a: ReturnType<typeof mobileAccountActor>,
  raw: Record<string, string>,
) {
  const from = new Date(raw.from),
    to = new Date(raw.to);
  if (to < from) throw new Error("INVALID_DATE_RANGE");
  const branchId = raw.branchId || undefined;
  if (
    branchId &&
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !a.branchIds?.includes(branchId)
  )
    throw new Error("MOBILE_FORBIDDEN");
  const docs = await db.commercialDocument.findMany({
    where: {
      companyId: a.companyId,
      status: "POSTED",
      issueDate: { gte: from, lte: to },
      type: {
        in: ["SALES_INVOICE", "CREDIT_NOTE", "PURCHASE_BILL", "DEBIT_NOTE"],
      },
      ...(branchId
        ? { branchId }
        : a.branchAccessScope === "SELECTED_BRANCHES"
          ? { branchId: { in: a.branchIds ?? [] } }
          : {}),
    },
    orderBy: { issueDate: "asc" },
  });
  return docs;
}
export async function mobileSaveTax(u: MobileAppPrincipal, raw: unknown) {
  const a = admin(u);
  await assertOperationalWrite(a.companyId);
  const d = raw as Record<string, unknown>;
  if (d.branchId) {
    const branchId = String(d.branchId),
      v = taxProfileInput.parse(d.profile);
    if (
      a.branchAccessScope === "SELECTED_BRANCHES" &&
      !a.branchIds?.includes(branchId)
    )
      throw new Error("MOBILE_FORBIDDEN");
    return db.branch.updateMany({
      where: { id: branchId, companyId: a.companyId, isActive: true },
      data: {
        gstin: v.gstin ?? null,
        gstStateCode: v.stateCode,
        gstRegistrationType: v.registrationType,
      },
    });
  }
  const v = z
    .object({
      gstRegistrationType: z.enum([
        "UNREGISTERED",
        "REGULAR",
        "COMPOSITION",
        "SEZ",
      ]),
      defaultStateCode: z
        .string()
        .regex(/^\d{2}$/)
        .optional(),
      compositionEnabled: z.boolean(),
      defaultTaxMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]),
    })
    .parse(raw);
  if (v.compositionEnabled && v.gstRegistrationType !== "COMPOSITION")
    throw new Error("COMPOSITION_REGISTRATION_REQUIRED");
  return db.accountSettings.upsert({
    where: { companyId: a.companyId },
    create: { companyId: a.companyId, ...v },
    update: v,
  });
}
export async function mobileUtilities(u: MobileAppPrincipal, kind: string) {
  const a = actor(
    u,
    kind === "audit" || kind === "recycle-bin" || kind === "verification"
      ? "ACCOUNT_SETTINGS"
      : "ACCOUNT_REPORTS",
  );
  if (kind === "audit")
    return db.accountingAuditEvent.findMany({
      where: { companyId: a.companyId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { actor: { select: { name: true } } },
    });
  if (kind === "recycle-bin")
    return db.accountRecycleRecord.findMany({
      where: { companyId: a.companyId, restoredAt: null },
      orderBy: { archivedAt: "desc" },
      take: 100,
    });
  if (kind === "verification") return verifyAccountDataForActor(a);
  if (kind === "imports")
    return db.accountImportJob.findMany({
      where: { companyId: a.companyId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  throw new Error("INVALID_SECTION");
}

export async function mobileSignatureUpload(u: MobileAppPrincipal, file: File) {
  const a = admin(u);
  await assertOperationalWrite(a.companyId);
  const { uploadAuthorizedSignatureForActor } =
    await import("@/lib/account/signatures");
  return uploadAuthorizedSignatureForActor(a, file);
}
export async function mobileSignatureRemove(u: MobileAppPrincipal) {
  const a = admin(u);
  await assertOperationalWrite(a.companyId);
  const { removeCurrentAuthorizedSignatureForActor } =
    await import("@/lib/account/signatures");
  return removeCurrentAuthorizedSignatureForActor(a);
}
export async function mobileSignatureImage(u: MobileAppPrincipal) {
  const a = actor(u, "ACCOUNT_SETTINGS"),
    row = await db.authorizedSignatureVersion.findFirst({
      where: { companyId: a.companyId, isCurrent: true },
      orderBy: { createdAt: "desc" },
    });
  if (!row) throw new Error("SIGNATURE_NOT_FOUND");
  const { privateStorage } = await import("@/lib/storage");
  return privateStorage().get(row.objectKey);
}
export async function mobileImportPreview(
  u: MobileAppPrincipal,
  type: string,
  file: File,
  updateExisting: boolean,
) {
  const permission =
      type === "OPENING_BALANCES"
        ? "ACCOUNT_OPENING_BALANCE"
        : "ACCOUNT_ACCOUNTS",
    a = actor(u, permission);
  await assertOperationalWrite(a.companyId);
  if (file.size < 1 || file.size > 10 * 1024 * 1024)
    throw new Error("INVALID_IMPORT_FILE");
  const {
    ACCOUNT_IMPORT_TYPES,
    previewAccountImportForActor,
    saveImportPreviewForActor,
  } = await import("@/lib/account/imports");
  if (!ACCOUNT_IMPORT_TYPES.includes(type as never))
    throw new Error("UNSUPPORTED_IMPORT");
  const preview = await previewAccountImportForActor(a, {
    type: type as never,
    fileName: file.name,
    bytes: new Uint8Array(await file.arrayBuffer()),
    updateExisting,
  });
  const job = await saveImportPreviewForActor(a, preview);
  return { job, ...preview };
}
export async function mobileImportDetail(u: MobileAppPrincipal, id: string) {
  const a = actor(u, "ACCOUNT_ACCOUNTS"),
    row = await db.accountImportJob.findFirst({
      where: { id, companyId: a.companyId },
    });
  if (!row) throw new Error("MOBILE_FORBIDDEN");
  return row;
}
export async function mobileImportExecute(u: MobileAppPrincipal, id: string) {
  const a = actor(u, "ACCOUNT_ACCOUNTS");
  await assertOperationalWrite(a.companyId);
  const { executeAccountImportForActor } =
    await import("@/lib/account/imports");
  return executeAccountImportForActor(a, id);
}
export async function mobileExport(
  u: MobileAppPrincipal,
  type: string,
  format: string,
) {
  const a = actor(u, "ACCOUNT_REPORTS"),
    { exportAccountDataForActor } = await import("@/lib/account/exports");
  return exportAccountDataForActor(a, type, format);
}
export async function mobileBackup(u: MobileAppPrincipal) {
  const a = admin(u),
    { createAccountBackupForActor } = await import("@/lib/account/utilities");
  return createAccountBackupForActor(a);
}
export async function mobileRecycleRestore(u: MobileAppPrincipal, id: string) {
  const a = admin(u);
  await assertOperationalWrite(a.companyId);
  const { restoreMasterForActor } = await import("@/lib/account/utilities");
  return restoreMasterForActor(a, id);
}
export async function mobileAccountUsers(u: MobileAppPrincipal) {
  actor(u, "ACCOUNT_USER_ADMIN");
  const { getProductUserManagementContextForActor } =
    await import("@/lib/users/product-user-management");
  return getProductUserManagementContextForActor(u as never);
}
export async function mobileAccountUserSave(
  u: MobileAppPrincipal,
  raw: unknown,
  edit = false,
) {
  actor(u, "ACCOUNT_USER_ADMIN");
  await assertOperationalWrite(u.companyId);
  const service = await import("@/lib/users/product-user-management");
  return edit
    ? service.editAccountUserForActor(u as never, raw)
    : service.createAccountUserForActor(u as never, raw);
}

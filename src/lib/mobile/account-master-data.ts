import {normalizedItemPricing,pricingForLegacyEdit,retainItemMrp} from "@/lib/account/item-pricing";
import {assertItemUnitChangeInTx,assignUnitToItemsForActor,unitAssignmentOptionsForActor} from "@/lib/account/unit-assignment";
import {
  assertUnitAccess,
  saveUnitForActor,
  saveUnitConversionForActor,
} from "@/lib/account/units";
import { EFFECTIVE_SETTLEMENT } from "../account/settlement-policy";
import {
  itemCreationExtras,
  itemCreationHash,
  saveItemOpeningInTx,
  validateItemOpeningScopeInTx,
} from "@/lib/account/item-opening";
import { rethrowItemIdentifierConflict } from "@/lib/account/item-identifiers";
import { savedHsnCodes } from "@/lib/account/saved-hsn-codes";
import { saveCustomFieldValuesInTx } from "@/lib/account/custom-field-values";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  partySchema,
  itemSchema,
  categorySchema,
} from "@/lib/account/validation";
import { canUsePermission } from "@/lib/auth/permissions";
import { assertInventoryAvailable } from "@/lib/account/inventory";
import { setItemsActiveForActor } from "@/lib/account/service";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import type { MobileAppPrincipal } from "./auth";
import { validateMobileItemReferences } from "./account-master-references";
import { assertItemMasterCreation } from "@/lib/account/item-master-policy";
import { resolveItemSettings } from "@/lib/account/item-settings-policy";
import { resolvePartySettings } from "@/lib/account/party-settings";

type MasterKind =
  | "customers"
  | "vendors"
  | "items"
  | "services"
  | "warehouses"
  | "units"
  | "categories";
const warehouseSchema = z.object({
  branchId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  code: z.string().trim().min(1).max(60),
  address: z.string().trim().max(2000).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().optional(),
});
function publicItem<T extends object>(row: T) {
  return Object.fromEntries(
    Object.entries(row).filter(
      ([key]) => !["creationRequestKey", "creationRequestHash"].includes(key),
    ),
  ) as Omit<T, "creationRequestKey" | "creationRequestHash">;
}
const itemMobileSchema = itemSchema.extend({
  barcode: z.string().trim().max(120).optional(),
  trackInventory: z.boolean().default(false),
  trackingMode: z.enum(["NONE", "BATCH", "SERIAL"]).default("NONE"),
  lowStockThreshold: z.coerce.number().min(0).max(99999999999999).default(0),
  isActive: z.boolean().optional(),
});

function actor(user: MobileAppPrincipal, kind: MasterKind, write = false) {
  if (!user.authorizedWorkspaces.includes("ACCOUNT") || !user.accountRole)
    throw new Error("MOBILE_FORBIDDEN");
  const principal = {
    ...user,
    isActive: true,
    salesAccessActive: user.authorizedWorkspaces.includes("SALES"),
    accountAccessActive: true,
  };
  const permission = [
    "warehouses",
    "items",
    "services",
    "units",
    "categories",
  ].includes(kind)
    ? "ACCOUNT_STOCK"
    : "ACCOUNT_ACCOUNTS";
  if (!canUsePermission(principal, user.productEdition, permission))
    throw new Error("MOBILE_FORBIDDEN");
  if (write && user.accountRole === "PROJECT_MANAGER")
    throw new Error("MOBILE_FORBIDDEN");
  return principal;
}
const branchFilter = (user: MobileAppPrincipal) =>
  user.branchAccessScope === "SELECTED_BRANCHES"
    ? { branchId: { in: user.branchIds ?? [] } }
    : {};
const text = (value: Prisma.Decimal | null | undefined) =>
  value?.toString() ?? null;

export async function listMobileAccountMaster(
  user: MobileAppPrincipal,
  kind: MasterKind,
  query: {
    q?: string | null;
    active?: string | null;
    branchId?: string | null;
    id?: string;
    offset?: string | number | null;
  },
) {
  actor(user, kind);
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(10000000)
    .parse(query.offset ?? 0);
  const recordFilter = query.id ? { id: query.id } : {};
  const q = query.q?.trim().slice(0, 120),
    active =
      query.active === "all"
        ? undefined
        : query.active === "false"
          ? false
          : true;
  if (query.branchId && !(user.branchIds ?? []).includes(query.branchId))
    throw new Error("MOBILE_FORBIDDEN");
  if (kind === "customers")
    return db.customer.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        isAccountCustomer: true,
        ...(active === undefined ? {} : { isActive: active }),
        ...branchFilter(user),
        ...(query.branchId ? { branchId: query.branchId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { contactPerson: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { gstin: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
      select: {
        id: true,
        branchId: true,
        name: true,
        contactPerson: true,
        phone: true,
        email: true,
        address: true,
        billingAddress: true,
        shippingAddress: true,
        gstin: true,
        stateCode: true,
        gstRegistrationType: true,
        pan: true,
        notes: true,
        isActive: true,
        updatedAt: true,
      },
    });
  if (kind === "vendors")
    return db.vendor.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        ...(active === undefined ? {} : { isActive: active }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { contactPerson: { contains: q, mode: "insensitive" } },
                { phone: { contains: q } },
                { email: { contains: q, mode: "insensitive" } },
                { gstin: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
    });
  if (kind === "units") {
    await assertUnitAccess(actor(user, "units"));
    return db.accountUnit.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        ...(active === undefined ? {} : { isActive: active }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { symbol: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
    });
  }
  if (kind === "categories") {
    await requireInventory(user);
    return db.accountCategory.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        ...(active === undefined ? {} : { isActive: active }),
        ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
    });
  }
  if (kind === "services") {
    await requireInventory(user);
    const rows = await db.accountService.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        ...(active === undefined ? {} : { isActive: active }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { unit: { select: { id: true, name: true, symbol: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
    });
    return rows.map((row) => ({
      ...row,
      salePrice: text(row.sellingRate),
      costPrice: text(row.estimatedCost),
      taxRate: text(row.taxRate),
    }));
  }
  if (kind === "items") {
    await requireInventory(user);
    const rows = await db.accountProduct.findMany({
      where: {
        companyId: user.companyId,
        ...recordFilter,
        ...(active === undefined ? {} : { isActive: active }),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q } },
                { hsnCode: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        unit: { select: { id: true, name: true, symbol: true } },
        category: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 200,
      skip: offset,
    });
    return rows.map((row) => ({
      ...publicItem(row),
      salePrice: text(row.salePrice),
      costPrice: text(row.costPrice),
      taxRate: text(row.taxRate),
      lowStockThreshold: text(row.lowStockThreshold),
    }));
  }
  await requireInventory(user);
  return db.warehouse.findMany({
    where: {
      companyId: user.companyId,
      ...recordFilter,
      ...branchFilter(user),
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(active === undefined ? {} : { isActive: active }),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { address: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ branchId: "asc" }, { name: "asc" }],
    take: 200,
    skip: offset,
  });
}

export async function getMobileAccountMaster(
  user: MobileAppPrincipal,
  kind: MasterKind,
  id: string,
) {
  actor(user, kind);
  if (!z.string().uuid().safeParse(id).success)
    throw new Error("INVALID_INPUT");
  const rows = await listMobileAccountMaster(user, kind, { active: "all", id });
  const record = (rows as Array<{ id: string }>).find((row) => row.id === id);
  if (!record) throw new Error("MOBILE_FORBIDDEN");
  if (kind === "items" || kind === "services") {
    const customRows = await db.customFieldValue.findMany({
      where: {
        companyId: user.companyId,
        entityType: kind === "items" ? "PRODUCT" : "SERVICE",
        entityId: id,
        definition: { isActive: true },
      },
      include: { definition: { select: { fieldKey: true } } },
    });
    return {
      record: {
        ...record,
        customValues: Object.fromEntries(
          customRows.map((row) => [
            row.definition.fieldKey,
            typeof row.value === "string"
              ? row.value
              : JSON.stringify(row.value),
          ]),
        ),
      },
    };
  }
  if (kind !== "customers" && kind !== "vendors") return { record };
  const party = kind === "customers" ? { customerId: id } : { vendorId: id };
  const [documents, settlements, customRows] = await Promise.all([
    db.commercialDocument.findMany({
      where: {
        companyId: user.companyId,
        ...party,
        ...(kind === "customers" ? branchFilter(user) : {}),
      },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        documentNumber: true,
        issueDate: true,
        status: true,
        grandTotal: true,
        balanceDue: true,
      },
    }),
    db.accountSettlement.findMany({
      where: {
        ...EFFECTIVE_SETTLEMENT,
        companyId: user.companyId,
        ...party,
        ...(kind === "customers" ? branchFilter(user) : {}),
      },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        type: true,
        settlementNumber: true,
        transactionDate: true,
        amount: true,
      },
    }),
    db.customFieldValue.findMany({
      where: {
        companyId: user.companyId,
        entityType: kind === "customers" ? "CUSTOMER" : "VENDOR",
        entityId: id,
      },
      include: { definition: { select: { fieldKey: true } } },
    }),
  ]);
  return {
    record: {
      ...record,
      customValues: Object.fromEntries(
        customRows.map((row) => [
          row.definition.fieldKey,
          typeof row.value === "string" ? row.value : JSON.stringify(row.value),
        ]),
      ),
    },
    documents: documents.map((x) => ({
      ...x,
      grandTotal: text(x.grandTotal),
      balanceDue: text(x.balanceDue),
    })),
    settlements: settlements.map((x) => ({ ...x, amount: text(x.amount) })),
  };
}

export async function saveMobileAccountMaster(
  user: MobileAppPrincipal,
  kind: MasterKind,
  raw: unknown,
  id?: string,
) {
  actor(user, kind, true);
  await assertOperationalWrite(user.companyId);
  if (id && !z.string().uuid().safeParse(id).success)
    throw new Error("INVALID_INPUT");
  if (kind === "customers" || kind === "vendors") {
    const parsed = partySchema
        .extend({
          branchId: z.string().uuid().optional(),
          isActive: z.boolean().optional(),
          customFields: z.record(z.string(), z.string()).optional(),
        })
        .parse(raw),
      { customFields = {}, ...input } = parsed;
    const entityId = await db.$transaction(async (tx) => {
      let entityId = id;
      if (kind === "customers") {
        const branchId = input.branchId;
        if (
          !branchId ||
          (user.branchAccessScope === "SELECTED_BRANCHES" &&
            !(user.branchIds ?? []).includes(branchId)) ||
          !(await tx.branch.findFirst({
            where: { id: branchId, companyId: user.companyId, isActive: true },
          }))
        )
          throw new Error("MOBILE_FORBIDDEN");
        const data = {
          name: input.name,
          contactPerson: input.contactPerson,
          phone: input.phone,
          email: input.email,
          address: input.address,
          billingAddress: input.address,
          shippingAddress: input.shippingAddress,
          gstin: input.gstin,
          stateCode: input.stateCode,
          gstRegistrationType: input.gstRegistrationType,
          pan: input.pan,
          notes: input.notes,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        };
        if (!entityId)
          entityId = (
            await tx.customer.create({
              data: {
                ...data,
                branchId,
                companyId: user.companyId,
                isAccountCustomer: true,
              },
            })
          ).id;
        else if (
          (
            await tx.customer.updateMany({
              where: {
                id: entityId,
                companyId: user.companyId,
                isAccountCustomer: true,
                ...branchFilter(user),
              },
              data,
            })
          ).count !== 1
        )
          throw new Error("MOBILE_FORBIDDEN");
      } else {
        const data = {
          name: input.name,
          contactPerson: input.contactPerson,
          phone: input.phone,
          email: input.email,
          address: input.address,
          gstin: input.gstin,
          stateCode: input.stateCode,
          gstRegistrationType: input.gstRegistrationType,
          pan: input.pan,
          notes: input.notes,
          ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        };
        if (!entityId)
          entityId = (
            await tx.vendor.create({
              data: { ...data, companyId: user.companyId },
            })
          ).id;
        else if (
          (
            await tx.vendor.updateMany({
              where: { id: entityId, companyId: user.companyId },
              data,
            })
          ).count !== 1
        )
          throw new Error("MOBILE_FORBIDDEN");
      }
      await saveCustomFieldValuesInTx(
        tx,
        user.companyId,
        kind === "customers" ? "CUSTOMER" : "VENDOR",
        entityId!,
        customFields,
        !!id,
      );
      return entityId!;
    });
    return getMobileAccountMaster(user, kind, entityId!);
  }
  await requireInventory(user);
  if (kind === "units")
    return saveUnitForActor(actor(user, "units", true), raw, id);
  if (kind === "categories") {
    const input = categorySchema.parse(raw);
    if (!id)
      return db.accountCategory.create({
        data: { companyId: user.companyId, ...input },
      });
    const changed = await db.accountCategory.updateMany({
      where: { id, companyId: user.companyId },
      data: input,
    });
    if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN");
    return getMobileAccountMaster(user, kind, id);
  }
  if (kind === "services") {
    const input = itemSchema
        .extend({
          isActive: z.boolean().optional(),
          customFields: z.record(z.string(), z.string()).default({}),
        })
        .parse(raw),
      data = {
        name: input.name,
        code: input.code,
        categoryId: input.categoryId,
        unitId: input.unitId,
        description: input.description,
        sellingRate: input.sellingRate,
        estimatedCost: input.cost,
        taxRate: input.taxRate,
        sacCode: input.hsnSacCode,
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      };
    await validateMobileItemReferences(user.companyId, input, "SERVICE");
    const row = await db
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${user.companyId}::uuid FOR UPDATE`;
        const settings = await tx.accountSettings.findUnique({
          where: { companyId: user.companyId },
          select: { itemSettings: true },
        });
        const policy = resolveItemSettings(settings?.itemSettings);
        if (!id) assertItemMasterCreation(policy, "SERVICE", input);
        const price=normalizedItemPricing(input,policy,raw);
        let pricedData={...data,sellingRate:price.saleRate,estimatedCost:price.costRate,...(price.pricing?{pricing:price.pricing}:{})};
        const row = id
          ? await tx.accountService.findFirst({
              where: { id, companyId: user.companyId },
            })
          : await tx.accountService.create({
              data: { ...pricedData, companyId: user.companyId },
            });
        if (!row) throw new Error("MOBILE_FORBIDDEN");
        if (id) {if(input.pricing&&price.pricing)pricedData={...pricedData,pricing:retainItemMrp(price.pricing,row.pricing,input.taxRate??row.taxRate)};if(!input.pricing){const kept=pricingForLegacyEdit({pricing:row.pricing,saleRate:row.sellingRate,costRate:row.estimatedCost,taxRate:row.taxRate},input,policy,raw);if(kept)pricedData={...pricedData,sellingRate:kept.saleRate,estimatedCost:kept.costRate,...(kept.pricing?{pricing:kept.pricing}:{})};}if(data.unitId!==undefined&&data.unitId!==row.unitId){await assertUnitAccess(actor(user,"units",true),tx);await assertItemUnitChangeInTx(tx,user.companyId,"SERVICE",row.id,row.unitId,data.unitId);}await tx.accountService.update({ where: { id: row.id }, data:pricedData });}
        if (policy.customFields)
          await saveCustomFieldValuesInTx(
            tx,
            user.companyId,
            "SERVICE",
            row.id,
            input.customFields,
            !!id,
          );
        return row;
      })
      .catch(rethrowItemIdentifierConflict);
    return id ? getMobileAccountMaster(user, kind, row.id) : row;
  }
  if (kind === "items") {
    const input = itemMobileSchema
      .extend({ customFields: z.record(z.string(), z.string()).default({}) })
      .parse(raw);
    const extras = itemCreationExtras.parse(raw);
    if (id && (extras.openingStock || extras.creationRequestKey))
      throw new Error("OPENING_CREATE_ONLY");
    const requestHash = extras.creationRequestKey
      ? itemCreationHash(itemSchema.parse(raw), input.customFields, extras,raw)
      : undefined;
    await validateMobileItemReferences(user.companyId, input, "PRODUCT");
    if (!input.trackInventory && input.trackingMode !== "NONE")
      throw new Error("INVALID_INPUT");
    const data = {
      name: input.name,
      code: input.code,
      categoryId: input.categoryId,
      unitId: input.unitId,
      description: input.description,
      salePrice: input.sellingRate,
      costPrice: input.cost,
      taxRate: input.taxRate,
      hsnCode: input.hsnSacCode,
      barcode: input.barcode,
      trackInventory: input.trackInventory,
      trackingMode: input.trackingMode,
      lowStockThreshold: input.lowStockThreshold,
      ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
    };
    const row = await db
      .$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${user.companyId}::uuid FOR UPDATE`;
        if (!id && extras.creationRequestKey) {
          await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${user.companyId}::uuid FOR UPDATE`;
          await validateItemOpeningScopeInTx(
            tx,
            {
              ...user,
              isActive: true,
              accountAccessActive: true,
              salesAccessActive: user.authorizedWorkspaces.includes("SALES"),
            } as import("@/lib/account/projects").ProjectActor,
            extras,
          );
          const previous = await tx.accountProduct.findUnique({
            where: {
              companyId_creationRequestKey: {
                companyId: user.companyId,
                creationRequestKey: extras.creationRequestKey,
              },
            },
          });
          if (previous) {
            if (previous.creationRequestHash !== requestHash)
              throw new Error("IDEMPOTENCY_CONFLICT");
            return previous;
          }
        }
        const settings = await tx.accountSettings.findUnique({
          where: { companyId: user.companyId },
          select: { itemSettings: true },
        });
        const policy = resolveItemSettings(settings?.itemSettings);
        if (!id) assertItemMasterCreation(policy, "PRODUCT", input);
        const price=normalizedItemPricing(input,policy,raw);
        let pricedData={...data,salePrice:price.saleRate,costPrice:price.costRate,...(price.pricing?{pricing:price.pricing}:{})};
        if (
          !policy.stockMaintenance &&
          (extras.openingStock || extras.itemLocation)
        )
          throw new Error("STOCK_FIELDS_DISABLED");
        const row = id
          ? await tx.accountProduct.findFirst({
              where: { id, companyId: user.companyId },
            })
          : await tx.accountProduct.create({
              data: {
                ...pricedData,
                companyId: user.companyId,
                creationRequestKey: extras.creationRequestKey,
                creationRequestHash: requestHash,
                itemLocation: extras.itemLocation,
              },
            });
        if (!row) throw new Error("MOBILE_FORBIDDEN");
        if (id) {if(input.pricing&&price.pricing)pricedData={...pricedData,pricing:retainItemMrp(price.pricing,row.pricing,input.taxRate??row.taxRate)};if(!input.pricing){const kept=pricingForLegacyEdit({pricing:row.pricing,saleRate:row.salePrice,costRate:row.costPrice,taxRate:row.taxRate},input,policy,raw);if(kept)pricedData={...pricedData,salePrice:kept.saleRate,costPrice:kept.costRate,...(kept.pricing?{pricing:kept.pricing}:{})};}if(data.unitId!==undefined&&data.unitId!==row.unitId){await assertUnitAccess(actor(user,"units",true),tx);await assertItemUnitChangeInTx(tx,user.companyId,"PRODUCT",row.id,row.unitId,data.unitId);}await tx.accountProduct.update({ where: { id: row.id }, data:pricedData });}
        if (policy.customFields)
          await saveCustomFieldValuesInTx(
            tx,
            user.companyId,
            "PRODUCT",
            row.id,
            input.customFields,
            !!id,
          );
        if (!id)
          await saveItemOpeningInTx(
            tx,
            {
              ...user,
              isActive: true,
              accountAccessActive: true,
              salesAccessActive: user.authorizedWorkspaces.includes("SALES"),
            } as import("@/lib/account/projects").ProjectActor,
            row,
            extras,
          );
        return row;
      })
      .catch(rethrowItemIdentifierConflict);
    return id ? getMobileAccountMaster(user, kind, row.id) : publicItem(row);
  }
  const parsedWarehouse = warehouseSchema.parse(raw);
  const input = { ...parsedWarehouse, isDefault: parsedWarehouse.isActive === false ? false : parsedWarehouse.isDefault };
  if (
    (user.branchAccessScope === "SELECTED_BRANCHES" && !(user.branchIds ?? []).includes(input.branchId)) ||
    !(await db.branch.findFirst({
      where: { id: input.branchId, companyId: user.companyId, isActive: true },
    }))
  )
    throw new Error("MOBILE_FORBIDDEN");
  return db.$transaction(async (tx) => {
    if (input.isDefault)
      await tx.warehouse.updateMany({
        where: {
          companyId: user.companyId,
          branchId: input.branchId,
          isDefault: true,
          ...(id ? { id: { not: id } } : {}),
        },
        data: { isDefault: false },
      });
    if (!id)
      return tx.warehouse.create({
        data: { ...input, companyId: user.companyId },
      });
    const changed = await tx.warehouse.updateMany({
      where: { id, companyId: user.companyId, ...branchFilter(user) },
      data: input,
    });
    if (changed.count !== 1) throw new Error("MOBILE_FORBIDDEN");
    return tx.warehouse.findUniqueOrThrow({ where: { id } });
  });
}

export async function mobileMasterOptions(
  user: MobileAppPrincipal,
  kind: MasterKind = "customers",
) {
  actor(user, kind);
  if (kind === "units") await assertUnitAccess(actor(user, "units"));
  if (["warehouses", "items", "services", "units", "categories"].includes(kind))
    await requireInventory(user);
  const [branches, units, categories, settings, partyCustomFields] =
    await Promise.all([
      db.branch.findMany({
        where: {
          companyId: user.companyId,
          isActive: true,
          ...(user.branchAccessScope === "SELECTED_BRANCHES"
            ? { id: { in: user.branchIds ?? [] } }
            : {}),
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.accountUnit.findMany({
        where: { companyId: user.companyId, isActive: true },
        select: { id: true, name: true, symbol: true },
        orderBy: { name: "asc" },
      }),
      db.accountCategory.findMany({
        where: {
          companyId: user.companyId,
          isActive: true,
          scope: { in: [kind === "services" ? "SERVICE" : "PRODUCT", "BOTH"] },
        },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      db.accountSettings.findUnique({
        where: { companyId: user.companyId },
        select: { transactionDefaults: true, itemSettings: true },
      }),
      db.customFieldDefinition.findMany({
        where: {
          companyId: user.companyId,
          entityType:
            kind === "vendors"
              ? "VENDOR"
              : kind === "items"
                ? "PRODUCT"
                : kind === "services"
                  ? "SERVICE"
                  : "CUSTOMER",
          isActive: true,
        },
        select: {
          fieldKey: true,
          label: true,
          dataType: true,
          isRequired: true,
          options: true,
        },
        orderBy: { position: "asc" },
      }),
    ]);
  return {
    branches,
    warehouses:
      kind === "items" &&
      resolveItemSettings(settings?.itemSettings).stockMaintenance
        ? await db.warehouse.findMany({
            where: {
              companyId: user.companyId,
              isActive: true,
              branchId: { in: branches.map((branch) => branch.id) },
            },
            select: { id: true, name: true },
            orderBy: [{ isDefault: "desc" }, { name: "asc" }, { id: "asc" }],
          })
        : [],
    units,
    unitConversions:
      kind === "units"
        ? ((settings?.itemSettings as Prisma.JsonObject | null)
            ?.unitConversions ?? [])
        : [],
    categories,
    canManageItemSettings: user.accountRole === "ACCOUNT_ADMIN",
    hsnCodes:
      ["items", "services"].includes(kind) &&
      resolveItemSettings(settings?.itemSettings).hsnSac
        ? await savedHsnCodes(user.companyId)
        : [],
    partySettings: resolvePartySettings(settings?.transactionDefaults),
    itemSettings: ["items", "services"].includes(kind)
      ? resolveItemSettings(settings?.itemSettings)
      : {},
    partyCustomFields: ["customers", "vendors", "items", "services"].includes(
      kind,
    )
      ? partyCustomFields.map((field) => ({
          ...field,
          options: Array.isArray(field.options)
            ? field.options.filter((v): v is string => typeof v === "string")
            : [],
        }))
      : [],
  };
}
async function requireInventory(user: MobileAppPrincipal) {
  await assertInventoryAvailable(user);
}
export const MOBILE_MASTER_KINDS = new Set<MasterKind>([
  "customers",
  "vendors",
  "items",
  "services",
  "warehouses",
  "units",
  "categories",
]);

export async function bulkSetMobileItemsActive(
  user: MobileAppPrincipal,
  kind: "items" | "services",
  ids: string[],
  isActive: boolean,
) {
  actor(user, kind, true);
  await assertOperationalWrite(user.companyId);
  await requireInventory(user);
  const validated = z.enum(["items", "services"]).parse(kind);
  return setItemsActiveForActor(
    user,
    validated === "items" ? "products" : "services",
    ids,
    isActive,
  );
}
export async function saveMobileUnitConversion(
  user: MobileAppPrincipal,
  raw: unknown,
) {
  const principal = actor(user, "units", true);
  await assertOperationalWrite(user.companyId);
  const result = await saveUnitConversionForActor(principal, raw);
  return { ok: true, conversion: result.conversion };
}

export async function mobileAssignUnitToItems(user:MobileAppPrincipal,raw:unknown){const principal=actor(user,"units",true);await assertOperationalWrite(user.companyId);return assignUnitToItemsForActor(principal,raw);}
export async function mobileUnitAssignmentOptions(user:MobileAppPrincipal,raw:unknown){return unitAssignmentOptionsForActor(actor(user,"units",false),raw);}

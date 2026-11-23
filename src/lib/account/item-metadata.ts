import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { assertInventoryAvailable } from "./inventory";
import { pricingForLegacyEdit } from "./item-pricing";
import { resolveItemSettings } from "./item-settings-policy";
export const itemKinds = z.enum(["products", "services", "work-packages"]);
export type ItemKind = z.infer<typeof itemKinds>;
const amount = z.string().regex(/^\d{1,14}(?:\.\d{1,2})?$/);
export const itemMetadataSchema = z
  .object({
    id: z.string().guid(),
    expectedUpdatedAt: z.string().datetime(),
    name: z.string().trim().min(1).max(200),
    code: z
      .string()
      .trim()
      .max(60)
      .transform((v) => v.toUpperCase())
      .optional(),
    description: z.string().trim().max(2000).optional(),
    sellingRate: amount.optional(),
    taxRate: amount.refine((v) => new Prisma.Decimal(v).lte(100)).optional(),
  })
  .strict();
const select = {
  id: true,
  updatedAt: true,
  name: true,
  code: true,
  description: true,
} as const;
export async function itemMetadataForEdit(kind: ItemKind, id: string) {
  itemKinds.parse(kind);
  z.string().guid().parse(id);
  const actor = await requirePermission("ACCOUNT_ACCOUNTS");
  if (!actor.companyId) throw new AuthorizationError();
  await assertInventoryAvailable(actor);
  const where = { id, companyId: actor.companyId, isActive: true };
  const row =
    kind === "products"
      ? await db.accountProduct.findFirst({
          where,
          select: { ...select, salePrice: true, taxRate: true },
        })
      : kind === "services"
        ? await db.accountService.findFirst({
            where,
            select: { ...select, sellingRate: true, taxRate: true },
          })
        : await db.workPackage.findFirst({
            where,
            select: { ...select, sellingRate: true },
          });
  if (!row) throw new Error("ITEM_NOT_FOUND");
  return {
    id: row.id,
    updatedAt: row.updatedAt.toISOString(),
    name: row.name,
    code: row.code ?? "",
    description: row.description ?? "",
    sellingRate:
      ("salePrice" in row ? row.salePrice : row.sellingRate)?.toString() ?? "",
    taxRate: "taxRate" in row ? (row.taxRate?.toString() ?? "") : null,
  };
}
export async function editItemMetadata(kind: ItemKind, raw: unknown) {
  itemKinds.parse(kind);
  const actor = await requirePermissionForMutation("ACCOUNT_ACCOUNTS");
  if (!actor.companyId) throw new AuthorizationError();
  await assertInventoryAvailable(actor);
  const d = itemMetadataSchema.parse(raw);
  if (kind === "work-packages" && d.taxRate !== undefined)
    throw new Error("INVALID_INPUT");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR UPDATE`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId + ":account-settings"}))`;
    const company = await tx.company.findUnique({
      where: { id: actor.companyId! },
      select: { productEdition: true },
    });
    if (
      !company ||
      !["SALESPUNCH360_ACCOUNT", "SALESPUNCH360_PLUS"].includes(
        company.productEdition,
      )
    )
      throw new AuthorizationError();
    await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid AND "companyId"=${actor.companyId}::uuid FOR SHARE`;
    const user = await tx.user.findFirst({
      where: {
        id: actor.id,
        companyId: actor.companyId!,
        isActive: true,
        accountAccessActive: true,
      },
      select: { accountRole: true },
    });
    if (
      !user?.accountRole ||
      !ACCOUNT_ROLE_PERMISSIONS[user.accountRole].includes("ACCOUNT_ACCOUNTS")
    )
      throw new AuthorizationError();
    const settings = await tx.accountSettings.findUnique({
      where: { companyId: actor.companyId! },
      select: { itemSettings: true },
    });
    const policy = resolveItemSettings(settings?.itemSettings);
    if (!policy.enabled) throw new Error("ITEMS_DISABLED");
    const where = {
      id: d.id,
      companyId: actor.companyId!,
      isActive: true,
      updatedAt: new Date(d.expectedUpdatedAt),
    };
    const metadata = {
      name: d.name,
      ...(d.code !== undefined ? { code: d.code || null } : {}),
      ...(d.description !== undefined
        ? { description: d.description || null }
        : {}),
    };
    let changed;
    if (kind === "work-packages") {
      changed = await tx.workPackage.updateMany({
        where,
        data: {
          ...metadata,
          ...(d.sellingRate !== undefined
            ? { sellingRate: new Prisma.Decimal(d.sellingRate) }
            : {}),
        },
      });
    } else {
      const row =
        kind === "products"
          ? await tx.accountProduct.findFirst({ where })
          : await tx.accountService.findFirst({ where });
      if (!row) throw new Error("ITEM_STALE");
      const priceChanged =
        d.sellingRate !== undefined || d.taxRate !== undefined;
      const prices = priceChanged
        ? pricingForLegacyEdit(
            {
              pricing: row.pricing,
              saleRate: "salePrice" in row ? row.salePrice : row.sellingRate,
              costRate: "costPrice" in row ? row.costPrice : row.estimatedCost,
              taxRate: row.taxRate,
            },
            d,
            policy,
          )
        : null;
      const extra = {
        ...(d.taxRate !== undefined
          ? { taxRate: new Prisma.Decimal(d.taxRate) }
          : {}),
        ...(prices && "pricing" in prices ? { pricing: prices.pricing } : {}),
      };
      // Legacy price recalculation preserves the entered inclusive/exclusive and discount choices.
      // Costs, stock, unit mappings, custom fields and posted document snapshots are never patched here.
      changed =
        kind === "products"
          ? await tx.accountProduct.updateMany({
              where,
              data: {
                ...metadata,
                ...extra,
                ...(prices?.saleRate !== undefined
                  ? { salePrice: prices.saleRate }
                  : d.sellingRate !== undefined
                    ? { salePrice: new Prisma.Decimal(d.sellingRate) }
                    : {}),
              },
            })
          : await tx.accountService.updateMany({
              where,
              data: {
                ...metadata,
                ...extra,
                ...(prices?.saleRate !== undefined
                  ? { sellingRate: prices.saleRate }
                  : d.sellingRate !== undefined
                    ? { sellingRate: new Prisma.Decimal(d.sellingRate) }
                    : {}),
              },
            });
    }
    if (changed.count !== 1) throw new Error("ITEM_STALE");
    const saved =
      kind === "products"
        ? await tx.accountProduct.findFirstOrThrow({
            where: { id: d.id, companyId: actor.companyId! },
            select,
          })
        : kind === "services"
          ? await tx.accountService.findFirstOrThrow({
              where: { id: d.id, companyId: actor.companyId! },
              select,
            })
          : await tx.workPackage.findFirstOrThrow({
              where: { id: d.id, companyId: actor.companyId! },
              select,
            });
    return { id: saved.id, updatedAt: saved.updatedAt.toISOString() };
  });
}

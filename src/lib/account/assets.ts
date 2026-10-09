import { retrySerializable } from "./transaction-retry";
import { createHash } from "node:crypto";
import {
  AssetStatus,
  AssetType,
  DepreciationMethod,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { requireAccountModules } from "./modules";
import { allocateDocumentNumberInTx } from "./numbering";
import type { ProjectActor } from "./projects";
const D = Prisma.Decimal,
  money = z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
  base = z
    .object({
      name: z.string().trim().min(1).max(240),
      assetType: z.nativeEnum(AssetType),
      category: z.string().max(120).nullable().optional(),
      hsnCode: z
        .string()
        .regex(/^(?:\d{4}|\d{6}|\d{8})$/)
        .nullable()
        .optional(),
      openingQuantity: z
        .string()
        .regex(/^\d{1,14}(\.\d{1,4})?$/)
        .nullable()
        .optional(),
      unitPrice: money.nullable().optional(),
      effectiveDate: z.coerce.date().nullable().optional(),
      purchaseDate: z.coerce.date(),
      purchaseValue: money,
      vendorId: z.string().uuid().nullable().optional(),
      purchaseDocumentId: z.string().uuid().nullable().optional(),
      purchaseDocumentLineId: z.string().uuid().nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      serialNumber: z.string().max(160).nullable().optional(),
      registrationNumber: z.string().max(80).nullable().optional(),
      makeModel: z.string().max(160).nullable().optional(),
      manufactureYear: z.coerce
        .number()
        .int()
        .min(1900)
        .max(2200)
        .nullable()
        .optional(),
      location: z.string().max(240).nullable().optional(),
      depreciationMethod: z.nativeEnum(DepreciationMethod).default("NONE"),
      usefulLifeMonths: z.coerce
        .number()
        .int()
        .positive()
        .nullable()
        .optional(),
      salvageValue: money.default("0"),
      depreciationStartDate: z.coerce.date().nullable().optional(),
      assetLedgerId: z.string().uuid().nullable().optional(),
      accumulatedDepreciationLedgerId: z.string().uuid().nullable().optional(),
      depreciationExpenseLedgerId: z.string().uuid().nullable().optional(),
    })
    .strict(),
  createInput = base.extend({
    branchId: z.string().uuid(),
    requestKey: z.string().uuid().optional(),
  });
export async function assertAssetAccess(a: ProjectActor) {
  if (
    !a.companyId ||
    !["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(a.accountRole ?? "")
  )
    throw new AuthorizationError();
  await requireAccountModules(a, "ASSETS");
}
async function actor(write = false) {
  const a = (
    write
      ? await requirePermissionForMutation("ACCOUNT_ACCOUNTS")
      : await requirePermission("ACCOUNT_ACCOUNTS")
  ) as ProjectActor;
  await requireAccountModules(a, "ASSETS");
  if (!["ACCOUNT_ADMIN", "ACCOUNTANT"].includes(a.accountRole ?? ""))
    throw new AuthorizationError();
  return a;
}
const branchWhere = (a: ProjectActor) =>
  a.branchAccessScope === "SELECTED_BRANCHES"
    ? { branchId: { in: a.branchIds ?? [] } }
    : {};
async function validateLinks(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
  branchId: string,
  d: z.infer<typeof base>,
  previousVendorId?: string | null,
) {
  if (
    d.vendorId &&
    !(await tx.vendor.findFirst({
      where: {
        id: d.vendorId,
        companyId: a.companyId,
        ...(previousVendorId === d.vendorId ? {} : { isActive: true }),
      },
    }))
  )
    throw new Error("INVALID_ASSET_VENDOR");
  let value = new D(d.purchaseValue);
  if (d.purchaseDocumentId) {
    const doc = await tx.commercialDocument.findFirst({
      where: {
        id: d.purchaseDocumentId,
        companyId: a.companyId,
        branchId,
        type: "PURCHASE_BILL",
        status: "POSTED",
        ...(d.vendorId ? { vendorId: d.vendorId } : {}),
      },
    });
    if (!doc) throw new AuthorizationError();
    if (d.purchaseDocumentLineId) {
      const line = await tx.commercialDocumentLine.findFirst({
        where: {
          id: d.purchaseDocumentLineId,
          companyId: a.companyId,
          documentId: doc.id,
        },
      });
      if (!line) throw new AuthorizationError();
      value = line.taxableAmount;
    }
  } else if (d.purchaseDocumentLineId)
    throw new Error("PURCHASE_DOCUMENT_REQUIRED");
  if (d.openingQuantity != null || d.unitPrice != null) {
    if (
      d.openingQuantity == null ||
      d.unitPrice == null ||
      !d.effectiveDate ||
      new D(d.openingQuantity).lte(0)
    )
      throw new Error("OPENING_VALUATION_REQUIRED");
    const openingValue = new D(d.openingQuantity)
      .mul(d.unitPrice)
      .toDecimalPlaces(2);
    if (!openingValue.equals(value)) throw new Error("OPENING_VALUE_MISMATCH");
  }
  const specs = [
    [d.assetLedgerId, "ASSET"],
    [d.accumulatedDepreciationLedgerId, "ASSET"],
    [d.depreciationExpenseLedgerId, "EXPENSE"],
  ] as const;
  for (const [id, accountClass] of specs)
    if (
      id &&
      !(await tx.ledgerAccount.findFirst({
        where: {
          id,
          companyId: a.companyId,
          accountClass,
          isActive: true,
          allowPosting: true,
        },
      }))
    )
      throw new Error("INVALID_ASSET_LEDGER");
  if (
    d.depreciationMethod !== "NONE" &&
    (!d.usefulLifeMonths || !d.depreciationStartDate)
  )
    throw new Error("DEPRECIATION_CONFIGURATION_REQUIRED");
  if (new D(d.salvageValue).gt(value)) throw new Error("SALVAGE_EXCEEDS_VALUE");
  return value;
}
export async function listAssetsForActor(a: ProjectActor, raw: unknown = {}) {
  await assertAssetAccess(a);
  const input = z
    .object({
      q: z.string().trim().max(240).default(""),
      status: z.nativeEnum(AssetStatus).optional(),
      offset: z.coerce.number().int().min(0).default(0),
      limit: z.coerce.number().int().min(1).max(100).default(50),
    })
    .strict()
    .parse(raw);
  const rows = await db.asset.findMany({
    where: {
      companyId: a.companyId,
      ...branchWhere(a),
      ...(input.status ? { status: input.status } : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { assetNumber: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: input.offset,
    take: input.limit + 1,
  });
  return {
    items: rows.slice(0, input.limit),
    hasMore: rows.length > input.limit,
    offset: input.offset,
    limit: input.limit,
  };
}
export async function assetOptionsForActor(a: ProjectActor) {
  await assertAssetAccess(a);
  const branches = await db.branch.findMany({
    where: {
      companyId: a.companyId,
      isActive: true,
      ...(a.branchAccessScope === "SELECTED_BRANCHES"
        ? { id: { in: a.branchIds ?? [] } }
        : {}),
    },
  });
  return {
    branches,
    hsnCodes: (
      await db.accountProduct.findMany({
        where: { companyId: a.companyId, hsnCode: { not: null } },
        select: { hsnCode: true },
        distinct: ["hsnCode"],
        take: 500,
      })
    )
      .map((x) => x.hsnCode!)
      .filter((x) => /^(?:\d{4}|\d{6}|\d{8})$/.test(x)),
    vendors: await db.vendor.findMany({
      where: { companyId: a.companyId, isActive: true },
    }),
    purchases: await db.commercialDocument.findMany({
      where: {
        companyId: a.companyId,
        status: "POSTED",
        type: "PURCHASE_BILL",
        branchId: { in: branches.map((x) => x.id) },
      },
      include: { lines: true },
    }),
    users: await db.user.findMany({
      where: { companyId: a.companyId, isActive: true },
      select: {
        id: true,
        name: true,
        branchAccessScope: true,
        branchAccesses: { select: { branchId: true } },
      },
    }),
    ledgers: await db.ledgerAccount.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        allowPosting: true,
        accountClass: { in: ["ASSET", "EXPENSE"] },
      },
    }),
  };
}
export async function createAssetForActor(a: ProjectActor, raw: unknown) {
  await assertAssetAccess(a);
  const d = createInput.parse(raw);
  if (
    a.branchAccessScope === "SELECTED_BRANCHES" &&
    !a.branchIds?.includes(d.branchId)
  )
    throw new AuthorizationError();
  if (
    !(await db.branch.findFirst({
      where: {
        id: d.branchId,
        companyId: a.companyId,
        isActive: true,
      },
    }))
  )
    throw new AuthorizationError();
  return retrySerializable(() =>
    db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${a.companyId + ":asset-number"}))`;
        const { requestKey, ...values } = d;
        const requestHash = createHash("sha256")
          .update(JSON.stringify(values))
          .digest("hex");
        if (requestKey) {
          const existing = await tx.asset.findUnique({
            where: {
              companyId_creationRequestKey: {
                companyId: a.companyId,
                creationRequestKey: requestKey,
              },
            },
          });
          if (existing) {
            if (existing.creationRequestHash !== requestHash)
              throw new Error("IDEMPOTENCY_KEY_REUSED");
            return existing;
          }
        }
        const numberingBranch = await tx.branch.findFirst({
          where: { companyId: a.companyId, isActive: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: { id: true },
        });
        if (!numberingBranch) throw new Error("ACTIVE_BRANCH_REQUIRED");
        const purchaseValue = await validateLinks(tx, a, d.branchId, d),
          firstNumber = await allocateDocumentNumberInTx(tx, {
            companyId: a.companyId!,
            branchId: numberingBranch.id,
            seriesKey: "ASSET",
            defaults: { prefix: "AST-", padding: 6 },
          }),
          reservedNumber = firstNumber;
        let assetNumber = reservedNumber;
        // Old branch-local series may already have allocated this company number.
        while (
          await tx.asset.findUnique({
            where: {
              companyId_assetNumber: { companyId: a.companyId, assetNumber },
            },
          })
        ) {
          assetNumber = await allocateDocumentNumberInTx(tx, {
            companyId: a.companyId,
            branchId: numberingBranch.id,
            seriesKey: "ASSET",
            defaults: { prefix: "AST-", padding: 6 },
          });
        }
        const row = await tx.asset.create({
          data: {
            ...values,
            creationRequestKey: requestKey,
            creationRequestHash: requestKey ? requestHash : undefined,
            companyId: a.companyId!,
            assetNumber,
            purchaseValue,
            salvageValue: new D(d.salvageValue),
            createdById: a.id,
          },
        });
        await audit(tx, a, "ASSET_CREATED", row.id);
        return row;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}
async function scoped(
  a: ProjectActor,
  id: string,
  client: Pick<Prisma.TransactionClient, "asset"> = db,
) {
  await assertAssetAccess(a);
  const row = await client.asset.findFirst({
    where: { id, companyId: a.companyId, ...branchWhere(a) },
  });
  if (!row) throw new AuthorizationError();
  return row;
}
export async function getAssetForActor(a: ProjectActor, id: string) {
  const asset = await scoped(a, id);
  return {
    asset,
    history: await db.assetAssignmentHistory.findMany({
      where: { companyId: a.companyId, assetId: id },
      orderBy: { assignedAt: "desc" },
    }),
    events: await db.accountOperationalAudit.findMany({
      where: { companyId: a.companyId, entityType: "ASSET", entityId: id },
      orderBy: { createdAt: "desc" },
    }),
    people: await db.user.findMany({
      where: { companyId: a.companyId },
      select: { id: true, name: true },
    }),
  };
}
export async function updateAssetForActor(
  a: ProjectActor,
  id: string,
  raw: unknown,
) {
  await scoped(a, id);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id"=${id}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
    const current = await scoped(a, id, tx);
    const d = base.parse({
      ...Object.fromEntries(
        Object.keys(base.shape).map((key) => [
          key,
          current[key as keyof typeof current] instanceof D
            ? String(current[key as keyof typeof current])
            : current[key as keyof typeof current],
        ]),
      ),
      ...(raw as Record<string, unknown>),
    });
    const purchaseValue = await validateLinks(
      tx,
      a,
      current.branchId,
      d,
      current.vendorId,
    );
    const row = await tx.asset.update({
      where: { id },
      data: { ...d, purchaseValue, salvageValue: new D(d.salvageValue) },
    });
    await audit(tx, a, "ASSET_UPDATED", id);
    return row;
  });
}
export async function assignAssetForActor(
  a: ProjectActor,
  assetId: string,
  userId: string,
  notes?: string,
) {
  await scoped(a, assetId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id"=${assetId}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
    const asset = await scoped(a, assetId, tx);
    if (!["ACTIVE", "ASSIGNED"].includes(asset.status))
      throw new Error("ASSET_NOT_ASSIGNABLE");
    if (
      !(await tx.user.findFirst({
        where: {
          id: userId,
          companyId: a.companyId,
          isActive: true,
          OR: [
            { branchAccessScope: "ALL_BRANCHES" },
            { branchAccesses: { some: { branchId: asset.branchId } } },
          ],
        },
      }))
    )
      throw new AuthorizationError();
    await tx.assetAssignmentHistory.updateMany({
      where: { companyId: a.companyId, assetId, returnedAt: null },
      data: { returnedAt: new Date() },
    });
    const history = await tx.assetAssignmentHistory.create({
      data: {
        companyId: a.companyId!,
        assetId,
        assignedToId: userId,
        assignedById: a.id,
        notes,
      },
    });
    await tx.asset.update({
      where: { id: assetId },
      data: { assignedUserId: userId, status: "ASSIGNED" },
    });
    await audit(tx, a, "ASSET_ASSIGNED", assetId, { userId });
    return history;
  });
}
export async function returnAssetForActor(
  a: ProjectActor,
  assetId: string,
  notes?: string,
) {
  await scoped(a, assetId);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id"=${assetId}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
    const asset = await scoped(a, assetId, tx);
    if (asset.status !== "ASSIGNED" || !asset.assignedUserId)
      throw new Error("ASSET_NOT_ASSIGNED");
    const changed = await tx.assetAssignmentHistory.updateMany({
      where: { companyId: a.companyId, assetId, returnedAt: null },
      data: { returnedAt: new Date() },
    });
    if (changed.count !== 1) throw new Error("ASSET_NOT_ASSIGNED");
    await tx.asset.update({
      where: { id: assetId },
      data: { assignedUserId: null, status: "ACTIVE" },
    });
    await audit(tx, a, "ASSET_RETURNED", assetId, {
      returnNotes: notes ?? "",
      returnedById: a.id,
    });
  });
}
export async function setAssetStatusForActor(
  a: ProjectActor,
  assetId: string,
  status: AssetStatus,
) {
  await scoped(a, assetId);
  const target = z.nativeEnum(AssetStatus).parse(status);
  if (target === "ASSIGNED") throw new Error("USE_ASSIGNMENT_FLOW");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "assets" WHERE "id"=${assetId}::uuid AND "companyId"=${a.companyId}::uuid FOR UPDATE`;
    const asset = await scoped(a, assetId, tx);
    if (asset.assignedUserId || asset.status === "ASSIGNED")
      throw new Error("RETURN_ASSET_FIRST");
    if (asset.status === "DISPOSED" && target !== "DISPOSED")
      throw new Error("ASSET_DISPOSED");
    if (asset.status === target) return asset;
    const row = await tx.asset.update({
      where: { id: assetId },
      data: { status: target },
    });
    await audit(tx, a, "ASSET_STATUS_CHANGED", assetId, {
      fromStatus: asset.status,
      status: target,
    });
    return row;
  });
}
export function depreciationPreview(
  value: Prisma.Decimal,
  salvage: Prisma.Decimal,
  months: number,
) {
  if (months <= 0 || salvage.gt(value)) throw new Error("INVALID_DEPRECIATION");
  return value.sub(salvage).div(months).toDecimalPlaces(2);
}
async function audit(
  tx: Prisma.TransactionClient,
  a: ProjectActor,
  eventType: string,
  id: string,
  metadata?: Prisma.InputJsonValue,
) {
  await tx.accountOperationalAudit.create({
    data: {
      companyId: a.companyId!,
      actorUserId: a.id,
      eventType,
      entityType: "ASSET",
      entityId: id,
      metadata,
    },
  });
}

export async function listAssets(raw: unknown = {}) {
  return listAssetsForActor(await actor(), raw);
}
export async function assetOptions() {
  return assetOptionsForActor(await actor());
}
export async function createAsset(raw: unknown) {
  return createAssetForActor(await actor(true), raw);
}
export async function getAsset(id: string) {
  return getAssetForActor(await actor(), id);
}
export async function updateAsset(id: string, raw: unknown) {
  return updateAssetForActor(await actor(true), id, raw);
}
export async function assignAsset(
  assetId: string,
  userId: string,
  notes?: string,
) {
  return assignAssetForActor(await actor(true), assetId, userId, notes);
}
export async function returnAsset(assetId: string, notes?: string) {
  return returnAssetForActor(await actor(true), assetId, notes);
}
export async function setAssetStatus(assetId: string, status: AssetStatus) {
  return setAssetStatusForActor(await actor(true), assetId, status);
}

import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { partySchema } from "./validation";
import { resolvePartySettings } from "./party-settings";
export type PartyKind = "customers" | "vendors";
const kindSchema = z.enum(["customers", "vendors"]);
const commonSelect = {
  id: true,
  updatedAt: true,
  name: true,
  contactPerson: true,
  phone: true,
  email: true,
  address: true,
  gstin: true,
  stateCode: true,
  gstRegistrationType: true,
  pan: true,
  notes: true,
} as const;
const editSchema = partySchema
  .partial()
  .extend({
    id: z.string().guid(),
    expectedUpdatedAt: z.string().datetime(),
    name: partySchema.shape.name,
  })
  .strict();
export async function partyMetadataForEdit(kind: PartyKind, id: string) {
  kindSchema.parse(kind);
  z.string().guid().parse(id);
  const actor = await requirePermission("ACCOUNT_ACCOUNTS");
  if (!actor.companyId) throw new AuthorizationError();
  const [row, settings] = await Promise.all([
    kind === "customers"
      ? db.customer.findFirst({
          where: {
            id,
            companyId: actor.companyId,
            isAccountCustomer: true,
            ...(actor.branchAccessScope === "SELECTED_BRANCHES"
              ? { branchId: { in: actor.branchIds ?? [] } }
              : {}),
          },
          select: {
            ...commonSelect,
            billingAddress: true,
            shippingAddress: true,
          },
        })
      : db.vendor.findFirst({
          where: { id, companyId: actor.companyId },
          select: commonSelect,
        }),
    db.accountSettings.findUnique({
      where: { companyId: actor.companyId },
      select: { transactionDefaults: true },
    }),
  ]);
  if (!row) throw new Error("PARTY_NOT_FOUND");
  return {
    party: {
      ...row,
      updatedAt: row.updatedAt.toISOString(),
      address:
        kind === "customers"
          ? "billingAddress" in row && typeof row.billingAddress === "string"
            ? row.billingAddress
            : null
          : row.address,
      shippingAddress:
        "shippingAddress" in row && typeof row.shippingAddress === "string"
          ? row.shippingAddress
          : null,
    },
    settings: resolvePartySettings(settings?.transactionDefaults),
  };
}
export async function editPartyMetadata(kind: PartyKind, raw: unknown) {
  const actor = await requirePermissionForMutation("ACCOUNT_ACCOUNTS");
  if (!actor.companyId) throw new AuthorizationError();
  return editPartyMetadataForActor(
    { id: actor.id, companyId: actor.companyId },
    kind,
    raw,
  );
}
export async function editPartyMetadataForActor(
  actor: { id: string; companyId: string },
  kind: PartyKind,
  raw: unknown,
) {
  kindSchema.parse(kind);
  const d = editSchema.parse(raw),
    provided = raw as Record<string, unknown>;
  if (kind === "vendors" && Object.hasOwn(provided, "shippingAddress"))
    throw new Error("INVALID_INPUT");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT id FROM users WHERE id=${actor.id}::uuid AND "companyId"=${actor.companyId}::uuid FOR SHARE`;
    const user = await tx.user.findFirst({
      where: {
        id: actor.id,
        companyId: actor.companyId,
        isActive: true,
        accountAccessActive: true,
      },
      select: {
        accountRole: true,
        branchAccessScope: true,
        branchAccesses: { select: { branchId: true } },
      },
    });
    if (
      !user?.accountRole ||
      !ACCOUNT_ROLE_PERMISSIONS[user.accountRole].includes("ACCOUNT_ACCOUNTS")
    )
      throw new AuthorizationError();
    const where = { id: d.id, companyId: actor.companyId };
    const customerWhere = {
      ...where,
      isAccountCustomer: true,
      ...(user.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: user.branchAccesses.map((row) => row.branchId) } }
        : {}),
    };
    const row =
      kind === "customers"
        ? await tx.customer.findFirst({
            where: customerWhere,
            select: { id: true, updatedAt: true },
          })
        : await tx.vendor.findFirst({
            where,
            select: { id: true, updatedAt: true },
          });
    if (!row) throw new Error("PARTY_NOT_FOUND");
    const expected = new Date(d.expectedUpdatedAt);
    if (row.updatedAt.getTime() !== expected.getTime())
      throw new Error("PARTY_STALE");
    const data: {
      name: string;
      contactPerson?: string | null;
      phone?: string | null;
      email?: string | null;
      address?: string | null;
      billingAddress?: string | null;
      shippingAddress?: string | null;
      gstin?: string | null;
      stateCode?: string | null;
      gstRegistrationType?: "UNREGISTERED" | "REGULAR" | "COMPOSITION" | "SEZ";
      pan?: string | null;
      notes?: string | null;
    } = { name: d.name };
    for (const field of [
      "contactPerson",
      "phone",
      "email",
      "gstin",
      "stateCode",
      "pan",
      "notes",
    ] as const)
      if (Object.hasOwn(provided, field)) data[field] = d[field] ?? null;
    if (Object.hasOwn(provided, "gstRegistrationType"))
      data.gstRegistrationType = d.gstRegistrationType;
    if (Object.hasOwn(provided, "address")) {
      if (kind === "customers") data.billingAddress = d.address ?? null;
      else data.address = d.address ?? null;
    }
    if (kind === "customers" && Object.hasOwn(provided, "shippingAddress"))
      data.shippingAddress = d.shippingAddress ?? null;
    const updated =
      kind === "customers"
        ? await tx.customer.updateMany({
            where: { ...customerWhere, updatedAt: expected },
            data,
          })
        : await tx.vendor.updateMany({
            where: { ...where, updatedAt: expected },
            data,
          });
    if (updated.count !== 1) throw new Error("PARTY_STALE");
    const saved =
      kind === "customers"
        ? await tx.customer.findFirstOrThrow({
            where: customerWhere,
            select: { updatedAt: true },
          })
        : await tx.vendor.findFirstOrThrow({
            where,
            select: { updatedAt: true },
          });
    await tx.accountOperationalAudit.create({
      data: {
        companyId: actor.companyId,
        actorUserId: actor.id,
        eventType: "PARTY_METADATA_UPDATED",
        entityType: kind === "customers" ? "CUSTOMER" : "VENDOR",
        entityId: d.id,
        metadata: {
          fields: Object.keys(data),
          previousRevision: d.expectedUpdatedAt,
          revision: saved.updatedAt.toISOString(),
        },
      },
    });
    return { updatedAt: saved.updatedAt.toISOString() };
  });
}

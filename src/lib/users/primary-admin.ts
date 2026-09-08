import { Prisma } from "@prisma/client";
import { requirePermission, requirePermissionForMutation } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { projectLegacyRole } from "./role-projection";
import {
  assertPrimaryAdminActor,
  assertPrimaryAdminTransferTarget,
  PrimaryAdminPolicyError,
} from "./primary-admin-policy";
import { transferPrimaryAdminSchema, type TransferPrimaryAdminInput } from "./primary-admin-validation";

const identitySelect = {
  id: true, companyId: true, role: true, salesRole: true, isActive: true, salesAccessActive: true,
} satisfies Prisma.UserSelect;

export async function listPrimaryAdminTransferCandidates() {
  const actor = assertPrimaryAdminActor(await requirePermission("SALES_USER_ADMIN"));
  return db.user.findMany({
    where: { companyId: actor.companyId, id: { not: actor.id }, isActive: true, salesAccessActive: true, salesRole: "ADMIN" },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function transferPrimaryAdmin(raw: TransferPrimaryAdminInput | unknown) {
  const boundaryActor = assertPrimaryAdminActor(await requirePermissionForMutation("SALES_USER_ADMIN"));
  const { targetUserId } = transferPrimaryAdminSchema.parse(raw);

  return db.$transaction(async (tx) => {
    // Every ownership transfer for a company serializes on the same durable row.
    await tx.$queryRaw`SELECT 1::int AS "locked" FROM "companies" WHERE "id" = ${boundaryActor.companyId}::uuid FOR UPDATE`;

    const actor = await tx.user.findFirst({
      where: { id: boundaryActor.id, companyId: boundaryActor.companyId },
      select: identitySelect,
    });
    if (!actor) throw new PrimaryAdminPolicyError("NOT_AUTHORIZED");
    assertPrimaryAdminActor(actor);

    const primaries = await tx.user.findMany({
      where: { companyId: boundaryActor.companyId, salesRole: "PRIMARY_ADMIN" },
      select: { id: true },
      take: 2,
    });
    if (primaries.length !== 1 || primaries[0].id !== actor.id) {
      throw new PrimaryAdminPolicyError("PRIMARY_ADMIN_INVARIANT");
    }

    // A tenant-scoped lookup intentionally makes missing and cross-tenant targets indistinguishable.
    const target = await tx.user.findFirst({
      where: { id: targetUserId, companyId: boundaryActor.companyId },
      select: identitySelect,
    });
    const validTarget = assertPrimaryAdminTransferTarget(actor, target);

    const demoted = await tx.user.updateMany({
      where: { id: actor.id, companyId: actor.companyId, salesRole: "PRIMARY_ADMIN", isActive: true, salesAccessActive: true },
      data: { salesRole: "ADMIN", role: projectLegacyRole({ salesRole: "ADMIN", accountRole: null }) },
    });
    if (demoted.count !== 1) throw new PrimaryAdminPolicyError("PRIMARY_ADMIN_INVARIANT");

    const promoted = await tx.user.updateMany({
      where: { id: validTarget.id, companyId: actor.companyId, salesRole: "ADMIN", isActive: true, salesAccessActive: true },
      data: { salesRole: "PRIMARY_ADMIN", role: projectLegacyRole({ salesRole: "PRIMARY_ADMIN", accountRole: null }) },
    });
    if (promoted.count !== 1) throw new PrimaryAdminPolicyError("INVALID_TRANSFER_TARGET");

    const resultingPrimaries = await tx.user.findMany({
      where: { companyId: actor.companyId, salesRole: "PRIMARY_ADMIN" },
      select: { id: true },
      take: 2,
    });
    if (resultingPrimaries.length !== 1 || resultingPrimaries[0].id !== validTarget.id) {
      throw new PrimaryAdminPolicyError("PRIMARY_ADMIN_INVARIANT");
    }
    return { primaryAdminId: validTarget.id };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

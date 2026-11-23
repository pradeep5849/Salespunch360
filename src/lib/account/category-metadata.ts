import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermissionForMutation,
} from "@/lib/auth/authorization";
import { ACCOUNT_ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import { assertInventoryAvailable } from "./inventory";
export const categoryMetadataSchema = z
  .object({
    id: z.string().guid(),
    expectedUpdatedAt: z.string().datetime(),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000),
  })
  .strict();
export async function editCategoryMetadata(raw: unknown) {
  const actor = await requirePermissionForMutation("ACCOUNT_STOCK");
  if (!actor.companyId) throw new AuthorizationError();
  await assertInventoryAvailable(actor);
  const d = categoryMetadataSchema.parse(raw);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${actor.companyId}::uuid FOR SHARE`;
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
      !ACCOUNT_ROLE_PERMISSIONS[user.accountRole].includes("ACCOUNT_STOCK")
    )
      throw new AuthorizationError();
    const changed = await tx.accountCategory.updateMany({
      where: {
        id: d.id,
        companyId: actor.companyId!,
        isActive: true,
        updatedAt: new Date(d.expectedUpdatedAt),
      },
      data: { name: d.name, description: d.description || null },
    });
    if (changed.count !== 1) throw new Error("CATEGORY_STALE");
    const row = await tx.accountCategory.findFirstOrThrow({
      where: { id: d.id, companyId: actor.companyId! },
      select: {
        id: true,
        name: true,
        description: true,
        scope: true,
        updatedAt: true,
      },
    });
    return { ...row, updatedAt: row.updatedAt.toISOString() };
  });
}

import type { AccountCategoryScope } from "@prisma/client";
import { db } from "@/lib/db";

export async function validateMobileItemReferences(
  companyId: string,
  input: { categoryId?: string; unitId?: string },
  scope: Exclude<AccountCategoryScope, "BOTH">,
) {
  if (
    input.categoryId &&
    !(await db.accountCategory.findFirst({
      where: {
        id: input.categoryId,
        companyId,
        isActive: true,
        scope: { in: [scope, "BOTH"] },
      },
      select: { id: true },
    }))
  )
    throw new Error("INVALID_INPUT");
  if (
    input.unitId &&
    !(await db.accountUnit.findFirst({
      where: { id: input.unitId, companyId, isActive: true },
      select: { id: true },
    }))
  )
    throw new Error("INVALID_INPUT");
}

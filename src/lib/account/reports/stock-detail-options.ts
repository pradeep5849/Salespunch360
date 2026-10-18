import {db} from "@/lib/db";
import {requirePermission, AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertInventoryAvailable} from "../inventory";
import type {ProjectActor} from "../projects";
export async function stockDetailCategoriesForActor(actor: ProjectActor) {
  if (!actor.companyId || !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_REPORTS") || !canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_STOCK")) throw new AuthorizationError();
  await assertInventoryAvailable(actor);
  const categories = await db.accountCategory.findMany({where: {companyId: actor.companyId}, select: {id: true, name: true}, orderBy: [{name: "asc"}, {id: "asc"}]});
  return [{id: "UNCATEGORIZED", name: "Uncategorized (no category)"}, ...categories];
}
export async function stockDetailCategories() {
  return stockDetailCategoriesForActor(await requirePermission("ACCOUNT_REPORTS") as ProjectActor);
}

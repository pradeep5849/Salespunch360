import type { Prisma } from "@prisma/client";
import type { ReportActor } from "./scope";

/** Current role and hierarchy define visibility; historical manager assignments are not retained. */
export function visibleUserWhere(actor: ReportActor): Prisma.UserWhereInput {
  if (actor.salesRole === "PRIMARY_ADMIN" || actor.salesRole === "ADMIN") return { companyId:actor.companyId, salesRole:{ in:["MANAGER","SALES"] } };
  if (actor.salesRole === "MANAGER") return actor.managerType === "MANAGER_ONLY"
    ? { companyId:actor.companyId, salesRole:"SALES", managerId:actor.id }
    : { companyId:actor.companyId, OR:[{id:actor.id,salesRole:"MANAGER"},{salesRole:"SALES",managerId:actor.id}] };
  return { companyId:actor.companyId, id:actor.id, salesRole:"SALES" };
}

import type { Prisma } from "@prisma/client";
import type { ReportActor } from "./scope";

/** Current role and hierarchy define visibility; historical manager assignments are not retained. */
export function visibleUserWhere(actor: ReportActor): Prisma.UserWhereInput {
  if (actor.role === "COMPANY_ADMIN") return { companyId:actor.companyId, role:{ in:["MANAGER","SALES"] } };
  if (actor.role === "MANAGER") return actor.managerType === "MANAGER_ONLY"
    ? { companyId:actor.companyId, role:"SALES", managerId:actor.id }
    : { companyId:actor.companyId, OR:[{id:actor.id,role:"MANAGER"},{role:"SALES",managerId:actor.id}] };
  return { companyId:actor.companyId, id:actor.id };
}

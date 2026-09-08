import type { ManagerType, SalesRole } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError, requirePermission } from "@/lib/auth/authorization";
import { visibleUserWhere } from "./policy";

export type ReportActor = { id:string; name:string; salesRole:SalesRole; managerType?:ManagerType|null; companyId:string };
export async function reportActor(): Promise<ReportActor> {
  const user = await requirePermission("SALES_REPORTS");
  if (!user.companyId || !user.salesRole) throw new AuthorizationError();
  return { id:user.id, name:user.name, salesRole:user.salesRole, managerType:user.managerType, companyId:user.companyId };
}
export async function resolveEmployeeScope(actor:ReportActor, requested?:string) {
  if (actor.salesRole === "SALES") return [actor.id];
  const users = await db.user.findMany({ where:{ ...visibleUserWhere(actor), ...(requested ? { id:requested,isActive:true,salesAccessActive:true,salesRole:{in:["MANAGER","SALES"]} } : {}) }, select:{id:true} });
  if (requested && users.length !== 1) throw new AuthorizationError();
  return users.map(u=>u.id);
}
export async function reportEmployeeOptions(actor:ReportActor) {
  return db.user.findMany({ where:{...visibleUserWhere(actor),isActive:true,salesAccessActive:true,salesRole:{in:["MANAGER","SALES"]}}, select:{id:true,name:true,salesRole:true,isActive:true}, orderBy:[{name:"asc"},{id:"asc"}] });
}

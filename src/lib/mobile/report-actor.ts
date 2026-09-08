import type { SalesRole } from "@prisma/client";
import type { MobilePrincipal } from "./auth";
import type { ReportActor } from "@/lib/reports/scope";

/** Temporary legacy-mobile compatibility mapping. F3M replaces this at the mobile authentication boundary. */
export function mobileSalesRole(role:MobilePrincipal["role"]):SalesRole {
  if(role==="COMPANY_ADMIN")return "PRIMARY_ADMIN";
  if(role==="MANAGER")return "MANAGER";
  if(role==="SALES")return "SALES";
  throw new Error("MOBILE_UNAUTHORIZED");
}

export function mobileReportActor(user:MobilePrincipal):ReportActor {
  return{id:user.id,name:user.name,salesRole:mobileSalesRole(user.role),managerType:user.managerType,companyId:user.companyId};
}

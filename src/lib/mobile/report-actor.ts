import type { MobilePrincipal } from "./auth";
import type { ReportActor } from "@/lib/reports/scope";
export function mobileReportActor(user:MobilePrincipal):ReportActor{return{id:user.id,name:user.name,salesRole:user.salesRole,managerType:user.managerType,companyId:user.companyId}}

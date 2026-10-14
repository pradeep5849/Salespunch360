import type {ProductEdition,QuotationStatus} from "@prisma/client";
import {canUsePermission} from "@/lib/auth/permissions";
type Actor=Parameters<typeof canUsePermission>[0];
export function quotationActionCapabilities(actor:Actor,status:QuotationStatus,edition:ProductEdition="SALESPUNCH360_ACCOUNT") {
 const edit=canUsePermission(actor,edition,"ACCOUNT_QUOTATION_EDIT");
 return {
  canEdit:edit&&status==="DRAFT",
  canRevise:edit&&["APPROVED","REJECTED","SENT","DECLINED","EXPIRED"].includes(status),
  canApprove:canUsePermission(actor,edition,"ACCOUNT_QUOTATION_APPROVE"),
  canShare:actor.accountRole!=="DATA_ENTRY"&&canUsePermission(actor,edition,"ACCOUNT_QUOTATION_SHARE")&&["APPROVED","SENT"].includes(status),
  canLifecycle:edit&&(actor.accountRole!=="DATA_ENTRY"||status==="DRAFT"),
 };
}
export function permittedQuotationTransitions(actor:Actor,status:QuotationStatus,transitions:readonly QuotationStatus[],edition:ProductEdition="SALESPUNCH360_ACCOUNT") {
 const capabilities=quotationActionCapabilities(actor,status,edition);
 if(!capabilities.canLifecycle)return [];
 return transitions.filter(target=>target==="APPROVED"||target==="REJECTED"?capabilities.canApprove:target==="SENT"?capabilities.canShare:true);
}

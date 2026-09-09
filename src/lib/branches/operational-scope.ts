import type { BranchAccessScope, Prisma } from "@prisma/client";

export class OperationalBranchError extends Error {}
type Actor={id:string;companyId:string;branchAccessScope:BranchAccessScope;role:string;salesRole:string|null;isActive:boolean;salesAccessActive:boolean};
type Branch={id:string;companyId:string;isActive:boolean};
export function assertOperationalBranch(actor:Actor,branch:Branch|null){
  if(!actor.isActive||!actor.salesAccessActive||actor.role==="SUPER_ADMIN"||!actor.salesRole||!branch||!branch.isActive||branch.companyId!==actor.companyId)throw new OperationalBranchError("BRANCH_FORBIDDEN");
}
export function operationalBranchWhere(actor:Actor,permittedBranchIds:readonly string[],requestedBranchId?:string):Prisma.StringFilter|string{
  if(actor.branchAccessScope==="SELECTED_BRANCHES"){
    if(requestedBranchId&&!permittedBranchIds.includes(requestedBranchId))throw new OperationalBranchError("BRANCH_FORBIDDEN");
    return requestedBranchId??{in:[...permittedBranchIds]};
  }
  return requestedBranchId??{not:"00000000-0000-0000-0000-000000000000"};
}
export function resolveWriteBranch(permitted:readonly Branch[],requestedBranchId?:string){
  const choices=permitted.filter(branch=>branch.isActive);
  const selected=requestedBranchId?choices.find(branch=>branch.id===requestedBranchId):choices.length===1?choices[0]:null;
  if(!selected)throw new OperationalBranchError(choices.length>1?"BRANCH_REQUIRED":"BRANCH_FORBIDDEN");
  return selected.id;
}

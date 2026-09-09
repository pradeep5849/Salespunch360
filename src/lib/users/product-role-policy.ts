import type { AccountRole, ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { editionAllowsAccount, editionAllowsSales } from "@/lib/product/entitlements";

export type UserRoleAssignment = {
  salesRole: Exclude<SalesRole, "PRIMARY_ADMIN"> | null;
  accountRole: AccountRole | null;
  managerType: ManagerType | null;
};

export function validateUserRoleAssignment(edition: ProductEdition, input: UserRoleAssignment) {
  if (!input.salesRole && !input.accountRole) throw new Error("ROLE_REQUIRED");
  if (input.salesRole && !editionAllowsSales(edition)) throw new Error("SALES_ROLE_NOT_ENTITLED");
  if (input.accountRole && !editionAllowsAccount(edition)) throw new Error("ACCOUNT_ROLE_NOT_ENTITLED");
  if (input.salesRole !== "MANAGER" && input.managerType) throw new Error("MANAGER_TYPE_NOT_ALLOWED");
  if (input.salesRole === "MANAGER" && !input.managerType) throw new Error("MANAGER_TYPE_REQUIRED");
  return input;
}

export function assertEditableProductUser<T extends {companyId:string|null;salesRole:SalesRole|null}|null>(companyId:string,target:T): asserts target is Exclude<T,null>{
  if(!target||target.companyId!==companyId)throw new Error("NOT_FOUND");
  if(target.salesRole==="PRIMARY_ADMIN")throw new Error("PRIMARY_PROTECTED");
}

type SecurityDimensions=UserRoleAssignment&{salesAccessActive:boolean;accountAccessActive:boolean;branchAccessScope:string;branchIds:readonly string[];managerId:string|null};
export function roleChangeRequiresAuthenticationRevocation(before:SecurityDimensions,after:SecurityDimensions){
  return before.salesRole!==after.salesRole||before.accountRole!==after.accountRole||before.managerType!==after.managerType||before.managerId!==after.managerId||before.salesAccessActive!==after.salesAccessActive||before.accountAccessActive!==after.accountAccessActive||before.branchAccessScope!==after.branchAccessScope||[...before.branchIds].sort().join(",")!==[...after.branchIds].sort().join(",");
}

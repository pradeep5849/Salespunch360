import type { WorkspacePrincipal } from "./workspace-policy";
import {describe,expect,it} from "vitest";
import {canUsePermissionForMutation} from "./permissions";

const actor=(salesRole:WorkspacePrincipal["salesRole"]):WorkspacePrincipal=>({
 companyId:"company",
 role:salesRole==="PRIMARY_ADMIN"?"COMPANY_ADMIN":salesRole==="ADMIN"?"FIELD_ADMIN":salesRole!,
 isActive:true,
 salesRole,
 accountRole:null,
 salesAccessActive:true,
 accountAccessActive:false,
 managerType:salesRole==="MANAGER"?"FIELD_MANAGER":null,
});

describe("Sales customer mutation permissions",()=>{
 it("allows Primary Admin and Admin to create/edit/assign customers",()=>{
  expect(canUsePermissionForMutation(actor("PRIMARY_ADMIN"),"SALESPUNCH360","SALES_CUSTOMERS")).toBe(true);
  expect(canUsePermissionForMutation(actor("ADMIN"),"SALESPUNCH360","SALES_CUSTOMERS")).toBe(true);
 });
 it("does not turn customer administration into a field-user mutation",()=>{
  expect(canUsePermissionForMutation(actor("SALES"),"SALESPUNCH360","SALES_CUSTOMERS")).toBe(false);
  expect(canUsePermissionForMutation(actor("MANAGER"),"SALESPUNCH360","SALES_CUSTOMERS")).toBe(false);
 });
});

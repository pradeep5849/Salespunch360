import{describe,expect,it}from"vitest";import{canUsePermission}from"./permissions";
const principal=(salesRole:"PRIMARY_ADMIN"|"ADMIN"|"MANAGER"|"SALES")=>({id:"u",companyId:"c",role:"COMPANY_ADMIN" as const,isActive:true,salesAccessActive:true,accountAccessActive:false,salesRole,accountRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]});
describe("Sales user-management authority",()=>{
 it("allows only Primary Admin",()=>expect(canUsePermission(principal("PRIMARY_ADMIN"),"SALESPUNCH360","SALES_USER_ADMIN")).toBe(true));
 it.each(["ADMIN","MANAGER","SALES"] as const)("denies %s user administration",role=>expect(canUsePermission(principal(role),"SALESPUNCH360","SALES_USER_ADMIN")).toBe(false));
});

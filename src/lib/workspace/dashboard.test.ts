import{describe,expect,it}from"vitest";import{dashboardEmployeeWhere,type DashboardActor}from"./dashboard";
const actor=(role:DashboardActor["role"],salesRole:DashboardActor["salesRole"]):DashboardActor=>({id:"self",name:"A",email:"a@x.com",role,salesRole,managerType:salesRole==="MANAGER"?"FIELD_MANAGER":null,companyId:"tenant-a"});
describe("dashboard employee scopes",()=>{
 it.each([["COMPANY_ADMIN","PRIMARY_ADMIN"],["FIELD_ADMIN","ADMIN"]] as const)("gives %s + %s the admin tenant scope",(role,salesRole)=>expect(dashboardEmployeeWhere(actor(role,salesRole))).toEqual({companyId:"tenant-a",salesRole:{in:["MANAGER","SALES"]},salesAccessActive:true,isActive:true}));
 it("keeps Manager selectors limited to active canonical Sales",()=>expect(dashboardEmployeeWhere(actor("MANAGER","MANAGER"))).toEqual({companyId:"tenant-a",salesRole:"SALES",salesAccessActive:true,managerId:"self",isActive:true}));
 it("keeps Sales self-only",()=>expect(dashboardEmployeeWhere(actor("SALES","SALES"))).toEqual({companyId:"tenant-a",id:"self",salesRole:"SALES",salesAccessActive:true,isActive:true}));
 it("never derives employee scope from a corrupted legacy role",()=>expect(dashboardEmployeeWhere(actor("SALES","PRIMARY_ADMIN"))).toEqual({companyId:"tenant-a",salesRole:{in:["MANAGER","SALES"]},salesAccessActive:true,isActive:true}));
});

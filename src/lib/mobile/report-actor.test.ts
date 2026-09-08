import{describe,expect,it}from"vitest";import{mobileReportActor}from"./report-actor";import type{MobilePrincipal}from"./auth";
const principal=(salesRole:MobilePrincipal["salesRole"]):MobilePrincipal=>({id:"mobile",name:"Mobile",email:"m@example.com",salesRole,managerType:salesRole==="MANAGER"?"FIELD_MANAGER":null,companyId:"company"});
describe("canonical mobile report actor",()=>{it("preserves every canonical Sales role",()=>{for(const role of ["PRIMARY_ADMIN","ADMIN","MANAGER","SALES"] as const)expect(mobileReportActor(principal(role)).salesRole).toBe(role)});});

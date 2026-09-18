import {describe,expect,it} from "vitest";
import {resolveWorkspaceAccess} from "./workspace-policy";

const base={companyId:"company-1",role:"COMPANY_ADMIN" as const,isActive:true,salesRole:"PRIMARY_ADMIN" as const,accountRole:"ACCOUNT_ADMIN" as const,salesAccessActive:true,accountAccessActive:true,managerType:null};

describe("Plus primary admin workspace access",()=>{
  it("can access and switch between both Plus workspaces",()=>{
    const access=resolveWorkspaceAccess(base,"SALESPUNCH360_PLUS");
    expect(access.canAccessSales).toBe(true);
    expect(access.canAccessAccount).toBe(true);
    expect(access.canSwitchWorkspace).toBe(true);
  });
  it("does not grant Account workspace to a Sales-only edition",()=>{
    const access=resolveWorkspaceAccess(base,"SALESPUNCH360");
    expect(access.canAccessSales).toBe(true);
    expect(access.canAccessAccount).toBe(false);
  });
});

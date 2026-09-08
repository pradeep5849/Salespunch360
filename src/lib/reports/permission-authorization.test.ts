import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks=vi.hoisted(()=>({permission:vi.fn(),mutationPermission:vi.fn(),users:vi.fn(),targets:vi.fn()}));
vi.mock("@/lib/auth/authorization",()=>({
  AuthorizationError:class AuthorizationError extends Error{constructor(){super("Not authorized");this.name="AuthorizationError"}},
  requirePermission:mocks.permission,
  requirePermissionForMutation:mocks.mutationPermission,
}));
vi.mock("@/lib/db",()=>({db:{
  user:{findMany:mocks.users,findFirst:vi.fn()},salesTarget:{findMany:mocks.targets,count:vi.fn(),create:vi.fn(),findFirst:vi.fn(),updateMany:vi.fn(),upsert:vi.fn()},
  lead:{findMany:vi.fn(),count:vi.fn(),aggregate:vi.fn()},$transaction:vi.fn(),
}}));
vi.mock("@/lib/billing/entitlement",()=>({assertOperationalWrite:vi.fn()}));

import { reportActor } from "./scope";
import { createTarget, listTargets } from "@/lib/targets/service";

const principal={id:"admin",name:"Admin",companyId:"tenant-a",salesRole:"PRIMARY_ADMIN",managerType:null};

describe("Reports and Targets permission boundaries",()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.permission.mockResolvedValue(principal);mocks.mutationPermission.mockResolvedValue(principal);mocks.users.mockResolvedValue([]);mocks.targets.mockResolvedValue([])});
  it("authorizes report reads with SALES_REPORTS and explicit SalesRole",async()=>{
    await expect(reportActor()).resolves.toMatchObject({salesRole:"PRIMARY_ADMIN",companyId:"tenant-a"});
    expect(mocks.permission).toHaveBeenCalledWith("SALES_REPORTS");
  });
  it("authorizes target reads with SALES_TARGETS",async()=>{
    await listTargets();
    expect(mocks.permission).toHaveBeenCalledWith("SALES_TARGETS");
  });
  it("authorizes target mutations through the non-redirecting mutation boundary",async()=>{
    await expect(createTarget({})).rejects.toBeTruthy();
    expect(mocks.mutationPermission).toHaveBeenCalledWith("SALES_TARGETS");
    expect(mocks.permission).not.toHaveBeenCalled();
  });
  it("does not accept a legacy role without an explicit SalesRole",async()=>{
    mocks.permission.mockResolvedValue({id:"legacy",name:"Legacy",companyId:"tenant-a",role:"COMPANY_ADMIN"});
    await expect(reportActor()).rejects.toMatchObject({name:"AuthorizationError"});
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), company: vi.fn(), productContext:vi.fn(),userCount:vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/employees/service", () => ({ getEmployeeManagementContext: mocks.context }));
vi.mock("@/lib/branches/assignment",()=>({listBranchAssignmentOptions:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/additional-admin",()=>({listAdditionalAdmins:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/primary-admin",()=>({listPrimaryAdminTransferCandidates:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/db", () => ({ db: { company: { findUnique: mocks.company }, user:{count:mocks.userCount} } }));
vi.mock("@/components/workspace/workspace-page-header", () => ({ WorkspacePageHeader: () => null }));
vi.mock("./employee-manager", () => ({ EmployeeManager: () => null }));
vi.mock("./product-user-manager",()=>({ProductUserManager:()=>null}));
vi.mock("@/lib/users/product-user-management",()=>({getProductUserManagementContext:mocks.productContext}));

import EmployeesPage from "./page";

const actor = (salesRole: "PRIMARY_ADMIN" | "ADMIN") => ({
  id: "actor", companyId: "company", salesRole,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue({
    employees: [], teamStructure: "MANAGERS_AND_SALES",
    trial: { isInTrial: false, isTrialExpired: false, effectiveStatus: "ACTIVE", managerAllowance: 1, salesAllowance: 5 },
  });
  mocks.userCount.mockResolvedValue(1);
  mocks.company.mockResolvedValue({ users: [{ emailVerifiedAt: new Date() }] });
  mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360",users:[],branches:[],canManageSalesUsers:true,canManageAccountUsers:false});
});

describe("Employee page authorization", () => {
  it.each(["PRIMARY_ADMIN", "ADMIN"] as const)("allows canonical %s through SALES_USER_ADMIN", async (salesRole) => {
    mocks.permission.mockResolvedValue(actor(salesRole));
    await expect(EmployeesPage({ searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
    expect(mocks.permission).toHaveBeenCalledWith("SALES_USER_ADMIN");
  });

  it("does not let a legacy FIELD_ADMIN role bypass canonical permission denial", async () => {
    const denial = new Error("Not authorized");
    mocks.permission.mockRejectedValue(denial);
    await expect(EmployeesPage({ searchParams: Promise.resolve({}) })).rejects.toBe(denial);
    expect(mocks.permission).toHaveBeenCalledWith("SALES_USER_ADMIN");
  });

  it("lets a Plus Account Admin open Account management without invoking Sales loaders",async()=>{
    mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360_PLUS",users:[],branches:[],canManageSalesUsers:false,canManageAccountUsers:true});
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.context).not.toHaveBeenCalled();expect(mocks.permission).not.toHaveBeenCalled();
  });

  it("loads Sales management but not Account controls for a Plus Sales-only administrator",async()=>{
    mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360_PLUS",users:[],branches:[],canManageSalesUsers:true,canManageAccountUsers:false});
    mocks.permission.mockResolvedValue(actor("ADMIN"));
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.context).toHaveBeenCalledOnce();expect(mocks.permission).toHaveBeenCalledWith("SALES_USER_ADMIN");
  });

  it("lets an Account-only Company administrator avoid every Sales-only service",async()=>{
    mocks.productContext.mockResolvedValue({actor:{salesRole:"PRIMARY_ADMIN"},accountLimits:{},accountUsage:{},edition:"SALESPUNCH360_ACCOUNT",users:[],branches:[],canManageSalesUsers:false,canManageAccountUsers:true});
    await expect(EmployeesPage({searchParams:Promise.resolve({})})).resolves.toBeTruthy();
    expect(mocks.context).not.toHaveBeenCalled();expect(mocks.permission).not.toHaveBeenCalled();
  });
});

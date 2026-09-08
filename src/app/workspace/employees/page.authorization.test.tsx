import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ permission: vi.fn(), context: vi.fn(), company: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.permission }));
vi.mock("@/lib/employees/service", () => ({ getEmployeeManagementContext: mocks.context }));
vi.mock("@/lib/branches/assignment",()=>({listBranchAssignmentOptions:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/additional-admin",()=>({listAdditionalAdmins:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/users/primary-admin",()=>({listPrimaryAdminTransferCandidates:vi.fn().mockResolvedValue([])}));
vi.mock("@/lib/db", () => ({ db: { company: { findUnique: mocks.company } } }));
vi.mock("@/components/workspace/workspace-page-header", () => ({ WorkspacePageHeader: () => null }));
vi.mock("./employee-manager", () => ({ EmployeeManager: () => null }));

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
  mocks.company.mockResolvedValue({ users: [{ emailVerifiedAt: new Date() }] });
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
});

import { describe, expect, it } from "vitest";
import { ACCOUNT_PACKAGE_SEATS, ACCOUNT_PACKAGE_YEARLY_PRICE_INR } from "@/lib/billing/account-package";
import {
  canAccessAccountWorkspace,
  canAccessSalesWorkspace,
  canAdministerSalesWorkspace,
  canUseSalesFieldWorkflow,
  hasAccountRole,
  hasSalesRole,
  hasMalformedPlatformIdentity,
  isPlatformSuperAdmin,
  isSalesPrimaryAdmin,
  type WorkspacePrincipal,
} from "./workspace-policy";

const user = (overrides: Partial<WorkspacePrincipal> = {}): WorkspacePrincipal => ({
  companyId: "company",
  role: "ACCOUNT_USER",
  isActive: true,
  salesRole: null,
  accountRole: null,
  salesAccessActive: false,
  accountAccessActive: false,
  managerType: null,
  ...overrides,
});

const salesUser = (overrides: Partial<WorkspacePrincipal> = {}) =>
  user({ role: "SALES", salesRole: "SALES", salesAccessActive: true, ...overrides });
const accountUser = (overrides: Partial<WorkspacePrincipal> = {}) =>
  user({ accountRole: "ACCOUNTANT", accountAccessActive: true, ...overrides });
const dualUser = (overrides: Partial<WorkspacePrincipal> = {}) =>
  user({ role: "MANAGER", salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", salesAccessActive: true, accountAccessActive: true, managerType: "FIELD_MANAGER", ...overrides });

describe("workspace assignment helpers", () => {
  it.each([["COMPANY_ADMIN", "PRIMARY_ADMIN"], ["FIELD_ADMIN", "ADMIN"], ["MANAGER", "MANAGER"], ["SALES", "SALES"]] as const)("recognizes the compatible Sales identity %s + %s", (role, salesRole) => {
    expect(hasSalesRole(user({ role, salesRole }))).toBe(true);
  });

  it("describes assignments without implying effective workspace access", () => {
    const suspendedAdmin = user({ role: "FIELD_ADMIN", salesRole: "ADMIN", salesAccessActive: false });
    expect(canAdministerSalesWorkspace(suspendedAdmin)).toBe(true);
    expect(canAccessSalesWorkspace(suspendedAdmin, "SALESPUNCH360")).toBe(false);
    expect(isSalesPrimaryAdmin(suspendedAdmin)).toBe(false);
    expect(canUseSalesFieldWorkflow(user({ role: "MANAGER", salesRole: "MANAGER", managerType: "FIELD_MANAGER" }))).toBe(true);
  });
});

describe("canonical workspace effective-access policy", () => {
  it("permits an active Sales assignment, lifecycle, tenant, and Sales edition", () => {
    expect(canAccessSalesWorkspace(salesUser(), "SALESPUNCH360")).toBe(true);
  });

  it.each([
    ["inactive Sales lifecycle", { salesAccessActive: false }, "SALESPUNCH360"],
    ["missing Sales role", { salesRole: null }, "SALESPUNCH360"],
    ["globally inactive identity", { isActive: false }, "SALESPUNCH360"],
    ["missing company", { companyId: null }, "SALESPUNCH360"],
    ["Account-only edition", {}, "SALESPUNCH360_ACCOUNT"],
  ] as const)("rejects Sales access for %s", (_label, overrides, edition) => {
    expect(canAccessSalesWorkspace(salesUser(overrides), edition)).toBe(false);
  });

  it("permits an active Account assignment, lifecycle, tenant, and Account edition", () => {
    expect(canAccessAccountWorkspace(accountUser(), "SALESPUNCH360_ACCOUNT")).toBe(true);
  });

  it.each([
    ["inactive Account lifecycle", { accountAccessActive: false }, "SALESPUNCH360_ACCOUNT"],
    ["missing Account role", { accountRole: null }, "SALESPUNCH360_ACCOUNT"],
    ["globally inactive identity", { isActive: false }, "SALESPUNCH360_ACCOUNT"],
    ["missing company", { companyId: null }, "SALESPUNCH360_ACCOUNT"],
    ["Sales-only edition", {}, "SALESPUNCH360"],
  ] as const)("rejects Account access for %s", (_label, overrides, edition) => {
    expect(canAccessAccountWorkspace(accountUser(overrides), edition)).toBe(false);
  });

  it.each([
    [true, true, true, true],
    [false, true, false, true],
    [true, false, true, false],
    [false, false, false, false],
  ])("independently applies PLUS lifecycle state (Sales %s, Account %s)", (salesAccessActive, accountAccessActive, salesExpected, accountExpected) => {
    const principal = dualUser({ salesAccessActive, accountAccessActive, isActive: salesAccessActive || accountAccessActive });
    expect(canAccessSalesWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(salesExpected);
    expect(canAccessAccountWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(accountExpected);
  });

  it("rejects a globally inactive dual-role identity from both workspaces", () => {
    const principal = dualUser({ isActive: false });
    expect(canAccessSalesWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(false);
    expect(canAccessAccountWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(false);
  });

  it("distinguishes the global administrator from a malformed tenant-attached legacy value and fails closed", () => {
    const principal = dualUser({ role: "SUPER_ADMIN" });
    expect(isPlatformSuperAdmin(principal)).toBe(false);
    expect(hasMalformedPlatformIdentity(principal)).toBe(true);
    expect(canAccessSalesWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(false);
    expect(canAccessAccountWorkspace(principal, "SALESPUNCH360_PLUS")).toBe(false);
    expect(isPlatformSuperAdmin(user({ role: "SUPER_ADMIN", companyId: null }))).toBe(true);
  });

  it("does not infer workspace access from unsupported legacy roles", () => {
    expect(canAccessSalesWorkspace(user({ role: "FIELD_ADMIN", salesAccessActive: true }), "SALESPUNCH360")).toBe(false);
    expect(canAccessAccountWorkspace(user({ role: "ACCOUNT_USER", accountAccessActive: true }), "SALESPUNCH360_ACCOUNT")).toBe(false);
  });

  it.each([["SALESPUNCH360", true, false], ["SALESPUNCH360_ACCOUNT", false, true], ["SALESPUNCH360_PLUS", true, true]] as const)("enforces product edition workspace eligibility for %s", (edition, sales, account) => {
    expect(canAccessSalesWorkspace(salesUser(), edition)).toBe(sales);
    expect(canAccessAccountWorkspace(accountUser(), edition)).toBe(account);
  });
});

describe("F2 compatibility constants", () => {
  it("retains Account assignment helpers and the fixed yearly package", () => {
    expect(hasAccountRole(accountUser())).toBe(true);
    expect([ACCOUNT_PACKAGE_YEARLY_PRICE_INR, ACCOUNT_PACKAGE_SEATS]).toEqual([700, { ACCOUNT_ADMIN: 1, ACCOUNTANT: 1, PROJECT_MANAGER: 1, DATA_ENTRY: 1 }]);
  });
});

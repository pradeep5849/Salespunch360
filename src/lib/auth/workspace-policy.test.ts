import { describe, expect, it } from "vitest";
import { ACCOUNT_PACKAGE_SEATS, ACCOUNT_PACKAGE_YEARLY_PRICE_INR } from "@/lib/billing/account-package";
import { canAccessAccountWorkspace, canAccessSalesWorkspace, canAdministerSalesWorkspace, canUseSalesFieldWorkflow, hasAccountRole, hasSalesRole, isPlatformSuperAdmin, isSalesPrimaryAdmin } from "./workspace-policy";

const user = (overrides = {}) => ({ companyId: "company", role: "ACCOUNT_USER" as const, salesRole: null, accountRole: null, managerType: null, ...overrides });

describe("F2 workspace policy", () => {
  it.each([["COMPANY_ADMIN", "PRIMARY_ADMIN"], ["FIELD_ADMIN", "ADMIN"], ["MANAGER", "MANAGER"], ["SALES", "SALES"]] as const)("recognizes the compatible Sales identity %s + %s", (role, salesRole) => {
    const principal = user({ role, salesRole });
    expect(hasSalesRole(principal)).toBe(true);
    expect(canAccessSalesWorkspace(principal, "SALESPUNCH360")).toBe(true);
  });
  it("keeps ACCOUNT_USER and SUPER_ADMIN outside Sales, and SUPER_ADMIN outside all workspaces", () => {
    const accountUser = user({ accountRole: "ACCOUNTANT" });
    const superAdmin = user({ role: "SUPER_ADMIN", companyId: null });
    expect(hasSalesRole(accountUser)).toBe(false); expect(canAccessSalesWorkspace(accountUser, "SALESPUNCH360_PLUS")).toBe(false);
    expect(isPlatformSuperAdmin(superAdmin)).toBe(true); expect(hasSalesRole(superAdmin)).toBe(false); expect(hasAccountRole(superAdmin)).toBe(false);
  });
  it("represents an additional Sales ADMIN as FIELD_ADMIN + ADMIN, never COMPANY_ADMIN + ADMIN", () => {
    const additionalAdmin = user({ role: "FIELD_ADMIN", salesRole: "ADMIN" });
    const primaryAdmin = user({ role: "COMPANY_ADMIN", salesRole: "PRIMARY_ADMIN" });
    expect(canAdministerSalesWorkspace(additionalAdmin)).toBe(true); expect(isSalesPrimaryAdmin(additionalAdmin)).toBe(false);
    expect(primaryAdmin.role).toBe("COMPANY_ADMIN"); expect(isSalesPrimaryAdmin(primaryAdmin)).toBe(true);
    expect(additionalAdmin.role).not.toBe("COMPANY_ADMIN");
  });
  it("allows Account roles to coexist with Field Admin, Manager, and Sales without cross-workspace grants", () => {
    for (const principal of [user({ role: "FIELD_ADMIN", salesRole: "ADMIN", accountRole: "ACCOUNT_ADMIN" }), user({ role: "MANAGER", salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", managerType: "FIELD_MANAGER" }), user({ role: "SALES", salesRole: "SALES", accountRole: "DATA_ENTRY" })]) expect(hasAccountRole(principal)).toBe(true);
    const salesOnly = user({ role: "SALES", salesRole: "SALES" });
    const accountOnly = user({ accountRole: "ACCOUNTANT" });
    expect(canAccessAccountWorkspace(salesOnly, "SALESPUNCH360_PLUS")).toBe(false); expect(canAccessSalesWorkspace(accountOnly, "SALESPUNCH360_PLUS")).toBe(false);
    expect(canUseSalesFieldWorkflow(user({ role: "MANAGER", salesRole: "MANAGER", managerType: "FIELD_MANAGER" }))).toBe(true);
  });
  it.each([["SALESPUNCH360", true, false], ["SALESPUNCH360_ACCOUNT", false, true], ["SALESPUNCH360_PLUS", true, true]] as const)("enforces product edition workspace eligibility for %s", (edition, sales, account) => {
    expect(canAccessSalesWorkspace(user({ role: "SALES", salesRole: "SALES" }), edition)).toBe(sales);
    expect(canAccessAccountWorkspace(user({ accountRole: "DATA_ENTRY" }), edition)).toBe(account);
  });
  it("defines the fixed yearly Account package", () => expect([ACCOUNT_PACKAGE_YEARLY_PRICE_INR, ACCOUNT_PACKAGE_SEATS]).toEqual([700, { ACCOUNT_ADMIN: 1, ACCOUNTANT: 1, PROJECT_MANAGER: 1, DATA_ENTRY: 1 }]));
});

import { describe, expect, it } from "vitest";
import { ACCOUNT_PACKAGE_SEATS, ACCOUNT_PACKAGE_YEARLY_PRICE_INR } from "@/lib/billing/account-package";
import { canAccessAccountWorkspace, canAccessSalesWorkspace, canAdministerSalesWorkspace, canUseSalesFieldWorkflow, hasAccountRole, hasSalesRole, isPlatformSuperAdmin, isSalesPrimaryAdmin } from "./workspace-policy";

const user = (overrides = {}) => ({ companyId: "company", role: "ACCOUNT_USER" as const, salesRole: null, accountRole: null, managerType: null, ...overrides });

describe("F2 workspace policy", () => {
  it("maps legacy roles to their safe Sales backfill identities", () => {
    expect({ COMPANY_ADMIN: "PRIMARY_ADMIN", MANAGER: "MANAGER", SALES: "SALES", SUPER_ADMIN: null }).toEqual({ COMPANY_ADMIN: "PRIMARY_ADMIN", MANAGER: "MANAGER", SALES: "SALES", SUPER_ADMIN: null });
  });
  it("keeps platform administrators outside company workspaces", () => {
    const superAdmin = user({ role: "SUPER_ADMIN", companyId: null });
    expect(isPlatformSuperAdmin(superAdmin)).toBe(true); expect(hasSalesRole(superAdmin)).toBe(false); expect(hasAccountRole(superAdmin)).toBe(false);
  });
  it("represents an additional Sales ADMIN independently from PRIMARY_ADMIN", () => {
    const admin = user({ role: "COMPANY_ADMIN", salesRole: "ADMIN" });
    expect(canAdministerSalesWorkspace(admin)).toBe(true); expect(isSalesPrimaryAdmin(admin)).toBe(false);
  });
  it("allows one user to hold exactly one role in each workspace without automatic cross-access", () => {
    const dual = user({ role: "MANAGER", salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", managerType: "FIELD_MANAGER" });
    expect(hasSalesRole(dual)).toBe(true); expect(hasAccountRole(dual)).toBe(true); expect(canUseSalesFieldWorkflow(dual)).toBe(true);
    const salesOnly = user({ role: "SALES", salesRole: "SALES" });
    expect(canAccessAccountWorkspace(salesOnly, "SALESPUNCH360_PLUS")).toBe(false);
    const accountOnly = user({ accountRole: "ACCOUNTANT" });
    expect(canAccessSalesWorkspace(accountOnly, "SALESPUNCH360_PLUS")).toBe(false);
  });
  it.each([["SALESPUNCH360", true, false], ["SALESPUNCH360_ACCOUNT", false, true], ["SALESPUNCH360_PLUS", true, true]] as const)("enforces product edition workspace eligibility for %s", (edition, sales, account) => {
    expect(canAccessSalesWorkspace(user({ role: "SALES", salesRole: "SALES" }), edition)).toBe(sales);
    expect(canAccessAccountWorkspace(user({ accountRole: "DATA_ENTRY" }), edition)).toBe(account);
  });
  it("defines the fixed yearly Account package", () => {
    expect(ACCOUNT_PACKAGE_YEARLY_PRICE_INR).toBe(700);
    expect(ACCOUNT_PACKAGE_SEATS).toEqual({ ACCOUNT_ADMIN: 1, ACCOUNTANT: 1, PROJECT_MANAGER: 1, DATA_ENTRY: 1 });
  });
});

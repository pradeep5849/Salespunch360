import type { WorkspacePrincipal } from "./workspace-policy";
import { describe, expect, it } from "vitest";
import { ACCOUNT_ROLE_PERMISSIONS, canUsePermission, PERMISSIONS, SALES_ROLE_PERMISSIONS, type Permission } from "./permissions";

const user = (overrides: Partial<WorkspacePrincipal> = {}): WorkspacePrincipal => ({ companyId: "company", role: "ACCOUNT_USER", isActive: true, salesRole: null, accountRole: null, salesAccessActive: false, accountAccessActive: false, managerType: null, ...overrides });
const can = (u: WorkspacePrincipal, permission: Permission, edition: "SALESPUNCH360" | "SALESPUNCH360_ACCOUNT" | "SALESPUNCH360_PLUS" = "SALESPUNCH360_PLUS") => canUsePermission(u, edition, permission);

describe("static module permission matrix", () => {
  const sales = (salesRole: WorkspacePrincipal["salesRole"], overrides = {}) => user({ role: salesRole === "PRIMARY_ADMIN" ? "COMPANY_ADMIN" : salesRole === "ADMIN" ? "FIELD_ADMIN" : salesRole!, salesRole, salesAccessActive: true, ...overrides });
  it("maps Sales roles explicitly", () => {
    expect(can(sales("PRIMARY_ADMIN"), "SALES_BILLING")).toBe(true);
    expect(can(sales("ADMIN"), "SALES_BILLING")).toBe(false);
    expect(can(sales("ADMIN"), "SALES_USER_ADMIN")).toBe(true);
    expect(can(sales("MANAGER"), "SALES_USER_ADMIN")).toBe(false);
    expect(can(sales("SALES"), "SALES_USER_ADMIN")).toBe(false);
    for (const role of ["MANAGER", "SALES"] as const) for (const permission of SALES_ROLE_PERMISSIONS[role]) expect(can(sales(role), permission)).toBe(true);
  });
  it("enforces Sales lifecycle and edition", () => {
    for (const permission of PERMISSIONS.filter(p => p.startsWith("SALES_"))) expect(can(sales("PRIMARY_ADMIN", { salesAccessActive: false }), permission)).toBe(false);
    expect(can(sales("SALES"), "SALES_DASHBOARD", "SALESPUNCH360_ACCOUNT")).toBe(false);
  });
  it("maps Account roles explicitly", () => {
    for (const [role, permissions] of Object.entries(ACCOUNT_ROLE_PERMISSIONS)) {
      const actor = user({ accountRole: role as WorkspacePrincipal["accountRole"], accountAccessActive: true });
      for (const permission of permissions) expect(can(actor, permission)).toBe(true);
    }
    expect(can(user({ accountRole: "ACCOUNTANT", accountAccessActive: true }), "ACCOUNT_USER_ADMIN")).toBe(false);
    expect(can(user({ accountRole: "PROJECT_MANAGER", accountAccessActive: true }), "ACCOUNT_USER_ADMIN")).toBe(false);
    expect(can(user({ accountRole: "DATA_ENTRY", accountAccessActive: true }), "ACCOUNT_SETTINGS")).toBe(false);
  });
  it("enforces Account lifecycle and edition", () => {
    const admin = user({ accountRole: "ACCOUNT_ADMIN", accountAccessActive: true });
    for (const permission of PERMISSIONS.filter(p => p.startsWith("ACCOUNT_"))) expect(can({ ...admin, accountAccessActive: false }, permission)).toBe(false);
    expect(can(admin, "ACCOUNT_DASHBOARD", "SALESPUNCH360")).toBe(false);
  });
  it("keeps dual-role PLUS permissions independent", () => {
    const dual = user({ role: "MANAGER", salesRole: "MANAGER", accountRole: "PROJECT_MANAGER", salesAccessActive: true, accountAccessActive: true });
    expect(can(dual, "SALES_LEADS")).toBe(true); expect(can(dual, "ACCOUNT_PROJECTS")).toBe(true);
    expect(can({ ...dual, salesAccessActive: false }, "ACCOUNT_PROJECTS")).toBe(true);
    expect(can({ ...dual, accountAccessActive: false }, "SALES_LEADS")).toBe(true);
    for (const permission of PERMISSIONS) expect(can({ ...dual, isActive: false }, permission)).toBe(false);
  });
  it("never infers workspace authority from legacy Role", () => {
    for (const permission of PERMISSIONS) expect(can(user({ role: "SUPER_ADMIN", salesRole: "PRIMARY_ADMIN", accountRole: "ACCOUNT_ADMIN", salesAccessActive: true, accountAccessActive: true }), permission)).toBe(false);
    expect(can(user({ role: "FIELD_ADMIN", salesAccessActive: true }), "SALES_USER_ADMIN")).toBe(false);
    expect(can(user({ role: "ACCOUNT_USER", accountAccessActive: true }), "ACCOUNT_DASHBOARD")).toBe(false);
  });
});

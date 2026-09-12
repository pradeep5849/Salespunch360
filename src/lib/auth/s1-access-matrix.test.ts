import { describe, expect, it } from "vitest";
import type { AccountRole, ManagerType, ProductEdition, SalesRole } from "@prisma/client";
import { canUsePermission, canUsePermissionForMutation } from "./permissions";
import { resolveWorkspaceAccess, type WorkspacePrincipal } from "./workspace-policy";

const principal = (overrides: Partial<WorkspacePrincipal> = {}): WorkspacePrincipal => ({
  companyId: "tenant",
  role: "ACCOUNT_USER",
  isActive: true,
  salesRole: null,
  accountRole: null,
  salesAccessActive: false,
  accountAccessActive: false,
  managerType: null,
  ...overrides,
});

describe("S1 final workspace authorization matrix", () => {
  const editions: ProductEdition[] = ["SALESPUNCH360", "SALESPUNCH360_ACCOUNT", "SALESPUNCH360_PLUS"];
  const salesRoles: Array<[SalesRole, ManagerType | null]> = [
    ["PRIMARY_ADMIN", null], ["ADMIN", null], ["MANAGER", "FIELD_MANAGER"],
    ["MANAGER", "MANAGER_ONLY"], ["SALES", null],
  ];
  const accountRoles: AccountRole[] = ["ACCOUNT_ADMIN", "ACCOUNTANT", "PROJECT_MANAGER", "DATA_ENTRY"];

  it.each(editions)("requires edition, role, active access flag, tenant, and active identity for %s", (edition) => {
    for (const [salesRole, managerType] of salesRoles) {
      const actor = principal({ salesRole, managerType, salesAccessActive: true });
      expect(resolveWorkspaceAccess(actor, edition).canAccessSales).toBe(edition !== "SALESPUNCH360_ACCOUNT");
      expect(resolveWorkspaceAccess({ ...actor, salesAccessActive: false }, edition).canAccessSales).toBe(false);
      expect(resolveWorkspaceAccess({ ...actor, isActive: false }, edition).canAccessSales).toBe(false);
    }
    for (const accountRole of accountRoles) {
      const actor = principal({ accountRole, accountAccessActive: true });
      expect(resolveWorkspaceAccess(actor, edition).canAccessAccount).toBe(edition !== "SALESPUNCH360");
      expect(resolveWorkspaceAccess({ ...actor, accountAccessActive: false }, edition).canAccessAccount).toBe(false);
      expect(resolveWorkspaceAccess({ ...actor, companyId: null }, edition).canAccessAccount).toBe(false);
    }
  });

  it("treats a Plus preference as context only and revalidates stale preferences", () => {
    const salesOnly = principal({ salesRole: "SALES", salesAccessActive: true });
    const accountOnly = principal({ accountRole: "ACCOUNTANT", accountAccessActive: true });
    expect(resolveWorkspaceAccess(salesOnly, "SALESPUNCH360_PLUS", "ACCOUNT").effectiveWorkspace).toBe("SALES");
    expect(resolveWorkspaceAccess(accountOnly, "SALESPUNCH360_PLUS", "SALES").effectiveWorkspace).toBe("ACCOUNT");
    const dual = principal({ salesRole: "SALES", salesAccessActive: true, accountRole: "ACCOUNTANT", accountAccessActive: true });
    expect(resolveWorkspaceAccess(dual, "SALESPUNCH360_PLUS", "ACCOUNT")).toMatchObject({ canSwitchWorkspace: true, effectiveWorkspace: "ACCOUNT" });
  });

  it("enforces role distinctions and the Manager Only mutation boundary", () => {
    const additionalAdmin = principal({ salesRole: "ADMIN", salesAccessActive: true });
    expect(canUsePermission(additionalAdmin, "SALESPUNCH360", "SALES_BILLING")).toBe(false);
    const managerOnly = principal({ salesRole: "MANAGER", managerType: "MANAGER_ONLY", salesAccessActive: true });
    expect(canUsePermission(managerOnly, "SALESPUNCH360", "SALES_ATTENDANCE")).toBe(true);
    expect(canUsePermissionForMutation(managerOnly, "SALESPUNCH360", "SALES_ATTENDANCE")).toBe(false);
    const malformedManager = principal({ salesRole: "MANAGER", managerType: null, salesAccessActive: true });
    expect(canUsePermissionForMutation(malformedManager, "SALESPUNCH360", "SALES_ATTENDANCE")).toBe(false);
    const roles: Array<[AccountRole, Parameters<typeof canUsePermission>[2]]> = [
      ["ACCOUNTANT", "ACCOUNT_USER_ADMIN"], ["PROJECT_MANAGER", "ACCOUNT_JOURNAL_POST"],
      ["DATA_ENTRY", "ACCOUNT_QUOTATION_APPROVE"],
    ];
    for (const [accountRole, forbidden] of roles) {
      expect(canUsePermission(principal({ accountRole, accountAccessActive: true }), "SALESPUNCH360_ACCOUNT", forbidden)).toBe(false);
    }
  });
});

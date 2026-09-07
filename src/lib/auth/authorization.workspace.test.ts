import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), company: vi.fn(), redirect: vi.fn() }));
vi.mock("./session", () => ({ getAuthenticatedUser: mocks.user }));
vi.mock("@/lib/db", () => ({ db: { company: { findUnique: mocks.company } } }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import {
  requireAccountWorkspace,
  requireAccountWorkspaceForMutation,
  requirePermission,
  requirePermissionForMutation,
  requireSalesWorkspace,
  requireSalesWorkspaceForMutation,
  requireTenantUser,
} from "./authorization";

const principal = (overrides = {}) => ({
  id: "user",
  name: "User",
  email: "user@example.com",
  role: "MANAGER",
  isActive: true,
  managerType: "FIELD_MANAGER",
  salesRole: "MANAGER",
  accountRole: "PROJECT_MANAGER",
  salesAccessActive: true,
  accountAccessActive: true,
  companyId: "company",
  ...overrides,
});

describe("module permission server guards", () => {
  it("uses the authoritative Company edition", async () => {
    mocks.company.mockResolvedValue({ productEdition: "SALESPUNCH360" });
    await expect(requirePermission("SALES_REPORTS")).resolves.toMatchObject({ companyId: "company" });
    expect(mocks.company).toHaveBeenCalledWith({ where: { id: "company" }, select: { productEdition: true } });
  });
  it("rejects lifecycle inactivity, edition mismatch, and membership without a role", async () => {
    mocks.user.mockResolvedValueOnce(principal({ salesAccessActive: false }));
    await expect(requirePermission("SALES_REPORTS")).rejects.toMatchObject({ name: "AuthorizationError" });
    mocks.user.mockResolvedValueOnce(principal()); mocks.company.mockResolvedValueOnce({ productEdition: "SALESPUNCH360_ACCOUNT" });
    await expect(requirePermission("SALES_REPORTS")).rejects.toMatchObject({ name: "AuthorizationError" });
    mocks.user.mockResolvedValueOnce(principal({ salesRole: null }));
    await expect(requirePermission("SALES_REPORTS")).rejects.toMatchObject({ name: "AuthorizationError" });
  });
  it("mutation denial throws AuthorizationError without redirecting", async () => {
    mocks.user.mockResolvedValue(principal({ salesAccessActive: false }));
    await expect(requirePermissionForMutation("SALES_REPORTS")).rejects.toMatchObject({ name: "AuthorizationError" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(principal());
  mocks.company.mockResolvedValue({ productEdition: "SALESPUNCH360_PLUS" });
});

describe.each([
  ["Sales", requireSalesWorkspace, requireSalesWorkspaceForMutation, "salesAccessActive", "salesRole", "SALESPUNCH360"],
  ["Account", requireAccountWorkspace, requireAccountWorkspaceForMutation, "accountAccessActive", "accountRole", "SALESPUNCH360_ACCOUNT"],
] as const)("%s workspace server guards", (_workspace, pageGuard, mutationGuard, lifecycle, role, edition) => {
  it("passes using the authoritative company edition", async () => {
    mocks.company.mockResolvedValue({ productEdition: edition });
    await expect(pageGuard()).resolves.toMatchObject({ companyId: "company" });
    expect(mocks.company).toHaveBeenCalledWith({ where: { id: "company" }, select: { productEdition: true } });
  });

  it("rejects inactive workspace lifecycle", async () => {
    mocks.user.mockResolvedValue(principal({ [lifecycle]: false }));
    await expect(pageGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("rejects an edition mismatch", async () => {
    mocks.company.mockResolvedValue({ productEdition: edition === "SALESPUNCH360" ? "SALESPUNCH360_ACCOUNT" : "SALESPUNCH360" });
    await expect(pageGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("rejects missing company without querying a caller-provided edition", async () => {
    mocks.user.mockResolvedValue(principal({ companyId: null }));
    await expect(pageGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
    expect(mocks.company).not.toHaveBeenCalled();
  });

  it("rejects malformed SUPER_ADMIN workspace membership", async () => {
    mocks.user.mockResolvedValue(principal({ role: "SUPER_ADMIN" }));
    await expect(pageGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("proves tenant membership alone is insufficient", async () => {
    mocks.user.mockResolvedValue(principal({ [role]: null }));
    await expect(requireTenantUser()).resolves.toMatchObject({ companyId: "company" });
    await expect(pageGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
  });

  it("uses non-redirecting mutation authentication and throws AuthorizationError", async () => {
    mocks.user.mockResolvedValue(principal({ [lifecycle]: false }));
    await expect(mutationGuard()).rejects.toMatchObject({ name: "AuthorizationError" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

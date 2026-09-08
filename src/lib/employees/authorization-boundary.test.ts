import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(), mutation: vi.fn(), transaction: vi.fn(), findMany: vi.fn(), company: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: mocks.read, requirePermissionForMutation: mocks.mutation }));
vi.mock("@/lib/db", () => ({ db: { $transaction: mocks.transaction, user: { findMany: mocks.findMany }, company: { findFirst: mocks.company } } }));
vi.mock("@/lib/auth/crypto", () => ({ hashPassword: vi.fn().mockResolvedValue("hash") }));

import {
  createManager, createSalesEmployee, deactivateEmployee, editEmployee,
  getEmployeeManagementContext, listEmployees, reactivateEmployee, resetEmployeePassword,
} from "./service";

const denied = new Error("canonical permission denied");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockRejectedValue(denied);
  mocks.mutation.mockRejectedValue(denied);
});

describe("employee public permission boundaries", () => {
  it.each([
    ["listEmployees", () => listEmployees()],
    ["getEmployeeManagementContext", () => getEmployeeManagementContext()],
  ] as const)("authorizes %s with the canonical read permission before querying", async (_name, invoke) => {
    await expect(invoke()).rejects.toBe(denied);
    expect(mocks.read).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.findMany).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ["MANAGERS", "MANAGER"],
    ["SALES", "SALES"],
  ] as const)("filters %s employees by canonical salesRole", async (filter, salesRole) => {
    mocks.read.mockResolvedValue({ id: "admin", companyId: "company" });
    mocks.findMany.mockResolvedValue([]);
    await listEmployees(filter);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { companyId: "company", salesRole },
    }));
  });

  it.each([
    ["createManager", () => createManager({} as never)],
    ["createSalesEmployee", () => createSalesEmployee({} as never)],
    ["editEmployee", () => editEmployee({} as never)],
    ["deactivateEmployee", () => deactivateEmployee({})],
    ["reactivateEmployee", () => reactivateEmployee({})],
    ["resetEmployeePassword", () => resetEmployeePassword({} as never)],
  ] as const)("authorizes %s with the canonical mutation permission before mutation", async (_name, invoke) => {
    await expect(invoke()).rejects.toBe(denied);
    expect(mocks.mutation).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  mutation: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requirePermission: mocks.read,
  requirePermissionForMutation: mocks.mutation,
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));

import { getEmployeeProfile, updateEmployeeProfile } from "./employee-profile";

const employeeId = "11111111-1111-4111-8111-111111111111";
const input = {
  employeeId,
  name: " Taylor Sales ",
  email: "TAYLOR@EXAMPLE.COM",
  phone: "+1 (202) 555-0112",
  employeeCode: " sales-7 ",
  designation: " Sales Executive ",
  dateOfJoining: "2026-09-08",
};
const stored = {
  id: employeeId,
  name: "Taylor Sales",
  email: "taylor@example.com",
  phone: "+12025550112",
  employeeCode: "SALES-7",
  designation: "Sales Executive",
  dateOfJoining: new Date("2026-09-08T00:00:00.000Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ id: "actor", companyId: "company-a" });
  mocks.mutation.mockResolvedValue({ id: "actor", companyId: "company-a" });
  mocks.findMany.mockResolvedValue([]);
  mocks.update.mockResolvedValue(stored);
  mocks.transaction.mockImplementation((callback) => callback({
    user: { findFirst: mocks.findFirst, findMany: mocks.findMany, update: mocks.update },
  }));
});

describe("employee profile authorization and targeting", () => {
  it("uses canonical read permission before querying", async () => {
    const denied = new Error("denied");
    mocks.read.mockRejectedValue(denied);
    await expect(getEmployeeProfile(employeeId)).rejects.toBe(denied);
    expect(mocks.read).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("uses mutation-safe canonical permission before validating or mutating", async () => {
    const denied = new Error("denied");
    mocks.mutation.mockRejectedValue(denied);
    await expect(updateEmployeeProfile({ salesRole: "SALES" } as never)).rejects.toBe(denied);
    expect(mocks.mutation).toHaveBeenCalledWith("SALES_USER_ADMIN");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("reads only same-company canonical Manager/Sales targets without lifecycle filters", async () => {
    mocks.findFirst.mockResolvedValue(stored);
    await expect(getEmployeeProfile(employeeId)).resolves.toMatchObject({ dateOfJoining: "2026-09-08" });
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: { id: employeeId, companyId: "company-a", salesRole: { in: ["MANAGER", "SALES"] } },
      select: expect.any(Object),
    });
    const where = mocks.findFirst.mock.calls[0][0].where;
    expect(where).not.toHaveProperty("role");
    expect(where).not.toHaveProperty("isActive");
    expect(where).not.toHaveProperty("salesAccessActive");
  });

  it.each([
    "cross-company",
    "PRIMARY_ADMIN",
    "ADMIN",
    "salesRole=null account-only",
    "legacy MANAGER with salesRole=null",
    "legacy SALES with salesRole=null",
  ])("rejects an ineligible %s target", async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(getEmployeeProfile(employeeId)).rejects.toThrow("NOT_FOUND");
  });

  it.each([
    ["MANAGER", false, false],
    ["SALES", false, true],
    ["MANAGER", true, false],
  ])("allows canonical %s regardless of target lifecycle state", async (salesRole, isActive, salesAccessActive) => {
    mocks.findFirst.mockResolvedValue({ ...stored, salesRole, isActive, salesAccessActive });
    await expect(getEmployeeProfile(employeeId)).resolves.toBeDefined();
  });
});

describe("employee profile writes", () => {
  it("persists only canonical profile fields with shared normalization", async () => {
    mocks.findFirst.mockResolvedValue({ id: employeeId });
    await expect(updateEmployeeProfile(input)).resolves.toMatchObject({ dateOfJoining: "2026-09-08" });
    const call = mocks.update.mock.calls[0][0];
    expect(call.data).toEqual({
      name: "Taylor Sales",
      email: "taylor@example.com",
      phone: "+12025550112",
      employeeCode: "SALES-7",
      designation: "Sales Executive",
      dateOfJoining: new Date("2026-09-08T00:00:00.000Z"),
    });
    for (const field of [
      "role", "salesRole", "accountRole", "accountAccessActive", "managerId", "managerType",
      "isActive", "salesAccessActive", "branchAccessScope", "branchAccesses",
      "travelAllowanceEnabled", "travelRatePerKm", "passwordHash", "sessionVersion",
    ]) expect(call.data).not.toHaveProperty(field);
  });

  it("stores omitted optional profile values consistently as null", async () => {
    mocks.findFirst.mockResolvedValue({ id: employeeId });
    await updateEmployeeProfile({ employeeId, name: "Taylor", email: "t@example.com" });
    expect(mocks.update.mock.calls[0][0].data).toMatchObject({
      phone: null, employeeCode: null, designation: null, dateOfJoining: null,
    });
  });

  it("preserves company-scoped Manager/Sales-only phone collision semantics", async () => {
    mocks.findFirst.mockResolvedValue({ id: employeeId });
    await updateEmployeeProfile(input);
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        companyId: "company-a",
        salesRole: { in: ["MANAGER", "SALES"] },
        phone: { not: null },
        id: { not: employeeId },
      },
      select: { phone: true },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mutation: vi.fn(),
  transaction: vi.fn(),
  queryRaw: vi.fn(),
  companyFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  userUpdateMany: vi.fn(),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requirePermission: vi.fn(),
  requirePermissionForMutation: mocks.mutation,
}));
vi.mock("@/lib/db", () => ({
  db: { $transaction: mocks.transaction },
}));

import { editEmployee } from "./service";

const employeeId = "11111111-1111-4111-8111-111111111111";
const managerId = "22222222-2222-4222-8222-222222222222";
const existingDate = new Date("2024-02-29T00:00:00.000Z");
const baseInput = {
  employeeId,
  name: "Edited Employee",
  email: "EDITED@EXAMPLE.COM",
  phone: "+1 (202) 555-0112",
  employeeCode: " emp-9 ",
};

function existingEmployee(salesRole: "MANAGER" | "SALES") {
  return {
    id: employeeId,
    companyId: "company-a",
    salesRole,
    salesAccessActive: true,
    isActive: true,
    managerId: salesRole === "SALES" ? managerId : null,
    managerType: salesRole === "MANAGER" ? "FIELD_MANAGER" : null,
    designation: "Existing Designation",
    dateOfJoining: existingDate,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mutation.mockResolvedValue({ id: "admin", companyId: "company-a" });
  mocks.queryRaw.mockResolvedValue([{ id: "company-a" }]);
  mocks.companyFindFirst.mockResolvedValue({ teamStructure: "MANAGERS_AND_SALES" });
  mocks.userFindMany.mockResolvedValue([]);
  mocks.userUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation((callback) => callback({
    $queryRaw: mocks.queryRaw,
    company: { findFirst: mocks.companyFindFirst },
    user: {
      findFirst: mocks.userFindFirst,
      findMany: mocks.userFindMany,
      updateMany: mocks.userUpdateMany,
    },
  }));
});

describe("legacy employee edit profile preservation", () => {
  it("preserves omitted profile fields and existing Manager behavior", async () => {
    mocks.userFindFirst.mockResolvedValue(existingEmployee("MANAGER"));

    await editEmployee({ ...baseInput, managerType: "FIELD_MANAGER" });

    expect(mocks.userUpdateMany).toHaveBeenCalledWith({
      where: { id: employeeId, companyId: "company-a", salesRole: "MANAGER" },
      data: {
        name: "Edited Employee",
        email: "edited@example.com",
        phone: "+12025550112",
        employeeCode: "EMP-9",
        designation: "Existing Designation",
        dateOfJoining: existingDate,
        managerId: null,
        managerType: "FIELD_MANAGER",
      },
    });
  });

  it("updates explicit profile fields and preserves Sales manager assignment", async () => {
    mocks.userFindFirst.mockResolvedValue(existingEmployee("SALES"));

    await editEmployee({
      ...baseInput,
      managerId,
      designation: " Area Executive ",
      dateOfJoining: "2026-09-08",
    });

    expect(mocks.userUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: employeeId, companyId: "company-a", salesRole: "SALES" },
      data: expect.objectContaining({
        designation: "Area Executive",
        dateOfJoining: new Date("2026-09-08T00:00:00.000Z"),
        managerId,
        managerType: null,
      }),
    }));
  });

  it("keeps phone uniqueness scoped to same-company canonical Manager/Sales users", async () => {
    mocks.userFindFirst.mockResolvedValue(existingEmployee("SALES"));

    await editEmployee(baseInput);

    expect(mocks.userFindMany).toHaveBeenCalledWith({
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

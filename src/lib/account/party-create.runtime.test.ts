import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  branch: vi.fn(),
  create: vi.fn(),
  definitions: vi.fn(),
  value: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class extends Error {},
  requirePermission: m.auth,
  requirePermissionForMutation: m.auth,
}));
vi.mock("@/lib/db", () => ({ db: { $transaction: m.transaction } }));
import { createPartyWithCustomValues } from "./service";
const branch = "22222222-2222-4222-8222-222222222222",
  foreign = "33333333-3333-4333-8333-333333333333";
describe("A071 Account party creation with explicit branch and custom values", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.auth.mockResolvedValue({
      companyId: "company",
      accountRole: "ACCOUNT_ADMIN",
      branchAccessScope: "SELECTED_BRANCHES",
      branchIds: [branch],
    });
    m.branch.mockResolvedValue({ id: branch });
    m.create.mockResolvedValue({ id: "customer" });
    m.definitions.mockResolvedValue([]);
    m.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({
        branch: { findFirst: m.branch },
        customer: { create: m.create },
        customFieldDefinition: { findMany: m.definitions },
        customFieldValue: { upsert: m.value },
      }),
    );
  });
  it("creates an Account customer in the explicit authorized branch without Sales access", async () => {
    await createPartyWithCustomValues(
      "customers",
      { name: "Customer" },
      {},
      branch,
    );
    expect(m.auth).toHaveBeenCalledWith("ACCOUNT_ACCOUNTS");
    expect(m.branch).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company", id: branch, isActive: true },
      }),
    );
    expect(m.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company",
          branchId: branch,
          isAccountCustomer: true,
        }),
      }),
    );
  });
  it("rejects unassigned and missing/inactive branch before customer creation", async () => {
    await expect(
      createPartyWithCustomValues("customers", { name: "Denied" }, {}, foreign),
    ).rejects.toThrow();
    expect(m.transaction).not.toHaveBeenCalled();
    m.branch.mockResolvedValueOnce(null);
    await expect(
      createPartyWithCustomValues("customers", { name: "Denied" }, {}, branch),
    ).rejects.toThrow();
    expect(m.create).not.toHaveBeenCalled();
  });
  it("accepts a required Boolean false in the same customer transaction", async () => {
    m.definitions.mockResolvedValue([
      {
        id: "field",
        fieldKey: "confirmed",
        dataType: "BOOLEAN",
        isRequired: true,
        isActive: true,
        options: null,
      },
    ]);
    await createPartyWithCustomValues(
      "customers",
      { name: "Customer" },
      { confirmed: "false" },
      branch,
    );
    expect(m.value).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          entityId: "customer",
          entityType: "CUSTOMER",
          value: false,
        }),
      }),
    );
  });
});

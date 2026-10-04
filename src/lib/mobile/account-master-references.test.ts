import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ category: vi.fn(), unit: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    accountCategory: { findFirst: mocks.category },
    accountUnit: { findFirst: mocks.unit },
  },
}));
import { validateMobileItemReferences } from "./account-master-references";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.category.mockResolvedValue({ id: "category" });
  mocks.unit.mockResolvedValue({ id: "unit" });
});

describe("mobile item reference validation", () => {
  it.each(["PRODUCT", "SERVICE"] as const)(
    "accepts active company references compatible with %s",
    async (scope) => {
      await validateMobileItemReferences(
        "company",
        { categoryId: "category", unitId: "unit" },
        scope,
      );
      expect(mocks.category).toHaveBeenCalledWith({
        where: {
          id: "category",
          companyId: "company",
          isActive: true,
          scope: { in: [scope, "BOTH"] },
        },
        select: { id: true },
      });
      expect(mocks.unit).toHaveBeenCalledWith({
        where: { id: "unit", companyId: "company", isActive: true },
        select: { id: true },
      });
    },
  );
  it("rejects missing, foreign, inactive or incompatible categories", async () => {
    mocks.category.mockResolvedValue(null);
    await expect(
      validateMobileItemReferences(
        "company",
        { categoryId: "foreign" },
        "SERVICE",
      ),
    ).rejects.toThrow("INVALID_INPUT");
    expect(mocks.unit).not.toHaveBeenCalled();
  });
  it("rejects missing, foreign or inactive units", async () => {
    mocks.unit.mockResolvedValue(null);
    await expect(
      validateMobileItemReferences("company", { unitId: "foreign" }, "SERVICE"),
    ).rejects.toThrow("INVALID_INPUT");
  });
  it("allows an item with no optional references", async () => {
    await validateMobileItemReferences("company", {}, "SERVICE");
    expect(mocks.category).not.toHaveBeenCalled();
    expect(mocks.unit).not.toHaveBeenCalled();
  });
});

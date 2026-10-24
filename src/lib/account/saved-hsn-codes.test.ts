import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ products: vi.fn(), services: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    accountProduct: { findMany: mocks.products },
    accountService: { findMany: mocks.services },
  },
}));
import { savedHsnCodes } from "./saved-hsn-codes";
describe("company saved HSN/SAC codes", () => {
  beforeEach(() => vi.resetAllMocks());
  it("scopes both catalogues to the company and active items", async () => {
    mocks.products.mockResolvedValue([{ hsnCode: "4412" }]);
    mocks.services.mockResolvedValue([{ sacCode: "9983" }]);
    expect(await savedHsnCodes("company-a")).toEqual(["4412", "9983"]);
    expect(mocks.products).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-a",
          isActive: true,
          hsnCode: { not: null },
        },
        distinct: ["hsnCode"],
      }),
    );
    expect(mocks.services).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          companyId: "company-a",
          isActive: true,
          sacCode: { not: null },
        },
        distinct: ["sacCode"],
      }),
    );
  });
  it("deduplicates, trims and excludes empty codes without inventing defaults", async () => {
    mocks.products.mockResolvedValue([
      { hsnCode: "4412 " },
      { hsnCode: "" },
      { hsnCode: null },
    ]);
    mocks.services.mockResolvedValue([{ sacCode: "4412" }, { sacCode: "  " }]);
    expect(await savedHsnCodes("company-a")).toEqual(["4412"]);
  });
  it("propagates load failures instead of presenting a false empty catalogue", async () => {
    mocks.products.mockRejectedValue(new Error("offline"));
    mocks.services.mockResolvedValue([]);
    await expect(savedHsnCodes("company-a")).rejects.toThrow("offline");
  });
});

import { describe, expect, it } from "vitest";
import { defaultSaleWarehouse } from "./sale-warehouse";
const first = { id: "first", branchId: "branch" };
describe("sale warehouse selection", () => {
  it("uses the sole branch-owned warehouse", () =>
    expect(defaultSaleWarehouse([first], "branch")).toBe(first));
  it("prefers the unique branch default", () => {
    const preferred = { ...first, id: "default", isDefault: true };
    expect(defaultSaleWarehouse([first, preferred], "branch")).toBe(preferred);
  });
  it.each(
    [
      [],
      [first, { ...first, id: "second" }],
      [
        { ...first, isDefault: true },
        { ...first, id: "second", isDefault: true },
      ],
    ].map((rows) => [rows]),
  )("requires selection for missing or ambiguous locations", (rows) =>
    expect(defaultSaleWarehouse(rows, "branch")).toBeUndefined(),
  );
  it("excludes other branches, inactive locations and missing branch metadata", () =>
    expect(
      defaultSaleWarehouse(
        [
          { id: "global" },
          { ...first, branchId: "other", isDefault: true },
          { ...first, isActive: false },
        ],
        "branch",
      ),
    ).toBeUndefined());
});

import { describe, expect, it } from "vitest";
import { assertItemMasterCreation } from "./item-master-policy";
import { resolveItemSettings } from "./item-settings-policy";
const defaults = resolveItemSettings(null);
describe("A058 authoritative item creation settings", () => {
  it.each([
    ["enabled", { unitId: "u" }, "ITEMS_DISABLED"],
    ["itemUnits", { unitId: "u" }, "ITEM_UNITS_DISABLED"],
    ["itemCategory", { categoryId: "c" }, "ITEM_CATEGORY_DISABLED"],
    ["description", { description: "text" }, "ITEM_DESCRIPTION_DISABLED"],
    ["hsnSac", { hsnSacCode: "1234" }, "ITEM_HSN_DISABLED"],
    ["itemWiseTax", { taxRate: "18" }, "ITEM_TAX_DISABLED"],
    ["stockMaintenance", { trackInventory: true }, "STOCK_FIELDS_DISABLED"],
    ["stockMaintenance", { lowStockThreshold: "1" }, "STOCK_FIELDS_DISABLED"],
    [
      "customFields",
      { customFields: { key: "saved" } },
      "ITEM_CUSTOM_FIELDS_DISABLED",
    ],
  ] as const)("rejects disabled %s business input", (flag, input, error) =>
    expect(() =>
      assertItemMasterCreation(
        { ...defaults, [flag]: false },
        "PRODUCT",
        input,
      ),
    ).toThrow(error),
  );
  it("enforces Products/Services type selection", () => {
    expect(() =>
      assertItemMasterCreation(
        { ...defaults, itemType: "PRODUCTS" },
        "SERVICE",
        {},
      ),
    ).toThrow("SERVICES_DISABLED");
    expect(() =>
      assertItemMasterCreation(
        { ...defaults, itemType: "SERVICES" },
        "PRODUCT",
        {},
      ),
    ).toThrow("PRODUCTS_DISABLED");
  });
  it("accepts configured fields and harmless blank/zero disabled input", () => {
    expect(() =>
      assertItemMasterCreation(defaults, "PRODUCT", {
        unitId: "u",
        categoryId: "c",
        description: "text",
        hsnSacCode: "1234",
        taxRate: "18",
        trackInventory: true,
      }),
    ).not.toThrow();
    expect(() =>
      assertItemMasterCreation(
        {
          ...defaults,
          itemUnits: false,
          itemCategory: false,
          hsnSac: false,
          itemWiseTax: false,
          stockMaintenance: false,
          description: false,
          customFields: false,
        },
        "SERVICE",
        {
          taxRate: "0",
          description: "",
          customFields: { key: "" },
          lowStockThreshold: 0,
        },
      ),
    ).not.toThrow();
  });
  it("never allows inventory tracking on a service", () =>
    expect(() =>
      assertItemMasterCreation(defaults, "SERVICE", { trackInventory: true }),
    ).toThrow("STOCK_FIELDS_DISABLED"));
});

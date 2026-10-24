import { describe, expect, it } from "vitest";
import { itemPriceForSelectedUnit } from "./item-pricing";
const base = {
  rate: "20", taxRate: "18", mode: "EXCLUSIVE", quantity: "1",
  selection: "SECONDARY" as const, secondaryUnitsPerBase: "0.1",
  pricing: { enteredSalePrice: "20", saleTaxMode: "EXCLUSIVE", discountType: "FIXED", normalizedDiscountValue: "1", discountValue: "1", normalizedWholesalePrice: "15", wholesalePrice: "15" },
};
describe("primary-unit catalogue defaults", () => {
  it("prices one box as ten pieces and scales the saved per-piece discount", () => {
    const result = itemPriceForSelectedUnit(base);
    expect(result.rate.toString()).toBe("200");
    expect(result.discountValue.toString()).toBe("10");
  });
  it("prefers an active wholesale catalogue rate and retains the sale discount", () => {
    const result = itemPriceForSelectedUnit({ ...base, quantity: "3", priceKind: "WHOLESALE", wholesaleRate: "12" });
    expect(result.rate.toString()).toBe("120");
    expect(result.discountValue.toString()).toBe("30");
    expect(itemPriceForSelectedUnit({ ...base, priceKind: "WHOLESALE" }).rate.toString()).toBe("150");
  });
  it("converts the separate customer price and inclusive tax once", () => {
    const result = itemPriceForSelectedUnit({ ...base, priceKind: "CUSTOMER", customerRate: "10", mode: "INCLUSIVE" });
    expect(result.rate.toString()).toBe("118");
    expect(result.discountValue.toString()).toBe("11.8");
  });
  it("preserves percentage discounts and excludes sale discounts from purchases", () => {
    expect(itemPriceForSelectedUnit({ ...base, pricing: { ...base.pricing, discountType: "PERCENTAGE", normalizedDiscountValue: "10" } }).discountValue.toString()).toBe("10");
    const purchase = itemPriceForSelectedUnit({ ...base, purchase: true });
    expect(purchase.rate.toString()).toBe("200");
    expect(purchase.discountType).toBeUndefined();
    expect(purchase.discountValue.toString()).toBe("0");
  });
  it("allows an empty-quantity preview without a discount but still requires a valid mapping", () => {
    expect(itemPriceForSelectedUnit({ ...base, quantity: "0" }).discountValue.toString()).toBe("0");
    expect(() => itemPriceForSelectedUnit({ ...base, quantity: "0", secondaryUnitsPerBase: undefined })).toThrow("UNIT_CONVERSION_UNAVAILABLE");
  });
  it("uses fractional primary quantities without changing a percentage", () => {
    const result = itemPriceForSelectedUnit({ ...base, quantity: "0.5" });
    expect(result.rate.toString()).toBe("200");
    expect(result.discountValue.toString()).toBe("5");
    const primary = itemPriceForSelectedUnit({ ...base, selection: "PRIMARY", quantity: "3" });
    expect(primary.rate.toString()).toBe("20");
    expect(primary.discountValue.toString()).toBe("3");
  });
  it("rejects stock precision loss and negative quantity", () => {
    expect(() => itemPriceForSelectedUnit({ ...base, quantity: "1", secondaryUnitsPerBase: "3" })).toThrow("UNIT_CONVERSION_PRECISION");
    expect(() => itemPriceForSelectedUnit({ ...base, quantity: "-1" })).toThrow("INVALID_UNIT_QUANTITY");
  });
});

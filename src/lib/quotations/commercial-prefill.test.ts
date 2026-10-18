import {describe, expect, it} from "vitest";
import {quotationCommercialPrefill} from "./commercial-prefill";
const line = {lineType: "CUSTOM" as const, itemName: "Installation", quantity: "3", rate: "100", taxRate: "18"};
describe("A080/A083 quotation to commercial prefill", () => {
  it("preserves quantity, negotiated rate and tax without applying today's master prices", () => {
    expect(quotationCommercialPrefill([line])).toMatchObject({taxMode: "EXCLUSIVE", grandTotal: "354.00", lines: [{quantity: "3", rate: "100.00", taxRate: "18"}]});
  });
  it("combines the saved line discount and allocated document discount exactly", () => {
    const result = quotationCommercialPrefill([{...line, discountType: "PERCENTAGE", discountValue: "10"}], [{label: "Agreed discount", type: "DISCOUNT", valueType: "FIXED", value: "20"}]);
    expect(result).toMatchObject({grandTotal: "295.00", lines: [{discountType: "FIXED", discountValue: "50.00"}]});
  });
  it("retains mixed-rate proportional rounding and multiple document discounts", () => {
    const result = quotationCommercialPrefill([0, 5, 18].map(taxRate => ({...line, quantity: "1", rate: "1", taxRate})), [
      {label: "First", type: "DISCOUNT", valueType: "FIXED", value: "0.01"},
      {label: "Second", type: "DISCOUNT", valueType: "PERCENTAGE", value: "10"},
    ]);
    expect(result.lines.map(row => row.discountValue)).toEqual(["0.10", "0.10", "0.11"]);
    expect(result.grandTotal).toBe("2.90");
  });
  it("keeps labelled taxable and non-taxable charges with their calculated amounts", () => {
    const result = quotationCommercialPrefill([line], [
      {label: "Transport", type: "ADDITIONAL_CHARGE", valueType: "FIXED", value: "50", taxable: true, taxRate: "5"},
      {label: "Handling", type: "ADDITIONAL_CHARGE", valueType: "PERCENTAGE", value: "10", taxable: false, taxRate: "18"},
    ]);
    expect(result).toMatchObject({grandTotal: "441.50", lines: [expect.anything(),
      {lineType: "CUSTOM", itemName: "Transport", quantity: "1", rate: "50.00", taxRate: "5"},
      {lineType: "CUSTOM", itemName: "Handling", rate: "35.00", taxRate: "0"}]});
  });
  it.each(["PRODUCT", "SERVICE", "WORK_PACKAGE"] as const)("retains canonical %s identity", lineType => {
    const result = quotationCommercialPrefill([{...line, lineType, productId: "product", serviceId: "service", workPackageId: "package"}]);
    expect(result.lines[0].sourceId).toBe(({PRODUCT: "product", SERVICE: "service", WORK_PACKAGE: "package"})[lineType]);
  });
  it("does not leak internal cost, payment, stock or source line identity", () => {
    const source = {...line, internalUnitCost: "SECRET-COST", id: "source-line", warehouseId: "private-stock", allocations: ["payment"]};
    const result = quotationCommercialPrefill([{...source, internalUnitCost: "60"}]);
    expect(Object.keys(result.lines[0]).sort()).toEqual(["discountType", "discountValue", "itemName", "lineType", "quantity", "rate", "taxRate"]);
    result.lines[0].quantity = "9";
    expect(source.quantity).toBe("3");
  });
  it("rejects missing master identities instead of converting them to unrelated custom items", () => {
    expect(() => quotationCommercialPrefill([{...line, lineType: "PRODUCT"}])).toThrow("INVALID_QUOTATION_LINE_REFERENCE");
  });
  it("refuses excess lines instead of dropping extra charges", () => {
    expect(() => quotationCommercialPrefill(Array.from({length: 500}, () => line), [{label: "Delivery", type: "ADDITIONAL_CHARGE", valueType: "FIXED", value: "1"}])).toThrow("CONVERSION_LINE_LIMIT_EXCEEDED");
  });
  it("handles zero-valued estimates and omits zero-valued additional charges", () => {
    const result = quotationCommercialPrefill([{...line, rate: "0"}], [{label: "Free delivery", type: "ADDITIONAL_CHARGE", valueType: "FIXED", value: "0"}]);
    expect(result.grandTotal).toBe("0.00"); expect(result.lines).toHaveLength(1);
  });
  it("rejects a snapshot whose rate precision cannot be represented by the commercial model", () => {
    expect(() => quotationCommercialPrefill([{...line, rate: "0.005"}])).toThrow("CONVERSION_TOTAL_MISMATCH");
  });
});

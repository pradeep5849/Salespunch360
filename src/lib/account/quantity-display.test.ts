import { describe, expect, it } from "vitest";
import { formatStockQuantity } from "./quantity-display";
describe("A060 exact web/native quantity display parity", () => {
  it.each(["-12", "-12.3", "-12.35", "-12.346", "-12.3457"])(
    "formats the configured decimals as %s",
    (expected) => {
      const decimals = expected.includes(".")
        ? expected.length - expected.indexOf(".") - 1
        : 0;
      expect(formatStockQuantity("-12.34567", decimals)).toBe(expected);
    },
  );
  it("rounds decimal ties without binary floating point loss", () => {
    expect(formatStockQuantity("1.005", 2)).toBe("1.01");
    expect(formatStockQuantity("-1.005", 2)).toBe("-1.01");
    expect(formatStockQuantity("99999999999999.995", 2)).toBe(
      "100000000000000.00",
    );
  });
  it("keeps the negative sign when rounding to zero", () => {
    expect(formatStockQuantity("-0.1", 0)).toBe("-0");
    expect(formatStockQuantity("-0.001", 2)).toBe("-0.00");
    expect(formatStockQuantity("0", 4)).toBe("0.0000");
  });
  it("preserves carry and guards unsupported display settings", () => {
    expect(formatStockQuantity("1.9999", 2)).toBe("2.00");
    expect(formatStockQuantity("1.2", 7)).toBe("1.2000");
    expect(formatStockQuantity("1.2", Number.NaN)).toBe("1.20");
  });
  it("does not interpret invalid quantities as zero", () =>
    expect(() => formatStockQuantity("unavailable", 2)).toThrow(
      "INVALID_STOCK_QUANTITY",
    ));
});

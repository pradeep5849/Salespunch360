import { describe, expect, it } from "vitest";
import {
  stockDecimalCompare,
  stockDecimalFormat,
  stockDecimalSum,
} from "./stock-display-decimal";
describe("exact stock summary display", () => {
  it("keeps cents above Number's safe integer range and cancels signed balances", () => {
    expect(stockDecimalSum(["9999999999999999.99", "0.01"])).toBe(
      "10000000000000000.0000",
    );
    expect(stockDecimalSum(["0.1", "0.2", "-0.3"])).toBe("0.0000");
    expect(
      stockDecimalCompare("9999999999999999.9999", "10000000000000000"),
    ).toBe(-1);
  });
  it("rounds fractional/negative quantities half up at every supported precision", () => {
    expect(
      [0, 1, 2, 3, 4].map((p) => stockDecimalFormat("-1.2345", p)),
    ).toEqual(["-1", "-1.2", "-1.23", "-1.235", "-1.2345"]);
    expect(stockDecimalFormat("-0.0001", 2)).toBe("0.00");
    expect(stockDecimalFormat("1.25", 1)).toBe("1.3");
  });
  it("rejects malformed server values and unsupported precision", () => {
    expect(() => stockDecimalSum(["NaN"])).toThrow();
    expect(() => stockDecimalFormat("1", 5)).toThrow();
  });
});

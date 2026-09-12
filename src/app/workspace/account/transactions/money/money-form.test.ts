import { describe, expect, it } from "vitest";
import { resolveInitialMoneyType } from "./money-form";

describe("money transaction query preselection", () => {
  it.each(["CUSTOMER_RECEIPT", "VENDOR_PAYMENT"])("preselects allowed %s", type => {
    expect(resolveInitialMoneyType(["CUSTOMER_RECEIPT", "VENDOR_PAYMENT"], type)).toBe(type);
  });
  it("falls back for invalid or disabled types", () => {
    expect(resolveInitialMoneyType(["CUSTOMER_RECEIPT"], "NOT_REAL")).toBe("CUSTOMER_RECEIPT");
    expect(resolveInitialMoneyType(["CUSTOMER_RECEIPT"], "VENDOR_PAYMENT")).toBe("CUSTOMER_RECEIPT");
  });
});

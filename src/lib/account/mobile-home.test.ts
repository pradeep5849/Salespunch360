import { describe, expect, it } from "vitest";
import { accountHomeTransactionTypes, normalizedHomeTypes } from "./mobile-home";

describe("account mobile Home filters", () => {
  it("only permits mapped commercial types and removes duplicates", () => {
    expect(normalizedHomeTypes(["SALES_INVOICE", "EXPENSE", "SALES_INVOICE", "PURCHASE_BILL"]))
      .toEqual(["SALES_INVOICE", "PURCHASE_BILL"]);
  });
  it("does not advertise transaction filters without a commercial backend mapping", () => {
    expect(accountHomeTransactionTypes).not.toContain("EXPENSE");
    expect(accountHomeTransactionTypes).not.toContain("PAYMENT_IN");
  });
});

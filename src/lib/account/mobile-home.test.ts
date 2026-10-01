import { describe, expect, it } from "vitest";
import { accountHomeFilterKeys, accountHomeTransactionTypes, normalizedHomeTypes } from "./mobile-home";

describe("account mobile Home filters", () => {
  it("permits requested filter keys, rejects unknown keys, and removes duplicates", () => {
    expect(normalizedHomeTypes(["SALES_INVOICE", "EXPENSE", "SALES_INVOICE", "PURCHASE_BILL", "UNKNOWN"]))
      .toEqual(["SALES_INVOICE", "EXPENSE", "PURCHASE_BILL"]);
  });
  it("retains the commercial-document types used by the shared web/mobile query", () => {
    expect(accountHomeTransactionTypes).toContain("SUBCONTRACT_PURCHASE");
    expect(accountHomeFilterKeys).toContain("SALE_CANCELLED");
    expect(accountHomeFilterKeys).toContain("CUSTOMER_RECEIPT");
  });
});

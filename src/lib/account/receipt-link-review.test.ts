import { describe, it, expect } from "vitest";
import { receiptCents, receiptLinkReview } from "./receipt-link-review";
describe("receipt link review", () => {
  const limits = new Map([
    ["document:one", "593.00"],
    ["document:two", "100.00"],
  ]);
  it("links 593 from 1100 and leaves exactly 507 for future application", () => {
    expect(
      receiptLinkReview(
        "1100",
        [{ target: "document:one", amount: "593" }],
        limits,
      ),
    ).toEqual({ error: null, unused: BigInt(50700) });
  });
  it("rejects excess invoice amounts, excess cash, duplicate and unavailable targets", () => {
    for (const links of [
      [{ target: "document:one", amount: "594" }],
      [
        { target: "document:one", amount: "500" },
        { target: "document:two", amount: "100" },
      ],
      [
        { target: "document:one", amount: "1" },
        { target: "document:one", amount: "2" },
      ],
      [{ target: "foreign", amount: "1" }],
    ])
      expect(receiptLinkReview("593", links, limits).error).toBeTruthy();
  });
  it("supports an unlinked advance and rejects invalid or overprecise inputs", () => {
    expect(receiptLinkReview("1100", [], limits).unused).toBe(BigInt(110000));
    for (const value of ["Infinity", "1e3", "-1", "1.001", "", "NaN"])
      expect(receiptCents(value)).toBeNull();
    expect(receiptLinkReview("0", [], limits).error).toBeTruthy();
  });
  it("retains exact cents above JavaScript's safe integer range", () => {
    expect(receiptCents("9999999999999999.99")).toBe(
      BigInt("999999999999999999"),
    );
  });
});

import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { expenseTotals } from "./expense-totals";
import { categoryPostingLedger } from "./expenses";
const d = (x: string) => new Prisma.Decimal(x);
const base = {
  amount: d("100"),
  taxRate: d("0"),
  taxMode: "EXCLUSIVE" as const,
};
describe("A049-F11/A051-F09 expense totals", () => {
  it("preserves legacy aggregate entry without lines", () => {
    expect(expenseTotals(base).grandTotal.toFixed(2)).toBe("100.00");
  });
  it("calculates decimal quantity × rate, taxable charges, and round-off on the server", () => {
    const r = expenseTotals({
      ...base,
      billedItems: [
        { name: "Fuel", quantity: "1.25", rate: "10.12" },
        { name: "Travel", quantity: "2", rate: "1.50" },
      ],
      additionalCharges: "1",
      roundOffEnabled: true,
    });
    expect(r.taxable.toFixed(2)).toBe("16.65");
    expect(r.grandTotal.toFixed(2)).toBe("17.00");
    expect(r.roundOffAmount.toFixed(2)).toBe("0.35");
  });
  it("keeps precise total with rounding disabled", () => {
    const r = expenseTotals({ ...base, amount: d("10.30") });
    expect(r.grandTotal.toFixed(2)).toBe("10.30");
    expect(r.roundOffAmount.isZero()).toBe(true);
  });
  it.each(["EXCLUSIVE", "INCLUSIVE"] as const)(
    "reconciles GST and CESS in %s mode",
    (mode) => {
      const r = expenseTotals({
        ...base,
        amount: d(mode === "INCLUSIVE" ? "120" : "100"),
        taxRate: d("18"),
        cessRate: d("2"),
        taxMode: mode,
        sellerStateCode: "29",
        stateOfSupplyCode: "29",
      });
      expect(r.taxable.toFixed(2)).toBe("100.00");
      expect(r.cgst.toFixed(2)).toBe("9.00");
      expect(r.sgst.toFixed(2)).toBe("9.00");
      expect(r.cess.toFixed(2)).toBe("2.00");
      expect(r.grandTotal.toFixed(2)).toBe("120.00");
    },
  );
  it("routes interstate tax to IGST", () => {
    expect(
      expenseTotals({
        ...base,
        taxRate: d("18"),
        sellerStateCode: "29",
        stateOfSupplyCode: "27",
      }).igst.toFixed(2),
    ).toBe("18.00");
  });
  it.each(["0", "-1"])("rejects nonpositive aggregate %s", (amount) =>
    expect(() => expenseTotals({ ...base, amount: d(amount) })).toThrow(
      "INVALID_EXPENSE_AMOUNT",
    ),
  );
  it("rejects a rounded zero total", () =>
    expect(() =>
      expenseTotals({ ...base, amount: d("0.10"), roundOffEnabled: true }),
    ).toThrow("INVALID_EXPENSE_AMOUNT"));
  it.each([
    { name: "", quantity: "1", rate: "10" },
    { name: "Fuel", quantity: "0", rate: "10" },
    { name: "Fuel", quantity: "-1", rate: "10" },
    { name: "Fuel", quantity: "1", rate: "-1" },
    { name: "Fuel", quantity: "1.12345", rate: "10" },
  ])("rejects invalid billed line %j", (line) =>
    expect(() => expenseTotals({ ...base, billedItems: [line] })).toThrow(),
  );
  it("rejects totals beyond the database monetary precision", () =>
    expect(() =>
      expenseTotals({
        ...base,
        billedItems: [
          {
            name: "Overflow",
            quantity: "99999999999999",
            rate: "9999999999999999",
          },
        ],
      }),
    ).toThrow("INVALID_EXPENSE_AMOUNT"));
  it("rejects negative charges", () =>
    expect(() =>
      expenseTotals({ ...base, additionalCharges: "-1" }),
    ).toThrow());
});
describe("A050-F02 dual category mapping", () => {
  const both = {
    scope: "BOTH" as const,
    defaultLedgerAccountId: "expense",
    incomeLedgerAccountId: "income",
  };
  it("selects the matching class without using an expense ledger for income", () => {
    expect(categoryPostingLedger(both, false)).toBe("expense");
    expect(categoryPostingLedger(both, true)).toBe("income");
  });
  it("keeps historical BOTH expense use and requires an explicit income mapping", () => {
    expect(
      categoryPostingLedger({ ...both, incomeLedgerAccountId: null }, false),
    ).toBe("expense");
    expect(() =>
      categoryPostingLedger({ ...both, incomeLedgerAccountId: null }, true),
    ).toThrow("CATEGORY_INCOME_LEDGER_REQUIRED");
  });
  it.each([
    ["INCOME", false],
    ["EXPENSE", true],
  ] as const)("rejects cross-class %s", (scope, income) =>
    expect(() => categoryPostingLedger({ ...both, scope }, income)).toThrow(
      "EXPENSE_CATEGORY_CLASS_MISMATCH",
    ),
  );
});

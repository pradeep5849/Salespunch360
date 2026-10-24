import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import {
  expensePosting,
  recurringOccurrenceKey,
  requiresExpenseApproval,
} from "./expenses";
const d = (x: number) => new Prisma.Decimal(x);
describe("A9 expenses", () => {
  it("posts balanced expense with input tax", () => {
    const p = expensePosting({
      type: "PROJECT_EXPENSE",
      taxable: d(100),
      taxRate: d(18),
      categoryLedgerId: "expense",
      inputTaxLedgerId: "tax",
      destinationLedgerId: "cash",
    });
    expect(p.total.toString()).toBe("118");
    expect(
      p.lines.reduce((x, l) => x.add(l.debit).sub(l.credit), d(0)).isZero(),
    ).toBe(true);
  });
  it("credits other income", () =>
    expect(
      expensePosting({
        type: "OTHER_INCOME",
        taxable: d(50),
        taxRate: d(0),
        categoryLedgerId: "income",
        inputTaxLedgerId: "tax",
        destinationLedgerId: "bank",
      }).lines[1].credit.toString(),
    ).toBe("50"));
  it("rejects taxed other income until A12", () =>
    expect(() =>
      expensePosting({
        type: "OTHER_INCOME",
        taxable: d(50),
        taxRate: d(18),
        categoryLedgerId: "income",
        inputTaxLedgerId: "tax",
        destinationLedgerId: "bank",
      }),
    ).toThrow("OTHER_INCOME_TAX_REQUIRES_A12"));
  it("enforces threshold and occurrence idempotency", () => {
    expect(requiresExpenseApproval(d(101), true, d(100))).toBe(true);
    expect(recurringOccurrenceKey("template", new Date("2026-09-11"))).toBe(
      "template:2026-09-11",
    );
  });
});
it("requires a calendar payment date and stable recurring payment identity", async () => {
  const { recurringPaymentInput } = await import("./expenses");
  const input = {
    requestKey: "11111111-1111-4111-8111-111111111111",
    moneyAccountId: "22222222-2222-4222-8222-222222222222",
    paymentDate: "2026-10-12",
  };
  expect(recurringPaymentInput.parse(input)).toEqual(input);
  expect(
    recurringPaymentInput.safeParse({ ...input, paymentDate: "2026-02-30" })
      .success,
  ).toBe(false);
  expect(
    recurringPaymentInput.safeParse({ ...input, requestKey: "" }).success,
  ).toBe(false);
});

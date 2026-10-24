import { expect, it } from "vitest";
import { chequeTransactionTarget } from "./cheque-transaction-target";
it("opens the original sale for a single invoice payment", () =>
  expect(
    chequeTransactionTarget({
      settlementId: "payment",
      settlement: {
        type: "CUSTOMER_RECEIPT",
        allocations: [
          { documentId: "sale", document: { type: "SALES_INVOICE" } },
        ],
      },
    }),
  ).toMatchObject({
    kind: "DOCUMENT",
    href: "/workspace/account/sales/sale",
    nativeHref: "/workspace/account/sales/sale",
  }));
it("uses the existing native purchase destination for a single vendor bill", () =>
  expect(
    chequeTransactionTarget({
      settlementId: "payment",
      settlement: {
        type: "VENDOR_PAYMENT",
        allocations: [
          { documentId: "bill", document: { type: "PURCHASE_BILL" } },
        ],
      },
    }),
  ).toMatchObject({
    href: "/workspace/account/transactions/bill",
    nativeHref: "/workspace/account/purchases/bill",
  }));
it("opens the payment for multiple invoices instead of selecting one arbitrarily", () =>
  expect(
    chequeTransactionTarget({
      settlementId: "payment",
      settlement: {
        type: "CUSTOMER_RECEIPT",
        allocations: [
          { documentId: "first", document: { type: "SALES_INVOICE" } },
          { documentId: "second", document: { type: "SALES_INVOICE" } },
        ],
      },
    }),
  ).toMatchObject({
    kind: "SETTLEMENT",
    href: "/workspace/account/settlements/payment",
    nativeHref: "/workspace/account/settlements/payment?type=CUSTOMER_RECEIPT",
  }));
it.each(["CUSTOMER_ADVANCE", "VENDOR_ADVANCE"])(
  "keeps the advance print type in the native destination: %s",
  (type) =>
    expect(
      chequeTransactionTarget({
        settlementId: "advance",
        settlement: { type, allocations: [] },
      }),
    ).toMatchObject({
      kind: "SETTLEMENT",
      nativeHref: `/workspace/account/settlements/advance?type=${type}`,
    }),
);
it("does not fabricate a transaction for unlinked legacy cheques", () =>
  expect(
    chequeTransactionTarget({ settlementId: null, settlement: null }),
  ).toBeNull());

it("keeps mixed invoice/opening allocations on the payment source", () =>
  expect(
    chequeTransactionTarget({
      settlementId: "mixed",
      settlement: {
        type: "CUSTOMER_RECEIPT",
        allocations: [
          { documentId: "sale", document: { type: "SALES_INVOICE" } },
        ],
        openingAllocations: [{}],
      },
    }),
  ).toMatchObject({
    kind: "SETTLEMENT",
    href: "/workspace/account/settlements/mixed",
  }));

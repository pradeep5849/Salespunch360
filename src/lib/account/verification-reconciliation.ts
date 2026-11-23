import { Prisma } from "@prisma/client";
import { commercialLineAmounts } from "./commercial-line-amounts";
import {
  EFFECTIVE_DOCUMENT_ALLOCATION,
  EFFECTIVE_ADVANCE_APPLICATION,
  EFFECTIVE_SETTLEMENT,
} from "./settlement-policy";
import { verificationActions } from "./verification-actions";
import type { VerificationResult } from "./utilities";
type Scope = { financialYearId: string; startDate: Date; endDate: Date };
const D = Prisma.Decimal;
const sum = (rows: readonly { amount: Prisma.Decimal }[]) =>
  rows.reduce((n, row) => n.add(row.amount), new D(0));
const baseSelect = {
  id: true,
  documentNumber: true,
  type: true,
  grandTotal: true,
  payableAmount: true,
  balanceDue: true,
  subtotal: true,
  discountTotal: true,
  taxableTotal: true,
  taxTotal: true,
  cgstTotal: true,
  sgstTotal: true,
  igstTotal: true,
  cessTotal: true,
  freightAmount: true,
  otherChargesAmount: true,
  roundOffAmount: true,
  tdsAmount: true,
  tcsAmount: true,
  reverseCharge: true,
} as const;
export async function financialVerificationInTx(
  tx: Prisma.TransactionClient,
  companyId: string,
  scope?: Scope,
): Promise<VerificationResult[]> {
  const docWhere: Prisma.CommercialDocumentWhereInput = {
    companyId,
    status: "POSTED",
    ...(scope
      ? { issueDate: { gte: scope.startDate, lte: scope.endDate } }
      : {}),
  };
  const [documents, settlements, journals, years] = await Promise.all([
    tx.commercialDocument.findMany({
      where: docWhere,
      select: {
        ...baseSelect,
        journalEntry: { select: { status: true } },
        lifecycleSnapshot: { select: { state: true } },
        lines: {
          select: {
            quantity: true,
            rate: true,
            discountType: true,
            discountValue: true,
            baseAmount: true,
            discountAmount: true,
            taxableAmount: true,
            taxAmount: true,
            cgstAmount: true,
            sgstAmount: true,
            igstAmount: true,
            cessAmount: true,
          },
        },
        adjustments: {
          where: {
            companyId,
            status: "POSTED",
            journalEntry: { is: { status: "POSTED" } },
          },
          select: { type: true, grandTotal: true, payableAmount: true },
        },
        allocations: {
          where: { companyId, ...EFFECTIVE_DOCUMENT_ALLOCATION },
          select: { amount: true },
        },
        advanceApplications: {
          where: { companyId, ...EFFECTIVE_ADVANCE_APPLICATION },
          select: { amount: true },
        },
        returnRevisionTarget: {
          select: {
            credits: {
              where: {
                companyId,
                creditNote: {
                  status: "POSTED",
                  journalEntry: { is: { status: "POSTED" } },
                },
              },
              select: { appliedAmount: true },
            },
          },
        },
      },
    }),
    tx.accountSettlement.findMany({
      where: {
        companyId,
        ...EFFECTIVE_SETTLEMENT,
        ...(scope
          ? { transactionDate: { gte: scope.startDate, lte: scope.endDate } }
          : {}),
      },
      select: {
        id: true,
        settlementNumber: true,
        type: true,
        amount: true,
        discountAmount: true,
        remainingAmount: true,
        allocations: {
          where: { companyId },
          select: { amount: true, discountAmount: true },
        },
        openingAllocations: { where: { companyId }, select: { amount: true } },
        applications: {
          where: { companyId, journalEntry: { is: { status: "POSTED" } } },
          select: { amount: true },
        },
      },
    }),
    tx.journalEntry.findMany({
      where: {
        companyId,
        ...(scope ? { financialYearId: scope.financialYearId } : {}),
      },
      select: {
        id: true,
        journalNumber: true,
        entryDate: true,
        postedAt: true,
        status: true,
        financialYear: {
          select: {
            startDate: true,
            endDate: true,
            periodLock: { select: { lockedThrough: true, updatedAt: true } },
          },
        },
      },
    }),
    tx.financialYear.findMany({
      where: { companyId, ...(scope ? { id: scope.financialYearId } : {}) },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        status: true,
        periodLock: { select: { lockedThrough: true } },
      },
    }),
  ]);
  const totalsBad = documents.filter((doc) => {
    const totals = {
      subtotal: new D(0),
      discountTotal: new D(0),
      taxableTotal: new D(0),
      taxTotal: new D(0),
      cgstTotal: new D(0),
      sgstTotal: new D(0),
      igstTotal: new D(0),
      cessTotal: new D(0),
    };
    if (!doc.lines.length) return true;
    for (const line of doc.lines) {
      // Saved line prices/discounts are authoritative; current item/tax settings are never applied to history.
      try {
        const calculated = commercialLineAmounts(
          line.quantity,
          line.rate,
          line.discountValue === null ? undefined : line.discountType,
          line.discountValue ?? line.discountAmount,
        );
        if (
          !calculated.baseAmount.eq(line.baseAmount) ||
          !calculated.discountAmount.eq(line.discountAmount)
        )
          return true;
      } catch {
        return true;
      }
      if (
        !line.cgstAmount
          .add(line.sgstAmount)
          .add(line.igstAmount)
          .add(line.cessAmount)
          .eq(line.taxAmount)
      )
        return true;
      totals.subtotal = totals.subtotal.add(line.baseAmount);
      totals.discountTotal = totals.discountTotal.add(line.discountAmount);
      totals.taxableTotal = totals.taxableTotal.add(line.taxableAmount);
      totals.taxTotal = totals.taxTotal.add(line.taxAmount);
      totals.cgstTotal = totals.cgstTotal.add(line.cgstAmount);
      totals.sgstTotal = totals.sgstTotal.add(line.sgstAmount);
      totals.igstTotal = totals.igstTotal.add(line.igstAmount);
      totals.cessTotal = totals.cessTotal.add(line.cessAmount);
    }
    if (
      (Object.keys(totals) as (keyof typeof totals)[]).some(
        (key) => !totals[key].eq(doc[key]),
      )
    )
      return true;
    const grand = totals.taxableTotal
      .add(totals.taxTotal)
      .add(doc.freightAmount)
      .add(doc.otherChargesAmount)
      .add(doc.roundOffAmount)
      .add(doc.tcsAmount);
    return (
      !grand.eq(doc.grandTotal) ||
      (doc.payableAmount !== null &&
        !grand
          .sub(doc.reverseCharge ? doc.taxTotal : 0)
          .sub(doc.tdsAmount)
          .eq(doc.payableAmount))
    );
  });
  const balanceBad = documents.filter((doc) => {
    if (doc.type !== "SALES_INVOICE" && doc.type !== "PURCHASE_BILL")
      return false;
    const retired =
      doc.type === "SALES_INVOICE" &&
      (doc.journalEntry?.status === "REVERSED" ||
        Boolean(doc.lifecycleSnapshot));
    if (!retired && doc.journalEntry?.status !== "POSTED") return false;
    const adjustments = doc.adjustments
      .filter(
        (row) =>
          row.type ===
          (doc.type === "SALES_INVOICE" ? "CREDIT_NOTE" : "DEBIT_NOTE"),
      )
      .reduce((n, row) => n.add(row.payableAmount ?? row.grandTotal), new D(0));
    const carried = (doc.returnRevisionTarget?.credits ?? []).reduce(
      (n, row) => n.add(row.appliedAmount),
      new D(0),
    );
    const expected = retired
      ? new D(0)
      : new D(doc.payableAmount ?? doc.grandTotal)
          .sub(adjustments)
          .sub(carried)
          .sub(sum(doc.allocations))
          .sub(sum(doc.advanceApplications));
    return expected.lt(0);
  });
  const settlementBad = settlements.filter((row) => {
    const opening = sum(row.openingAllocations),
      allocated = sum(row.allocations);
    if (row.type === "CUSTOMER_ADVANCE" || row.type === "VENDOR_ADVANCE")
      return (
        !row.remainingAmount.eq(
          row.amount.sub(sum(row.applications)).sub(opening),
        ) ||
        row.remainingAmount.lt(0) ||
        !allocated.isZero()
      );
    const discount = row.allocations.reduce(
      (n, x) => n.add(x.discountAmount),
      new D(0),
    );
    return (
      !allocated.add(opening).eq(row.amount.add(row.discountAmount)) ||
      !discount.eq(row.discountAmount) ||
      !row.remainingAmount.isZero()
    );
  });
  const dateBad = journals.filter(
    (row) =>
      row.entryDate < row.financialYear.startDate ||
      row.entryDate > row.financialYear.endDate,
  );
  const afterLock = journals.filter((row) => {
    const lock = row.financialYear.periodLock;
    return (
      row.postedAt &&
      lock?.lockedThrough &&
      row.entryDate <= lock.lockedThrough &&
      row.postedAt > lock.updatedAt
    );
  });
  const yearBad = years.filter(
    (year) =>
      year.status === "CLOSED" &&
      (!year.periodLock?.lockedThrough ||
        year.periodLock.lockedThrough < year.endDate),
  );
  const check = (
    name: string,
    rows: readonly {
      id: string;
      label: string;
      kind: "document" | "journal";
    }[],
    recommendation: string,
    warning = false,
  ): VerificationResult =>
    verificationActions(
      {
        status: rows.length ? (warning ? "WARNING" : "ERROR") : "PASS",
        check: name,
        affected: rows.length,
        samples: rows.slice(0, 5).map((row) => row.label),
        recommendation,
      },
      rows,
    );
  return [
    check(
      "Posted document lines and header totals reconcile",
      totalsBad.map((row) => ({
        id: row.id,
        label: row.documentNumber,
        kind: "document",
      })),
      "Review the saved line prices, discounts, tax components and header charges. Use an authorized correction; do not rewrite posted history.",
    ),
    check(
      "Effective allocations do not exceed document payable",
      balanceBad.map((row) => ({
        id: row.id,
        label: row.documentNumber,
        kind: "document",
      })),
      "Review effective payments, advances, posted adjustments and retained credits against saved payable totals. The original balanceDue field is an entry snapshot, not a current balance cache. Reversed or released allocations are excluded from current payment.",
    ),
    {
      status: settlementBad.length ? "WARNING" : "PASS",
      check: "Posted settlement and advance totals reconcile",
      affected: settlementBad.length,
      samples: settlementBad.slice(0, 5).map((row) => row.settlementNumber),
      records: settlementBad
        .slice(0, 5)
        .map((row) => ({
          label: row.settlementNumber,
          href: `/workspace/account/settlements/${row.id}`,
        })),
      reviewHref: settlementBad.length
        ? "/workspace/account/settlements"
        : undefined,
      recommendation:
        "Review original receipt/payment allocations (including discounts/opening balances) or advance applications before a controlled correction. Released credits remain distinct from the original payment.",
    },
    check(
      "Journal dates belong to their financial year",
      dateBad.map((row) => ({
        id: row.id,
        label: row.journalNumber,
        kind: "journal",
      })),
      "Review the journal's saved date and financial year. Use the authorized accounting correction workflow.",
    ),
    check(
      "Posted journals respect the current lock boundary",
      afterLock.map((row) => ({
        id: row.id,
        label: row.journalNumber,
        kind: "journal",
      })),
      "Review the saved posting timestamp and the current period lock's last change. This flags a potential lock anomaly; it does not reconstruct earlier lock changes.",
      true,
    ),
    {
      status: yearBad.length ? "ERROR" : "PASS",
      check: "Closed financial years retain a full period lock",
      affected: yearBad.length,
      samples: yearBad.slice(0, 5).map((row) => row.name),
      reviewHref: yearBad.length
        ? "/workspace/account/utilities/period-locks"
        : undefined,
      recommendation:
        "An authorized Account Admin should review the closed year and its period lock. Verification does not change either.",
    },
    {
      status: "WARNING",
      coverage: "NOT_CHECKED",
      check: "Stock balances against an independent opening snapshot",
      affected: 0,
      samples: [],
      reviewHref: "/workspace/account/inventory/stock",
      recommendation:
        "Not checked: this system derives stock balances from its movement ledger; no independent opening/control balance is available for comparison. Reconcile saved openings, movement reports and a trusted stock count before relying on quantity completeness. Existing movement quantity and paired-transfer checks are separate.",
    },
  ];
}

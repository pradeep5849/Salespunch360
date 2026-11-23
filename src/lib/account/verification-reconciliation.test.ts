import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { financialVerificationInTx } from "./verification-reconciliation";
const D = (x: string | number) => new Prisma.Decimal(x),
  id = "00000000-0000-4000-8000-000000000003";
const line = () => ({
  quantity: D(1),
  rate: D(100),
  discountType: null,
  discountValue: null,
  baseAmount: D(100),
  discountAmount: D(0),
  taxableAmount: D(100),
  taxAmount: D(0),
  cgstAmount: D(0),
  sgstAmount: D(0),
  igstAmount: D(0),
  cessAmount: D(0),
});
const document = () => ({
  id,
  documentNumber: "INV1",
  type: "SALES_INVOICE",
  grandTotal: D(100),
  payableAmount: D(100),
  balanceDue: D(100),
  subtotal: D(100),
  discountTotal: D(0),
  taxableTotal: D(100),
  taxTotal: D(0),
  cgstTotal: D(0),
  sgstTotal: D(0),
  igstTotal: D(0),
  cessTotal: D(0),
  freightAmount: D(0),
  otherChargesAmount: D(0),
  roundOffAmount: D(0),
  tdsAmount: D(0),
  tcsAmount: D(0),
  reverseCharge: false,
  journalEntry: { status: "POSTED" },
  lifecycleSnapshot: null,
  lines: [line()],
  adjustments: [],
  allocations: [],
  advanceApplications: [],
  returnRevisionTarget: null,
});
const m = {
  commercialDocument: { findMany: vi.fn() },
  accountSettlement: { findMany: vi.fn() },
  journalEntry: { findMany: vi.fn() },
  financialYear: { findMany: vi.fn() },
};
const run = () =>
  financialVerificationInTx(
    m as unknown as Prisma.TransactionClient,
    "company",
  );
const find = (checks: Awaited<ReturnType<typeof run>>, name: string) =>
  checks.find((row) => row.check.includes(name))!;
beforeEach(() => {
  vi.clearAllMocks();
  for (const model of Object.values(m)) model.findMany.mockResolvedValue([]);
});
it("reconciles posted saved totals without querying current item or tax settings", async () => {
  m.commercialDocument.findMany.mockResolvedValue([document()]);
  expect(find(await run(), "lines and header").status).toBe("PASS");
  expect(m.commercialDocument.findMany.mock.calls[0][0].where).toEqual({
    companyId: "company",
    status: "POSTED",
  });
});
it("retains legitimate inclusive price rounding at the component/header boundary", async () => {
  const doc = document();
  Object.assign(doc, {
    taxableTotal: D("84.75"),
    taxTotal: D("15.26"),
    cgstTotal: D("7.63"),
    sgstTotal: D("7.63"),
    grandTotal: D("100.01"),
    payableAmount: D("100.01"),
  });
  Object.assign(doc.lines[0], {
    taxableAmount: D("84.75"),
    taxAmount: D("15.26"),
    cgstAmount: D("7.63"),
    sgstAmount: D("7.63"),
  });
  m.commercialDocument.findMany.mockResolvedValue([doc]);
  expect(find(await run(), "lines and header").status).toBe("PASS");
});
it("detects changed header sums and links only the affected saved document", async () => {
  const doc = document();
  doc.subtotal = D(101);
  m.commercialDocument.findMany.mockResolvedValue([doc]);
  expect(find(await run(), "lines and header")).toMatchObject({
    status: "ERROR",
    affected: 1,
    records: [{ label: "INV1", href: `/workspace/account/transactions/${id}` }],
  });
});
it("recomputes stored percentage discounts and rejects invalid line quantities", async () => {
  const doc = document();
  Object.assign(doc.lines[0], {
    discountType: "PERCENTAGE",
    discountValue: D(10),
    discountAmount: D(5),
  });
  m.commercialDocument.findMany.mockResolvedValue([doc]);
  expect(find(await run(), "lines and header").status).toBe("ERROR");
  doc.lines[0].quantity = D(0);
  expect(find(await run(), "lines and header").status).toBe("ERROR");
});
it("checks payable after reverse charge, withholding and header charges", async () => {
  const doc = document();
  Object.assign(doc, {
    grandTotal: D(130),
    payableAmount: D(110),
    taxTotal: D(18),
    cgstTotal: D(9),
    sgstTotal: D(9),
    freightAmount: D(10),
    otherChargesAmount: D(1),
    roundOffAmount: D(-1),
    tcsAmount: D(2),
    tdsAmount: D(2),
    reverseCharge: true,
  });
  Object.assign(doc.lines[0], {
    taxAmount: D(18),
    cgstAmount: D(9),
    sgstAmount: D(9),
  });
  m.commercialDocument.findMany.mockResolvedValue([doc]);
  expect(find(await run(), "lines and header").status).toBe("PASS");
  doc.payableAmount = D(130);
  expect(find(await run(), "lines and header").status).toBe("ERROR");
});
it("does not mistake the original balanceDue snapshot for current outstanding after payment", async () => {
  m.commercialDocument.findMany.mockResolvedValue([
    { ...document(), allocations: [{ amount: D(100) }] },
  ]);
  expect(find(await run(), "Effective allocations").status).toBe("PASS");
});
it("detects effective over-allocation and includes posted corrections and retained credit", async () => {
  const doc = {
    ...document(),
    adjustments: [
      { type: "CREDIT_NOTE", grandTotal: D(20), payableAmount: D(20) },
    ],
    returnRevisionTarget: { credits: [{ appliedAmount: D(30) }] },
    allocations: [{ amount: D(50) }],
  };
  m.commercialDocument.findMany.mockResolvedValue([doc]);
  expect(find(await run(), "Effective allocations").status).toBe("PASS");
  doc.allocations[0].amount = D(51);
  expect(find(await run(), "Effective allocations").status).toBe("ERROR");
});
it("retired invoices are zero economic exposure without rewriting their entry snapshot", async () => {
  m.commercialDocument.findMany.mockResolvedValue([
    {
      ...document(),
      journalEntry: { status: "REVERSED" },
      lifecycleSnapshot: { state: "REPLACED" },
      allocations: [{ amount: D(1000) }],
    },
  ]);
  expect(find(await run(), "Effective allocations").status).toBe("PASS");
});
it("reconciles original receipt discounts and opening allocations", async () => {
  const receipt = {
    id,
    settlementNumber: "PAY1",
    type: "CUSTOMER_RECEIPT",
    amount: D(95),
    discountAmount: D(5),
    remainingAmount: D(0),
    allocations: [{ amount: D(100), discountAmount: D(5) }],
    openingAllocations: [],
    applications: [],
  };
  m.accountSettlement.findMany.mockResolvedValue([receipt]);
  expect(find(await run(), "settlement and advance").status).toBe("PASS");
  receipt.allocations[0].amount = D(99);
  expect(find(await run(), "settlement and advance").status).toBe("WARNING");
});
it("reconciles advances against application journals and opening use without returning released credit twice", async () => {
  const advance = {
    id,
    settlementNumber: "ADV1",
    type: "CUSTOMER_ADVANCE",
    amount: D(100),
    discountAmount: D(0),
    remainingAmount: D(50),
    allocations: [],
    openingAllocations: [{ amount: D(10) }],
    applications: [{ amount: D(40) }],
  };
  m.accountSettlement.findMany.mockResolvedValue([advance]);
  expect(find(await run(), "settlement and advance").status).toBe("PASS");
  advance.remainingAmount = D(90);
  expect(find(await run(), "settlement and advance").status).toBe("WARNING");
});
it("checks year membership and flags posting after the latest current lock change", async () => {
  const journal = {
    id,
    journalNumber: "J1",
    entryDate: new Date("2026-11-23"),
    postedAt: new Date("2026-11-24T12:00Z"),
    status: "POSTED",
    financialYear: {
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      periodLock: {
        lockedThrough: new Date("2026-11-23"),
        updatedAt: new Date("2026-11-24T10:00Z"),
      },
    },
  };
  m.journalEntry.findMany.mockResolvedValue([journal]);
  expect(find(await run(), "dates belong").status).toBe("PASS");
  expect(find(await run(), "current lock boundary").status).toBe("WARNING");
  journal.entryDate = new Date("2026-03-31");
  expect(find(await run(), "dates belong").status).toBe("ERROR");
});
it("requires a closed year to keep its full closing boundary", async () => {
  const year = {
    id,
    name: "Year",
    status: "CLOSED",
    startDate: new Date("2026-04-01"),
    endDate: new Date("2027-03-31"),
    periodLock: null,
  };
  m.financialYear.findMany.mockResolvedValue([year]);
  expect(find(await run(), "Closed financial years").status).toBe("ERROR");
});
it("does not claim independent opening/physical stock verification from the same movement ledger", async () => {
  const check = find(await run(), "independent opening snapshot");
  expect(check).toMatchObject({
    status: "WARNING",
    coverage: "NOT_CHECKED",
    affected: 0,
  });
  expect(check.recommendation).toContain(
    "no independent opening/control balance",
  );
});

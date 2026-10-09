import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m = vi.hoisted(() => ({
  tx: {} as ReturnType<typeof transaction>,
  journal: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    company: {
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ productEdition: "SALESPUNCH360_ACCOUNT" }),
    },
    $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
      fn(m.tx as unknown as Prisma.TransactionClient),
  },
}));
vi.mock("./modules", () => ({
  requireAccountModules: vi.fn(),
  enabledModulesForCompany: vi.fn().mockResolvedValue(["SALES"]),
}));
vi.mock("./numbering", () => ({
  SALES_INVOICE_NUMBERING_DEFAULTS: {},
  allocateDocumentNumberInTx: vi.fn().mockResolvedValue("01"),
}));
vi.mock("@/lib/accounting/service", () => ({ postJournalInTx: m.journal }));
import {
  createCommercialDocumentForActor,
  postCommercialDocumentForActor,
} from "./commercial";
import { stockValuation } from "./inventory-policy";
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const actor = {
  id: id(1),
  companyId: id(2),
  role: "ACCOUNT_USER",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as never;
const D = (n: number) => new Prisma.Decimal(n);
const warehouse = {
  id: id(5),
  branchId: id(3),
  isDefault: false,
  isActive: true,
};
function input(tax = "18", location: string | undefined = warehouse.id) {
  return {
    type: "SALES_INVOICE",
    branchId: id(3),
    partyId: id(4),
    issueDate: "2026-10-07",
    stateOfSupplyCode: tax === "0" ? undefined : "29",
    lines: [
      {
        lineType: "PRODUCT",
        sourceId: id(6),
        quantity: "1",
        rate: "100",
        taxRate: tax,
        warehouseId: location as string | undefined,
      },
    ],
  };
}
let product: ReturnType<typeof productFixture>;
function productFixture() {
  return {
    id: id(6),
    name: "Inventory item",
    code: null,
    description: null,
    salePrice: D(100),
    costPrice: D(10),
    taxRate: D(18),
    hsnCode: null,
    trackInventory: true,
    trackingMode: "NONE",
    unit: null,
  };
}
function transaction() {
  return {
    $queryRaw: vi.fn().mockResolvedValue([]),
    branch: {
      findFirst: vi
        .fn()
        .mockResolvedValue({ id: id(3), gstStateCode: "29", gstin: null }),
    },
    customer: {
      findFirst: vi.fn().mockResolvedValue({
        id: id(4),
        name: "Customer",
        stateCode: null,
        gstin: null,
        address: null,
      }),
    },
    accountSettings: {
      findUnique: vi.fn().mockResolvedValue({ negativeStockAllowed: false }),
    },
    accountProduct: {
      findFirst: vi.fn().mockImplementation(() => product),
      findMany: vi.fn().mockImplementation(() => [product]),
    },
    warehouse: {
      findFirst: vi.fn().mockResolvedValue(warehouse),
      findMany: vi.fn().mockResolvedValue([warehouse]),
    },
    commercialDocument: {
      create: vi
        .fn()
        .mockImplementation(
          ({
            data,
          }: {
            data: Prisma.CommercialDocumentUncheckedCreateInput;
          }) => ({ id: id(7), ...data }),
        ),
      findFirst: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    commercialAuditEvent: { create: vi.fn() },
    stockMovement: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    inventoryBatch: {
      findFirst: vi.fn().mockResolvedValue({ expiryDate: null }),
    },
    inventorySerialNumber: {
      findFirst: vi.fn().mockResolvedValue({ expiryDate: null }),
    },
    financialYear: { findFirst: vi.fn().mockResolvedValue({ id: id(8) }) },
    accountingPeriodLock: { findFirst: vi.fn().mockResolvedValue(null) },
    ledgerAccount: {
      findMany: vi
        .fn()
        .mockImplementation(
          ({ where }: { where: { systemKey: { in: string[] } } }) =>
            where.systemKey.in.map((key) => ({ id: key, systemKey: key })),
        ),
    },
    authorizedSignatureVersion: { findFirst: vi.fn().mockResolvedValue(null) },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  product = productFixture();
  m.tx = transaction();
  m.journal.mockResolvedValue({ id: id(9) });
});
async function preparePosting(stock: number, quantity: number) {
  const created = await createCommercialDocumentForActor(actor, input());
  const snapshot = m.tx.commercialDocument.create.mock.calls[0][0].data;
  const savedLines = snapshot.lines!
    .create as Prisma.CommercialDocumentLineUncheckedCreateWithoutDocumentInput[];
  const lines = savedLines.map((line) => ({
    ...line,
    id: id(10),
    quantity: D(quantity),
    purchaseAllocations: [],
  }));
  m.tx.commercialDocument.findFirst.mockResolvedValue({
    ...created,
    status: "DRAFT",
    journalEntryId: null,
    lines,
  });
  const prior =
    stock === 0
      ? []
      : [
          {
            movementType: stock > 0 ? "OPENING" : "SALE",
            quantity: D(Math.abs(stock)),
            unitCost: D(10),
          },
        ];
  m.tx.stockMovement.findMany.mockResolvedValue(prior);
  return prior;
}
describe("sale invoice save and inventory regression", () => {
  it("saves a GST inventory sale with Karnataka State of Supply", async () => {
    await createCommercialDocumentForActor(actor, input());
    const doc = m.tx.commercialDocument.create.mock.calls[0][0].data;
    expect(doc.stateOfSupplyCode).toBe("29");
    const nestedLines = doc.lines!
      .create as Prisma.CommercialDocumentLineUncheckedCreateWithoutDocumentInput[];
    expect(nestedLines[0]).not.toHaveProperty("companyId");
    expect(String(doc.cgstTotal)).toBe("9");
    expect(String(doc.sgstTotal)).toBe("9");
    expect(String(doc.igstTotal)).toBe("0");
    expect(String(doc.grandTotal)).toBe("118");
    expect(m.tx.stockMovement.create).not.toHaveBeenCalled();
    expect(m.journal).not.toHaveBeenCalled();
  });
  it("saves a non-GST sale without State of Supply", async () => {
    await createCommercialDocumentForActor(actor, input("0"));
    const doc = m.tx.commercialDocument.create.mock.calls[0][0].data;
    expect(doc.stateOfSupplyCode).toBeNull();
    expect(String(doc.taxTotal)).toBe("0");
    expect(String(doc.grandTotal)).toBe("100");
  });
  it("automatically resolves the only active branch warehouse", async () => {
    const raw = input();
    raw.lines[0].warehouseId = undefined;
    await createCommercialDocumentForActor(actor, raw);
    const lines = m.tx.commercialDocument.create.mock.calls[0][0].data.lines!
      .create as Prisma.CommercialDocumentLineUncheckedCreateWithoutDocumentInput[];
    expect(lines[0].warehouseId).toBe(warehouse.id);
    expect(m.tx.warehouse.findMany).toHaveBeenCalledWith({
      where: { companyId: id(2), branchId: id(3), isActive: true },
      select: { id: true, branchId: true, isDefault: true },
    });
  });
  it("uses the unique default instead of the first warehouse", async () => {
    const chosen = { ...warehouse, id: id(11), isDefault: true };
    m.tx.warehouse.findMany.mockResolvedValue([warehouse, chosen]);
    m.tx.warehouse.findFirst.mockResolvedValue(chosen);
    const raw = input();
    raw.lines[0].warehouseId = undefined;
    await createCommercialDocumentForActor(actor, raw);
    expect(m.tx.warehouse.findFirst).toHaveBeenCalledWith({
      where: {
        id: chosen.id,
        companyId: id(2),
        branchId: id(3),
        isActive: true,
      },
    });
  });
  it.each(
    [[], [warehouse, { ...warehouse, id: id(11) }]].map((rows) => [rows]),
  )(
    "requires warehouse selection when no deterministic warehouse exists (%j)",
    async (warehouses) => {
      m.tx.warehouse.findMany.mockResolvedValue(warehouses);
      const raw = input();
      raw.lines[0].warehouseId = undefined;
      await expect(
        createCommercialDocumentForActor(actor, raw),
      ).rejects.toThrow("WAREHOUSE_REQUIRED_FOR_INVENTORY");
      expect(m.tx.commercialDocument.create).not.toHaveBeenCalled();
    },
  );
  it("rejects a warehouse from a different branch without falling back", async () => {
    m.tx.warehouse.findFirst.mockResolvedValue(null);
    await expect(
      createCommercialDocumentForActor(actor, input()),
    ).rejects.toThrow("INVALID_INVENTORY_WAREHOUSE");
    expect(m.tx.warehouse.findFirst).toHaveBeenCalledWith({
      where: {
        id: warehouse.id,
        companyId: id(2),
        branchId: id(3),
        isActive: true,
      },
    });
    expect(m.tx.warehouse.findMany).not.toHaveBeenCalled();
  });
  it.each([
    [10, 3, 7],
    [0, 1, -1],
    [-2, 3, -5],
  ])(
    "posts ordinary sale from stock %s minus %s to %s with negative stock disabled",
    async (stock, quantity, expected) => {
      const prior = await preparePosting(stock, quantity);
      await postCommercialDocumentForActor(actor, { documentId: id(7) });
      expect(m.tx.stockMovement.create).toHaveBeenCalledTimes(1);
      const movement = m.tx.stockMovement.create.mock.calls[0][0].data;
      expect(movement.movementType).toBe("SALE");
      expect(stockValuation([...prior, movement]).quantity.toString()).toBe(
        String(expected),
      );
      expect(m.tx.commercialDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: "POSTED" }),
        }),
      );
      expect(m.journal).toHaveBeenCalledOnce();
    },
  );
  it.each(["BATCH", "SERIAL"])(
    "keeps %s tracking requirements at Save",
    async (tracking) => {
      product.trackingMode = tracking;
      await expect(
        createCommercialDocumentForActor(actor, input()),
      ).rejects.toThrow(
        tracking === "BATCH" ? "BATCH_REQUIRED" : "SERIAL_QUANTITY_MISMATCH",
      );
    },
  );
  it("keeps batch stock availability rules during posting", async () => {
    await preparePosting(0, 1);
    product.trackingMode = "BATCH";
    const doc = await m.tx.commercialDocument.findFirst();
    doc.lines[0].batchId = id(12);
    await expect(
      postCommercialDocumentForActor(actor, { documentId: id(7) }),
    ).rejects.toThrow("INSUFFICIENT_STOCK");
    expect(m.tx.stockMovement.create).not.toHaveBeenCalled();
  });
  it("keeps serial availability rules even when negative stock is enabled", async () => {
    await preparePosting(0, 1);
    product.trackingMode = "SERIAL";
    m.tx.accountSettings.findUnique.mockResolvedValue({
      negativeStockAllowed: true,
    });
    const doc = await m.tx.commercialDocument.findFirst();
    doc.lines[0].serialNumberId = id(12);
    await expect(
      postCommercialDocumentForActor(actor, { documentId: id(7) }),
    ).rejects.toThrow("SERIAL_NOT_AVAILABLE");
  });
  it.each(["BATCH", "SERIAL"])(
    "posts valid available %s-tracked stock",
    async (tracking) => {
      await preparePosting(1, 1);
      product.trackingMode = tracking;
      const doc = await m.tx.commercialDocument.findFirst();
      if (tracking === "BATCH") doc.lines[0].batchId = id(12);
      else doc.lines[0].serialNumberId = id(12);
      await postCommercialDocumentForActor(actor, { documentId: id(7) });
      expect(m.tx.stockMovement.create).toHaveBeenCalledOnce();
    },
  );
  it.each(["BATCH", "SERIAL"])(
    "still rejects expired %s-tracked stock",
    async (tracking) => {
      await preparePosting(1, 1);
      product.trackingMode = tracking;
      const doc = await m.tx.commercialDocument.findFirst();
      if (tracking === "BATCH") {
        doc.lines[0].batchId = id(12);
        m.tx.inventoryBatch.findFirst.mockResolvedValue({
          expiryDate: new Date("2026-10-06"),
        });
      } else {
        doc.lines[0].serialNumberId = id(12);
        m.tx.inventorySerialNumber.findFirst.mockResolvedValue({
          expiryDate: new Date("2026-10-06"),
        });
      }
      await expect(
        postCommercialDocumentForActor(actor, { documentId: id(7) }),
      ).rejects.toThrow("EXPIRED_STOCK");
      expect(m.tx.stockMovement.create).not.toHaveBeenCalled();
    },
  );
  it.each(["INVALID_FINANCIAL_YEAR", "PERIOD_LOCKED", "SYSTEM_LEDGER_MISSING"])(
    "keeps accounting guard %s",
    async (code) => {
      await preparePosting(10, 1);
      if (code === "INVALID_FINANCIAL_YEAR")
        m.tx.financialYear.findFirst.mockResolvedValue(null);
      if (code === "PERIOD_LOCKED")
        m.tx.accountingPeriodLock.findFirst.mockResolvedValue({
          lockedThrough: new Date("2026-10-08"),
        });
      if (code === "SYSTEM_LEDGER_MISSING")
        m.tx.ledgerAccount.findMany.mockResolvedValue([]);
      await expect(
        postCommercialDocumentForActor(actor, { documentId: id(7) }),
      ).rejects.toThrow(code);
      expect(m.journal).not.toHaveBeenCalled();
    },
  );
});

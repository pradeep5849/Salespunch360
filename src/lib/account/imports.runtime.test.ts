import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  data: new Map<string, unknown[]>(),
  job: null as Record<string, unknown> | null,
  create: vi.fn(),
  update: vi.fn(),
  save: vi.fn(),
  tail: Promise.resolve() as Promise<unknown>,
}));
vi.mock("@/lib/db", () => {
  const tx = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name === "$queryRaw") return vi.fn(async () => []);
        if (name === "accountImportJob")
          return {
            findFirst: async () => m.job,
            upsert: m.save,
            update: async ({ data }: { data: Record<string, unknown> }) =>
              Object.assign(m.job!, data),
          };
        return {
          findMany: async () => m.data.get(String(name)) ?? [],
          findFirst: async ({ where }: { where: { id: unknown } }) =>
            (m.data.get(String(name)) ?? []).find((x) => {
              const r = x as { id: string };
              return typeof where.id === "string" ? r.id === where.id : false;
            }),
          create: m.create,
          updateMany: m.update,
        };
      },
    },
  );
  return {
    db: new Proxy(tx, {
      get: (t, k) =>
        k === "$transaction"
          ? async (fn: (tx: unknown) => Promise<unknown>) => {
              const result = m.tail.then(() => fn(tx));
              m.tail = result.catch(() => undefined);
              return result;
            }
          : Reflect.get(t, k),
    }),
  };
});
vi.mock("./transfer-access", () => ({ assertTransferAvailable: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  requirePermissionForMutation: vi.fn(),
}));
vi.mock("@/lib/accounting/service", () => ({ postJournalInTx: vi.fn() }));
vi.mock("./numbering", () => ({ allocateDocumentNumberInTx: vi.fn() }));
import {
  previewAccountImportForActor,
  saveImportPreviewForActor,
  executeAccountImportForActor,
  type ImportPreview,
} from "./imports";
const actor = {
  id: "admin",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
};
const id = "11111111-1111-4111-8111-111111111111";
const preview = (
  rows: ImportPreview["rows"],
  type: ImportPreview["type"] = "VENDORS",
): ImportPreview => ({
  type,
  fileName: "test.csv",
  fileHash: "raw",
  headers: [],
  rows,
  validCount: rows.length,
  invalidCount: 0,
});
const row = {
  rowNumber: 2,
  action: "CREATE" as const,
  values: { name: "Supplier" },
  resolved: {},
  warnings: [],
  errors: [],
};
const parse = (text: string, type: ImportPreview["type"] = "ITEMS") =>
  previewAccountImportForActor(actor, {
    type,
    fileName: "test.csv",
    bytes: new TextEncoder().encode(text),
  });
beforeEach(() => {
  vi.clearAllMocks();
  m.tail = Promise.resolve();
  m.data.clear();
  m.job = null;
  m.create.mockResolvedValue({ id: "created" });
  m.update.mockResolvedValue({ count: 1 });
  m.data.set("accountUnit", [{ id: "u", name: "Each", symbol: "ea" }]);
  m.data.set("accountCategory", [{ id: "c", name: "General" }]);
});
it("serializes replay and returns original counts instead of creating twice", async () => {
  m.job = {
    id,
    status: "READY",
    importType: "VENDORS",
    metadata: preview([row]),
  };
  const results = await Promise.all([
    executeAccountImportForActor(actor, id),
    executeAccountImportForActor(actor, id),
  ]);
  expect(m.create).toHaveBeenCalledTimes(1);
  expect(results.map((x) => x.idempotent)).toEqual([false, true]);
  expect(results[1]).toMatchObject({ created: 1, updated: 0, skipped: 0 });
});
it("rejects an out-of-scope persisted branch before execution", async () => {
  m.job = {
    id,
    status: "READY",
    importType: "CUSTOMERS",
    metadata: preview([{ ...row, resolved: { branchId: "B" } }], "CUSTOMERS"),
  };
  await expect(
    executeAccountImportForActor(
      { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: ["A"] },
      id,
    ),
  ).rejects.toThrow("IMPORT_BRANCH_OUTSIDE_SCOPE");
  expect(m.create).not.toHaveBeenCalled();
});
it("gives different confirmation identities to UPDATE and SKIP plans for identical bytes", async () => {
  const first = preview([
    { ...row, action: "UPDATE", resolved: { existingId: "existing" } },
  ]);
  await saveImportPreviewForActor(actor, first);
  await saveImportPreviewForActor(actor, {
    ...first,
    rows: [{ ...first.rows[0], action: "SKIP" }],
  });
  expect(m.save.mock.calls[0][0].create.fileHash).not.toBe(
    m.save.mock.calls[1][0].create.fileHash,
  );
});
it("does not report an update when its target vanished", async () => {
  m.job = {
    id,
    status: "READY",
    importType: "VENDORS",
    metadata: preview([
      { ...row, action: "UPDATE", resolved: { existingId: "missing" } },
    ]),
  };
  m.update.mockResolvedValue({ count: 0 });
  await expect(executeAccountImportForActor(actor, id)).rejects.toThrow(
    "IMPORT_TARGET_CHANGED",
  );
});
it("validates finite prices, ranges and duplicates before confirmation", async () => {
  const result = await parse(
    "name,unit,category,code,sale_rate,tax_rate\nOne,ea,General,SAME,NaN,101\nTwo,ea,General,SAME,-1,18\n",
  );
  expect(result.invalidCount).toBe(2);
  expect(result.rows[1].errors.join(" ")).toContain("Duplicate code");
  expect(m.create).not.toHaveBeenCalled();
});
it("returns row errors for malformed opening amounts without throwing during totals", async () => {
  const result = await parse(
    "ledger,debit,credit,effective_date,financial_year,branch\nCash,not-money,0,2026-04-01,FY,A\n",
    "OPENING_BALANCES",
  );
  expect(result.invalidCount).toBe(1);
  expect(result.rows[0].errors).toContain("Invalid Decimal amount");
});
it("reads a real legacy XLS workbook", async () => {
  const XLSX = await import("@e965/xlsx");
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    book,
    XLSX.utils.aoa_to_sheet([
      ["name", "unit", "category"],
      ["Legacy item", "ea", "General"],
    ]),
    "Items",
  );
  const bytes = XLSX.write(book, { type: "buffer", bookType: "biff8" });
  const result = await previewAccountImportForActor(actor, {
    type: "ITEMS",
    fileName: "legacy.xls",
    bytes,
  });
  expect(result.invalidCount).toBe(0);
  expect(result.rows[0].values.name).toBe("Legacy item");
});
it("rejects nonempty spreadsheet fields that would otherwise be silently discarded", async () => {
  const result = await parse("Item Name,unit,category,Opening Stock Quantity\nWidget,ea,General,15");
  expect(result.rows[0].values.name).toBe("Widget");
  expect(result.rows[0].errors.some(error => error.includes("opening_stock_quantity"))).toBe(true);
  expect(result.rows[0].action).toBe("ERROR");
});
it("rejects impossible tier price dates before execution", async () => {
  const result = await parse("name,unit,category,effective_from\nWidget,ea,General,2026-02-30");
  expect(result.rows[0].errors).toContain("effective_from must be a real YYYY-MM-DD date");
});

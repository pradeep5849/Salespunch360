import { beforeEach, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
const fixture = vi.hoisted(() => ({
  vendors: [] as Record<string, unknown>[],
  reads: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { vendor: { findMany: fixture.reads } } }));
vi.mock("./transfer-access", () => ({ assertTransferAvailable: vi.fn(),assertExportRole: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({ requirePermission: vi.fn() }));
import { exportAccountDataForActor } from "./exports";
import { parseImportFile } from "./imports";
const actor = {
  id: "admin",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
};
beforeEach(() => {
  vi.clearAllMocks();
  fixture.vendors = [];
  fixture.reads.mockImplementation(
    async (input: {
      cursor?: { id: string };
      take: number;
      where: { companyId: string };
    }) => {
      expect(input.where.companyId).toBe(actor.companyId);
      const offset = input.cursor
        ? fixture.vendors.findIndex((row) => row.id === input.cursor!.id) + 1
        : 0;
      return fixture.vendors.slice(offset, offset + input.take);
    },
  );
});
it("exports beyond 10000 records with stable cursor pages and no missing last row", async () => {
  fixture.vendors = Array.from({ length: 10001 }, (_, n) => ({
    id: String(n).padStart(6, "0"),
    name: `Vendor ${n}`,
    phone: null,
    email: null,
    address: null,
    gstin: null,
    stateCode: null,
    isActive: true,
  }));
  const result = await exportAccountDataForActor(actor, "vendors", "csv");
  const parsed = await parseImportFile("vendors.csv", result.bytes);
  expect(parsed.records).toHaveLength(10001);
  expect(parsed.records.at(-1)?.name).toBe("Vendor 10000");
  expect(fixture.reads).toHaveBeenCalledTimes(11);
});
it("retains static headers for an empty Excel export", async () => {
  const result = await exportAccountDataForActor(actor, "vendors", "xlsx");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(result.bytes) as never);
  expect(book.worksheets[0].getRow(1).values).toContain("name");
  expect(book.worksheets[0].getRow(1).values).toContain("state_code");
});
it("round trips formula-like and apostrophe-prefixed literal text through tagged CSV", async () => {
  fixture.vendors = ["=formula", "+literal", "'original"].map((name, n) => ({
    id: String(n),
    name,
    isActive: false,
  }));
  const result = await exportAccountDataForActor(actor, "vendors", "csv"),
    parsed = await parseImportFile("vendors.csv", result.bytes);
  expect(parsed.records.map((row) => row.name)).toEqual([
    "=formula",
    "+literal",
    "'original",
  ]);
  expect(parsed.records[0].is_active).toBe("false");
});
it("rejects unsupported format before reading company records", async () => {
  await expect(
    exportAccountDataForActor(actor, "vendors", "zip"),
  ).rejects.toThrow("UNSUPPORTED_EXPORT_FORMAT");
  expect(fixture.reads).not.toHaveBeenCalled();
});

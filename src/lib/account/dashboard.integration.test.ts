import { writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_INTEGRATION_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_test"))
)
  throw new Error("Local isolated test database required");
const client = new PrismaClient({
  datasources: {
    db: {
      url: url ?? "postgresql://test:test@127.0.0.1:55432/salespunch360_test",
    },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, k) => client[k as keyof PrismaClient] }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
import { postJournalInTx } from "@/lib/accounting/service";
import { accountBranchDashboard } from "./branch-dashboard";
import { inventoryContext } from "./inventory-context";
import {
  createStockMovementForActor,
  inventorySnapshotForActor,
  lowStockSnapshotForActor,
} from "./inventory";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  a = randomUUID(),
  b = randomUUID(),
  user = randomUUID(),
  product = randomUUID(),
  noMovement = randomUUID(),
  cash = randomUUID(),
  bank = randomUUID(),
  income = randomUUID(),
  fy = randomUUID(),
  w1 = randomUUID(),
  w2 = randomUUID(),
  w3 = randomUUID(),
  inactive = randomUUID();
const actor = {
  id: user,
  companyId,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [a, b],
} as ProjectActor;
const from = new Date("2026-04-01"),
  to = new Date("2026-10-09T23:59:59.999Z"),
  context = { mode: "BRANCH", branchId: a, branchName: "A" } as const;
describe.skipIf(!url)(
  "A048 real database stock scope, balances, performance and toggle enforcement",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Dashboard isolation",
          slug: `dashboard-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.accountSettings.create({
        data: {
          companyId,
          enabledModules: ["INVENTORY", "SALES", "EXPENSES"],
          itemSettings: { enabled: true },
        },
      });
      await client.branch.createMany({
        data: [
          { id: a, companyId, name: "A", code: "A", isPrimary: true },
          { id: b, companyId, name: "B", code: "B" },
        ],
      });
      await client.user.create({
        data: {
          id: user,
          companyId,
          name: "Admin",
          email: `${user}@example.test`,
          passwordHash: "fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
        },
      });
      await client.financialYear.create({
        data: {
          id: fy,
          companyId,
          name: "2026",
          startDate: from,
          endDate: new Date("2027-03-31"),
        },
      });
      await client.ledgerAccount.createMany({
        data: [
          {
            id: cash,
            code: "100",
            name: "Cash",
            accountClass: "ASSET" as const,
            normalBalance: "DEBIT" as const,
          },
          {
            id: bank,
            code: "101",
            name: "Bank",
            accountClass: "ASSET" as const,
            normalBalance: "DEBIT" as const,
          },
          {
            id: income,
            code: "400",
            name: "Income",
            accountClass: "INCOME" as const,
            normalBalance: "CREDIT" as const,
          },
        ].map((x) => ({ ...x, companyId })),
      });
      await client.moneyAccount.createMany({
        data: [
          {
            companyId,
            branchId: a,
            ledgerAccountId: cash,
            name: "Cash",
            type: "CASH",
            isActive: false,
          },
          {
            companyId,
            branchId: null,
            ledgerAccountId: bank,
            name: "Bank",
            type: "BANK",
          },
        ],
      });
      for (const [branchId, amount] of [
        [a, 100],
        [b, 500],
      ] as const) {
        await client.$transaction((tx) =>
          postJournalInTx(tx, actor, {
            branchId,
            financialYearId: fy,
            entryDate: from,
            sourceType: "FIXTURE",
            sourceId: randomUUID(),
            lines: [
              { ledgerAccountId: cash, debit: String(amount), credit: "0" },
              { ledgerAccountId: bank, debit: String(amount * 2), credit: "0" },
              {
                ledgerAccountId: income,
                debit: "0",
                credit: String(amount * 3),
              },
            ],
          }),
        );
      }

      await client.accountProduct.createMany({
        data: [
          {
            id: product,
            companyId,
            name: "Tracked",
            trackInventory: true,
            lowStockThreshold: 5,
          },
          {
            id: noMovement,
            companyId,
            name: "No movement",
            trackInventory: true,
            lowStockThreshold: 5,
          },
        ],
      });
      await client.warehouse.createMany({
        data: [
          { id: w1, branchId: a, code: "W1", name: "Zero" },
          { id: w2, branchId: a, code: "W2", name: "Ten" },
          { id: w3, branchId: b, code: "W3", name: "Other branch" },
          {
            id: inactive,
            branchId: a,
            code: "INACTIVE",
            name: "Inactive",
            isActive: false,
          },
        ].map((row) => ({ ...row, companyId })),
      });
      await client.stockMovement.createMany({
        data: [
          { warehouseId: w1, branchId: a, quantity: 1 },
          { warehouseId: w2, branchId: a, quantity: 10 },
          { warehouseId: w3, branchId: b, quantity: 2 },
          { warehouseId: inactive, branchId: a, quantity: 1 },
        ].map((row) => ({
          ...row,
          companyId,
          productId: product,
          movementType: "OPENING",
          unitCost: 5,
          totalCost: row.quantity * 5,
          sourceType: "FIXTURE",
          sourceId: randomUUID(),
          movementDate: from,
          createdById: user,
        })),
      });
      await client.stockMovement.create({
        data: {
          companyId,
          branchId: a,
          warehouseId: w1,
          productId: product,
          movementType: "SALE",
          quantity: 1,
          unitCost: 5,
          totalCost: 5,
          sourceType: "FIXTURE",
          sourceId: randomUUID(),
          movementDate: from,
          createdById: user,
        },
      });
    }, 30000);
    afterAll(async () => {
      await client.accountOperationalAudit.deleteMany({ where: { companyId } });
      await client.stockMovement.deleteMany({ where: { companyId } });
      await client.warehouse.deleteMany({ where: { companyId } });
      await client.accountProduct.deleteMany({ where: { companyId } });
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.journalLine.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
      });
      await client.moneyAccount.deleteMany({ where: { companyId } });
      await client.ledgerAccount.deleteMany({ where: { companyId } });
      await client.financialYear.deleteMany({ where: { companyId } });
      await client.user.deleteMany({ where: { companyId } });
      await client.numberingSeries.deleteMany({ where: { companyId } });
      await client.branch.deleteMany({ where: { companyId } });
      await client.accountSettings.delete({ where: { companyId } });
      await client.company.delete({ where: { id: companyId } });
      await client.$disconnect();
    });
    it("reconciles shared warehouse-position count, preview/value and scoped cash/bank", async () => {
      const scoped = await inventoryContext(actor, { branchId: a });
      const rows = await lowStockSnapshotForActor(scoped.actor, to);
      const dashboard = await accountBranchDashboard(
        actor,
        context,
        from,
        to,
        "SUMMARY",
      );
      if (dashboard.projectOnly)
        throw new Error("Unexpected Project dashboard");
      expect(dashboard.cash.toString()).toBe("100");
      expect(dashboard.bank.toString()).toBe("200");
      expect(dashboard.cashBank.toString()).toBe("300");
      expect(dashboard.lowStockItems).toBe(rows.length);
      expect(rows).toHaveLength(1);
      expect(dashboard.lowStockPreview[0]).toMatchObject({
        name: "Tracked",
        warehouse: "Zero",
      });
      expect(dashboard.itemCount).toBe(2);
      expect(dashboard.stockValue.toString()).toBe("50");
    });
    it("blocks forged and assigned-branch violations and both OFF controls without deleting data", async () => {
      await expect(
        accountBranchDashboard(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [b] },
          context,
          from,
          to,
        ),
      ).rejects.toThrow();
      await expect(
        accountBranchDashboard(
          { ...actor, accountRole: "ACCOUNTANT" },
          { mode: "COMPANY", branchId: null, branchName: null },
          from,
          to,
        ),
      ).rejects.toThrow();
      await expect(
        inventoryContext(actor, { branchId: randomUUID() }),
      ).rejects.toThrow();
      await expect(
        inventoryContext(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [b] },
          { branchId: a },
        ),
      ).rejects.toThrow();
      await expect(
        inventoryContext(
          { ...actor, accountRole: "DATA_ENTRY" },
          { branchId: a },
        ),
      ).rejects.toThrow();
      await client.accountSettings.update({
        where: { companyId },
        data: { itemSettings: { enabled: false } },
      });
      await expect(inventoryContext(actor, { branchId: a })).rejects.toThrow();
      await client.accountSettings.update({
        where: { companyId },
        data: { itemSettings: { enabled: true } },
      });
      // Inventory is a mandatory basic Account module; an edition without Account has no entitlement.
      await client.company.update({
        where: { id: companyId },
        data: { productEdition: "SALESPUNCH360" },
      });
      await expect(inventoryContext(actor, { branchId: a })).rejects.toThrow(
        "MODULE_DISABLED:INVENTORY",
      );
      expect(await client.stockMovement.count({ where: { companyId } })).toBe(
        5,
      );
      await client.company.update({
        where: { id: companyId },
        data: { productEdition: "SALESPUNCH360_ACCOUNT" },
      });
    });
    it("allows and displays negative normal stock when enabled while retaining the OFF guard", async () => {
      await client.accountSettings.update({
        where: { companyId },
        data: { negativeStockAllowed: true },
      });
      const input = {
        warehouseId: w1,
        productId: product,
        quantity: "3",
        unitCost: "5",
        movementDate: "2026-06-01",
        sourceType: "NEGATIVE-STOCK-TEST",
        sourceId: randomUUID(),
        reason: "Approved negative inventory",
      };
      await createStockMovementForActor(actor, "ADJUSTMENT_OUT", input);
      const scoped = await inventoryContext(actor, { branchId: a }),
        rows = await lowStockSnapshotForActor(scoped.actor, to);
      expect(
        rows.find((row) => row.warehouseId === w1)?.quantity.toString(),
      ).toBe("-3");
      const dashboard = await accountBranchDashboard(
        actor,
        context,
        from,
        to,
        "SUMMARY",
      );
      if (dashboard.projectOnly)
        throw new Error("Unexpected Project dashboard");
      expect(
        dashboard.lowStockPreview
          .find((row) => row.warehouse === "Zero")
          ?.quantity.toString(),
      ).toBe("-3");
      await client.accountSettings.update({
        where: { companyId },
        data: { negativeStockAllowed: false },
      });
      await expect(
        createStockMovementForActor(actor, "ADJUSTMENT_OUT", {
          ...input,
          sourceId: randomUUID(),
        }),
      ).rejects.toThrow("INSUFFICIENT_STOCK");
    });
    it("preserves ordered weighted valuation across bounded history pages without quadratic copying", async () => {
      await client.stockMovement.createMany({
        data: Array.from({ length: 10001 }, (_, i) => ({
          companyId,
          branchId: a,
          warehouseId: w2,
          productId: product,
          movementType: "PURCHASE" as const,
          quantity: 1,
          unitCost: 7,
          totalCost: 7,
          sourceType: "PERFORMANCE",
          sourceId: String(i),
          movementDate: new Date("2026-05-01"),
          createdById: user,
        })),
      });
      const scoped = await inventoryContext(actor, { branchId: a }),
        start = performance.now();
      const rows = await inventorySnapshotForActor(scoped.actor, to),
        elapsed = performance.now() - start;
      const item = rows.find((row) => row.warehouseId === w2)!;
      expect(item.quantity.toString()).toBe("10011");
      expect(item.stockValue.toString()).toBe("70057");
      expect(elapsed).toBeLessThan(10000);
      const plan =
        await client.$queryRaw`EXPLAIN (ANALYZE, FORMAT JSON) SELECT id FROM stock_movements WHERE "companyId"=${companyId}::uuid AND "warehouseId" IN (${w1}::uuid,${w2}::uuid) ORDER BY "movementDate","createdAt",id LIMIT 1000`;
      if (process.env.DASHBOARD_PERFORMANCE_OUTPUT)
        writeFileSync(
          process.env.DASHBOARD_PERFORMANCE_OUTPUT,
          JSON.stringify(
            {
              check: "A048 bounded 10007 movement valuation",
              elapsedMs: Math.round(elapsed),
              pageSize: 1000,
              plan,
            },
            null,
            2,
          ),
        );
    }, 30000);
  },
);

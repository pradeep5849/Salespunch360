import { randomUUID } from "node:crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_INTEGRATION_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
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
import { DEFAULT_LEDGER_ACCOUNTS } from "@/lib/accounting/default-accounts";
import { createSimpleProjectForActor } from "./project-simple-workflow";
import {
  createProjectForActor,
  getProjectForActor,
  replaceBudgetForActor,
  type ProjectActor,
} from "./projects";
import {
  issueInventoryToProjectForActor,
  consumeProjectMaterialForActor,
  returnProjectMaterialForActor,
  transferProjectMaterialForActor,
  reverseProjectMaterialForActor,
  projectMaterialContextForActor,
} from "./project-material-service";
import { projectMaterialBalance } from "./project-material";
import { inventorySnapshotForActor } from "./inventory";
import {
  createCommercialDocumentForActor,
  getCommercialDocumentForActor,
  postCommercialDocumentForActor,
  createSettlementForActor,
  applyAdvanceForActor,
  documentOutstandingsBatch,
} from "./commercial";
import { mobileProjectOptions } from "@/lib/mobile/account-projects";
import {
  createChangeOrderForActor,
  updateChangeOrderForActor,
  transitionChangeOrderForActor,
  loadProjectCostingForActor,
} from "./project-costing";
const companyId = randomUUID(),
  branchId = randomUUID(),
  otherBranch = randomUUID(),
  userId = randomUUID(),
  customerId = randomUUID(),
  productId = randomUUID(),
  warehouseId = randomUUID();
const actor = {
  id: userId,
  companyId,
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [branchId, otherBranch],
} as ProjectActor;
const date = new Date("2026-10-09"),
  key = () => randomUUID();
const vendorId = randomUUID(),
  serviceId = randomUUID();
let invoiceId: string, advanceId: string;
let a: string,
  b: string,
  budgetA: string,
  budgetB: string,
  source: string,
  consumption: string,
  returned: string,
  transferred: string;
async function balance(projectId: string) {
  return projectMaterialBalance(
    await client.projectMaterialMovement.findMany({
      where: { companyId, projectId },
    }),
  );
}
async function stock() {
  return (await inventorySnapshotForActor(actor)).find(
    (x) => x.productId === productId && x.warehouseId === warehouseId,
  )!;
}
const reverse = (movementId: string) =>
  reverseProjectMaterialForActor(actor, {
    movementId,
    movementDate: date,
    reason: "Workflow reversal",
    idempotencyKey: key(),
  });
describe.skipIf(!url)(
  "Project workflow: real database atomicity, scopes, material and value",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Project workflow",
          slug: `project-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.accountSettings.create({
        data: {
          companyId,
          enabledModules: [
            "PROJECTS",
            "PROJECT_COSTING",
            "INVENTORY",
            "PURCHASES",
            "PURCHASE_BILLS",
            "DEBIT_NOTE",
            "SALES",
            "CUSTOMER_ADVANCES",
            "CUSTOMER_RECEIPTS",
          ],
          negativeStockAllowed: false,
        },
      });
      await client.branch.createMany({
        data: [
          { id: branchId, companyId, name: "A", code: "A", isPrimary: true },
          { id: otherBranch, companyId, name: "B", code: "B" },
        ],
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Admin",
          email: `${userId}@example.test`,
          passwordHash: "fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
        },
      });
      await client.customer.create({
        data: {
          id: customerId,
          companyId,
          branchId,
          name: "Customer",
          isAccountCustomer: true,
        },
      });
      await client.financialYear.create({
        data: {
          companyId,
          name: "2026",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
        },
      });
      await client.ledgerAccount.createMany({
        data: DEFAULT_LEDGER_ACCOUNTS.map((x) => ({ ...x, companyId })),
      });
      await client.accountProduct.create({
        data: {
          id: productId,
          companyId,
          name: "Material",
          code: "M",
          trackInventory: true,
          costPrice: 10,
        },
      });
      await client.warehouse.create({
        data: {
          id: warehouseId,
          companyId,
          branchId,
          name: "Warehouse",
          code: "W",
        },
      });
      await client.stockMovement.create({
        data: {
          companyId,
          branchId,
          productId,
          warehouseId,
          movementType: "OPENING",
          quantity: 20,
          unitCost: 10,
          totalCost: 200,
          sourceType: "FIXTURE",
          sourceId: key(),
          movementDate: date,
          createdById: userId,
        },
      });
      await client.vendor.create({
        data: { id: vendorId, companyId, name: "Vendor" },
      });
      await client.accountService.create({
        data: {
          id: serviceId,
          companyId,
          name: "Project billing",
          code: "S",
          sellingRate: 100,
          taxRate: 18,
          sacCode: "995419",
        },
      });
      a = (
        await createProjectForActor(actor, {
          branchId,
          customerId,
          name: "Project A",
          projectValue: "1000",
        })
      ).id;
      b = (
        await createProjectForActor(actor, {
          branchId,
          customerId,
          name: "Project B",
          projectValue: "1000",
        })
      ).id;
      await client.project.updateMany({
        where: { companyId },
        data: { status: "ACTIVE" },
      });
      budgetA = (
        await client.projectBudgetLine.create({
          data: {
            companyId,
            projectId: a,
            position: 0,
            category: "Materials",
            title: "A budget",
            amount: 500,
          },
        })
      ).id;
      budgetB = (
        await client.projectBudgetLine.create({
          data: {
            companyId,
            projectId: b,
            position: 0,
            category: "Materials",
            title: "B budget",
            amount: 500,
          },
        })
      ).id;
    }, 30000);
    afterAll(async () => {
      await client.projectAuditEvent.deleteMany({ where: { companyId } });
      // Only the guarded, isolated local _test database permits fixture cleanup.
      // The production append-only trigger remains installed and enabled.
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`ALTER TABLE "project_material_movements" DISABLE TRIGGER project_material_no_update_delete`;
        await tx.projectMaterialMovement.deleteMany({ where: { companyId } });
        await tx.$executeRaw`ALTER TABLE "project_material_movements" ENABLE TRIGGER project_material_no_update_delete`;
      });
      await client.stockMovement.deleteMany({ where: { companyId } });
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.commercialAuditEvent.deleteMany({ where: { companyId } });
        await tx.advanceApplication.deleteMany({ where: { companyId } });
        await tx.settlementAllocation.deleteMany({ where: { companyId } });
        await tx.openingBalanceAllocation.deleteMany({ where: { companyId } });
        await tx.accountSettlement.deleteMany({ where: { companyId } });
        await tx.purchaseLineAllocation.deleteMany({ where: { companyId } });
        await tx.commercialDocumentLine.deleteMany({ where: { companyId } });
        await tx.commercialDocument.deleteMany({ where: { companyId } });
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.journalLine.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
      });
      await client.projectChangeOrder.deleteMany({ where: { companyId } });
      await client.projectBudgetLine.deleteMany({ where: { companyId } });
      await client.projectMember.deleteMany({ where: { companyId } });
      await client.project.deleteMany({ where: { companyId } });
      await client.customer.deleteMany({ where: { companyId } });
      await client.vendor.deleteMany({ where: { companyId } });
      await client.accountService.deleteMany({ where: { companyId } });
      await client.warehouse.deleteMany({ where: { companyId } });
      await client.inventoryBatch.deleteMany({ where: { companyId } });
      await client.inventorySerialNumber.deleteMany({ where: { companyId } });
      await client.accountProduct.deleteMany({ where: { companyId } });
      await client.ledgerAccount.deleteMany({ where: { companyId } });
      await client.financialYear.deleteMany({ where: { companyId } });
      await client.userBranchAccess.deleteMany({ where: { userId } });
      await client.user.deleteMany({ where: { companyId } });
      await client.numberingSeries.deleteMany({ where: { companyId } });
      await client.branch.deleteMany({ where: { companyId } });
      await client.accountSettings.deleteMany({ where: { companyId } });
      await client.company.delete({ where: { id: companyId } });
      await client.$disconnect();
    }, 30000);
    it("creates an ACTIVE project/customer/audit atomically; validation failure leaves no customer", async () => {
      const before = await client.customer.count({ where: { companyId } });
      await expect(
        createSimpleProjectForActor(actor, {
          branchId,
          name: "Invalid",
          projectValue: "-1",
        }),
      ).rejects.toThrow();
      expect(await client.customer.count({ where: { companyId } })).toBe(
        before,
      );
      const project = await createSimpleProjectForActor(actor, {
        branchId,
        name: "Manual",
        projectValue: "100",
      });
      expect(project.status).toBe("ACTIVE");
      expect(
        await client.projectAuditEvent.count({
          where: { companyId, projectId: project.id },
        }),
      ).toBe(2);
    });
    it("deduplicates concurrent manual Project creation with exactly one customer and audit", async () => {
      const customerCount = await client.customer.count({
        where: { companyId },
      });
      const input = {
        branchId,
        name: "Retry-safe manual project",
        projectValue: "100.00",
        idempotencyKey: key(),
      };
      const [first, retry] = await Promise.all([
        createSimpleProjectForActor(actor, input),
        createSimpleProjectForActor(actor, input),
      ]);
      expect(first.id).toBe(retry.id);
      expect(await client.customer.count({ where: { companyId } })).toBe(
        customerCount + 1,
      );
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            projectId: first.id,
            eventType: "PROJECT_CREATED",
          },
        }),
      ).toBe(1);
      expect(
        (
          await createSimpleProjectForActor(actor, {
            ...input,
            projectValue: "100",
          })
        ).id,
      ).toBe(first.id);
      await expect(
        createSimpleProjectForActor(actor, {
          ...input,
          name: "Changed intent",
        }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      const beforeFailure = await client.customer.count({
        where: { companyId },
      });
      await expect(
        createSimpleProjectForActor(actor, {
          ...input,
          name: "Invalid manager",
          idempotencyKey: key(),
          projectManagerId: key(),
        }),
      ).rejects.toThrow("INVALID_PROJECT_MANAGER");
      expect(await client.customer.count({ where: { companyId } })).toBe(
        beforeFailure,
      );
      await expect(
        createSimpleProjectForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [otherBranch],
          },
          input,
        ),
      ).rejects.toThrow("Not authorized");
    });
    it("deduplicates standard Project creation for an existing customer", async () => {
      const input = {
        branchId,
        customerId,
        name: "Retry-safe standard project",
        projectValue: "50",
        idempotencyKey: key(),
      };
      const [first, retry] = await Promise.all([
        createProjectForActor(actor, input),
        createProjectForActor(actor, input),
      ]);
      expect(first.id).toBe(retry.id);
      await expect(
        createProjectForActor(actor, { ...input, projectValue: "60" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    });
    it("issues inventory with original cost and replays only the identical authorized request", async () => {
      const input = {
        projectId: a,
        warehouseId,
        productId,
        projectBudgetLineId: budgetA,
        quantity: "10",
        movementDate: date,
        idempotencyKey: key(),
      };
      const movement = await issueInventoryToProjectForActor(actor, input);
      source = movement.id;
      expect((await issueInventoryToProjectForActor(actor, input)).id).toBe(
        source,
      );
      await expect(
        issueInventoryToProjectForActor(actor, { ...input, quantity: "9" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      expect((await balance(a)).available.toString()).toBe("10");
      expect((await stock()).stockValue.toString()).toBe("100");
      expect(
        await client.projectAuditEvent.count({
          where: { projectId: a, eventType: "PROJECT_MATERIAL_POSTED" },
        }),
      ).toBe(1);
    });
    it("prevents foreign budget and over-consumption without side effects", async () => {
      const input = {
        projectId: a,
        sourceMovementId: source,
        movementDate: date,
        idempotencyKey: key(),
      };
      await expect(
        consumeProjectMaterialForActor(actor, {
          ...input,
          quantity: "1",
          projectBudgetLineId: budgetB,
        }),
      ).rejects.toThrow("INVALID_PROJECT_BUDGET_LINE");
      await expect(
        consumeProjectMaterialForActor(actor, { ...input, quantity: "11" }),
      ).rejects.toThrow("INSUFFICIENT_PROJECT_MATERIAL");
      expect((await balance(a)).available.toString()).toBe("10");
    });
    it("consumes and returns at original cost without counting consumption twice", async () => {
      consumption = (
        await consumeProjectMaterialForActor(actor, {
          projectId: a,
          sourceMovementId: source,
          quantity: "3",
          movementDate: date,
          idempotencyKey: key(),
        })
      ).id;
      returned = (
        await returnProjectMaterialForActor(actor, {
          projectId: a,
          sourceMovementId: source,
          warehouseId,
          quantity: "2",
          movementDate: date,
          reason: "Unused",
          idempotencyKey: key(),
        })
      ).id;
      expect((await balance(a)).available.toString()).toBe("5");
      expect((await stock()).quantity.toString()).toBe("12");
      expect((await stock()).stockValue.toString()).toBe("120");
      await expect(reverse(source)).rejects.toThrow(
        "INSUFFICIENT_PROJECT_MATERIAL",
      );
    });
    it("transfers atomically with destination budget, preserving company quantity and value", async () => {
      transferred = (
        await transferProjectMaterialForActor(actor, {
          sourceProjectId: a,
          destinationProjectId: b,
          sourceMovementId: source,
          destinationBudgetLineId: budgetB,
          quantity: "2",
          movementDate: date,
          reason: "Allocation",
          idempotencyKey: key(),
        })
      ).id;
      expect((await balance(a)).available.toString()).toBe("3");
      expect((await balance(b)).available.toString()).toBe("2");
      expect((await stock()).stockValue.toString()).toBe("120");
      const incoming = await client.projectMaterialMovement.findFirstOrThrow({
        where: { companyId, projectId: b, movementType: "TRANSFER_IN" },
      });
      expect(incoming.projectBudgetLineId).toBe(budgetB);
      await expect(reverse(incoming.id)).rejects.toThrow(
        "REVERSE_TRANSFER_FROM_SOURCE_PROJECT",
      );
    });
    it("reverses both transfer sides and records both histories with a linked journal", async () => {
      await reverse(transferred);
      expect((await balance(a)).available.toString()).toBe("5");
      expect((await balance(b)).available.toString()).toBe("0");
      expect((await stock()).stockValue.toString()).toBe("120");
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            projectId: b,
            eventType: "PROJECT_MATERIAL_REVERSED",
          },
        }),
      ).toBe(1);
      const journal = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: transferred },
      });
      expect(journal.status).toBe("REVERSED");
      expect(
        await client.journalEntry.count({
          where: { companyId, reversalOfId: journal.id },
        }),
      ).toBe(1);
    });
    it("reverses consumption, return and issue to restore original stock and project zero balance", async () => {
      await reverse(consumption);
      await reverse(returned);
      await reverse(source);
      expect((await balance(a)).available.toString()).toBe("0");
      expect((await stock()).quantity.toString()).toBe("20");
      expect((await stock()).stockValue.toString()).toBe("200");
    });
    it("allows negative normal inventory when ON, while project over-consumption stays blocked", async () => {
      const input = {
        projectId: a,
        warehouseId,
        productId,
        projectBudgetLineId: budgetA,
        quantity: "25",
        movementDate: date,
        idempotencyKey: key(),
      };
      await expect(
        issueInventoryToProjectForActor(actor, input),
      ).rejects.toThrow("INSUFFICIENT_STOCK");
      await client.accountSettings.update({
        where: { companyId },
        data: { negativeStockAllowed: true },
      });
      const move = await issueInventoryToProjectForActor(actor, input);
      expect((await stock()).quantity.toString()).toBe("-5");
      expect((await balance(a)).available.toString()).toBe("25");
      await expect(
        consumeProjectMaterialForActor(actor, {
          projectId: a,
          sourceMovementId: move.id,
          quantity: "26",
          movementDate: date,
          idempotencyKey: key(),
        }),
      ).rejects.toThrow("INSUFFICIENT_PROJECT_MATERIAL");
      await reverse(move.id);
      await client.accountSettings.update({
        where: { companyId },
        data: { negativeStockAllowed: false },
      });
    });
    it("keeps zero-value material movements and reversals free of fabricated accounting amounts", async () => {
      const freeProductId = key();
      await client.accountProduct.create({
        data: {
          id: freeProductId,
          companyId,
          name: "Free supplied material",
          code: "FREE",
          trackInventory: true,
          costPrice: 0,
        },
      });
      await client.stockMovement.create({
        data: {
          companyId,
          branchId,
          productId: freeProductId,
          warehouseId,
          movementType: "OPENING",
          quantity: 2,
          unitCost: 0,
          totalCost: 0,
          sourceType: "FIXTURE",
          sourceId: key(),
          movementDate: date,
          createdById: userId,
        },
      });
      const issued = await issueInventoryToProjectForActor(actor, {
        projectId: a,
        warehouseId,
        productId: freeProductId,
        projectBudgetLineId: budgetA,
        quantity: "2",
        movementDate: date,
        idempotencyKey: key(),
      });
      expect(issued.totalCost.toString()).toBe("0");
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: issued.id },
        }),
      ).toBe(0);
      const reversal = await reverseProjectMaterialForActor(actor, {
        movementId: issued.id,
        movementDate: date,
        reason: "Return unused free material",
        idempotencyKey: key(),
      });
      expect(reversal.totalCost.toString()).toBe("0");
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: reversal.id },
        }),
      ).toBe(0);
      expect(
        await client.projectMaterialMovement.count({
          where: { companyId, productId: freeProductId },
        }),
      ).toBe(2);
    });
    it("denies mutation roles, non-member Project managers, revoked branches and cross-company references", async () => {
      const input = {
        projectId: a,
        sourceMovementId: source,
        quantity: "1",
        movementDate: date,
        idempotencyKey: key(),
      };
      for (const accountRole of ["ACCOUNTANT", "DATA_ENTRY"] as const)
        await expect(
          consumeProjectMaterialForActor({ ...actor, accountRole }, input),
        ).rejects.toThrow("Not authorized");
      await expect(
        getProjectForActor(
          { ...actor, id: key(), accountRole: "PROJECT_MANAGER" },
          a,
        ),
      ).rejects.toThrow("Not authorized");
      await expect(
        getProjectForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [branchId],
          },
          a,
        ),
      ).rejects.toThrow("Not authorized");
      await expect(
        issueInventoryToProjectForActor(actor, {
          projectId: key(),
          warehouseId,
          productId,
          projectBudgetLineId: budgetA,
          quantity: "1",
          movementDate: date,
          idempotencyKey: key(),
        }),
      ).rejects.toThrow("INVALID_PROJECT");
    });
    it("posts a project advance as liability and rejects changed-payload duplicate keys", async () => {
      const input = {
        type: "CUSTOMER_ADVANCE",
        branchId,
        partyId: customerId,
        projectId: a,
        paymentMode: "CASH",
        amount: "300",
        transactionDate: date,
        idempotencyKey: key(),
      };
      const advance = await createSettlementForActor(actor, input);
      advanceId = advance.id;
      expect((await createSettlementForActor(actor, input)).id).toBe(advanceId);
      await expect(
        createSettlementForActor(actor, { ...input, amount: "301" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      const journal = await client.journalEntry.findFirstOrThrow({
        where: { companyId, id: advance.journalEntryId },
        include: { lines: { include: { ledgerAccount: true } } },
      });
      expect(
        journal.lines
          .find((x) => x.ledgerAccount.systemKey === "CUSTOMER_ADVANCES")
          ?.credit.toString(),
      ).toBe("300");
      expect(
        journal.lines.some((x) => x.ledgerAccount.systemKey === "SALES_INCOME"),
      ).toBe(false);
    });
    it("posts service/SAC project invoice once with GST and authoritative receivable", async () => {
      const doc = await createCommercialDocumentForActor(actor, {
        type: "SALES_INVOICE",
        branchId,
        partyId: customerId,
        projectId: a,
        issueDate: date,
        stateOfSupplyCode: "29",
        lines: [
          {
            lineType: "SERVICE",
            sourceId: serviceId,
            quantity: "10",
            rate: "100",
            taxRate: "18",
          },
        ],
      });
      invoiceId = doc.id;
      await postCommercialDocumentForActor(actor, { documentId: doc.id });
      expect(
        (
          await documentOutstandingsBatch(companyId, [
            {
              id: doc.id,
              grandTotal: doc.grandTotal,
              payableAmount: doc.payableAmount,
            },
          ])
        )
          .get(doc.id)
          ?.toString(),
      ).toBe("1180");
      const journal = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: doc.id },
        include: { lines: { include: { ledgerAccount: true } } },
      });
      expect(
        journal.lines
          .find((x) => x.ledgerAccount.systemKey === "SALES_INCOME")
          ?.credit.toString(),
      ).toBe("1000");
    });
    it("applies advance once; over-application and mismatched replay are denied", async () => {
      const input = {
        advanceId,
        documentId: invoiceId,
        amount: "200",
        applicationDate: date,
        idempotencyKey: key(),
      };
      const app = await applyAdvanceForActor(actor, input);
      expect((await applyAdvanceForActor(actor, input)).id).toBe(app.id);
      await expect(
        applyAdvanceForActor(actor, { ...input, amount: "201" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      await expect(
        applyAdvanceForActor(actor, {
          ...input,
          amount: "101",
          idempotencyKey: key(),
        }),
      ).rejects.toThrow("ADVANCE_APPLICATION_EXCEEDS_BALANCE");
      expect(
        (
          await client.accountSettlement.findUniqueOrThrow({
            where: { id: advanceId },
          })
        ).remainingAmount.toString(),
      ).toBe("100");
      const costing = await loadProjectCostingForActor(actor, a);
      expect(costing.metrics.revenue.toString()).toBe("1000");
      expect(costing.metrics.accountingReceivable.toString()).toBe("980");
      expect(costing.metrics.amountReceived.toString()).toBe("200");
    });
    it("serves paginated authoritative availability and role capabilities", async () => {
      const context = await projectMaterialContextForActor(actor);
      expect(context.movements.length).toBeLessThanOrEqual(50);
      expect(context.sources.length).toBeLessThanOrEqual(50);
      expect(
        context.sources
          .find((x) => x.id === source)
          ?.availableQuantity.toString(),
      ).toBe("0");
      expect(context.sources.find((x) => x.id === source)?.isReversed).toBe(
        true,
      );
      const readonly = await projectMaterialContextForActor({
        ...actor,
        accountRole: "ACCOUNTANT",
      });
      expect(Object.values(readonly.capabilities).some(Boolean)).toBe(false);
    });
    it("posts a Project purchase through inventory receipt/issue with correct cost and lineage", async () => {
      const before = await stock();
      const doc = await createCommercialDocumentForActor(actor, {
        type: "PURCHASE_BILL",
        vendorInvoiceNumber: key(),
        vendorInvoiceDate: date,
        branchId,
        partyId: vendorId,
        projectId: a,
        projectBudgetLineId: budgetA,
        purchasePurpose: "PROJECT",
        materialTreatment: "DIRECT_TO_PROJECT",
        issueDate: date,
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            quantity: "5",
            rate: "10",
            taxRate: "0",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: doc.id });
      const after = await stock();
      expect(after.quantity.toString()).toBe(before.quantity.toString());
      expect(after.stockValue.toString()).toBe(before.stockValue.toString());
      const movement = await client.projectMaterialMovement.findFirstOrThrow({
        where: { companyId, purchaseDocumentId: doc.id },
      });
      expect(movement.projectId).toBe(a);
      expect(movement.quantity.toString()).toBe("5");
      expect(movement.totalCost.toString()).toBe("50");
      const costing = await loadProjectCostingForActor(actor, a);
      expect(costing.metrics.actualCost.toString()).toBe("50");
      expect(costing.metrics.profit.toString()).toBe("950");
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            projectId: a,
            eventType: "PROJECT_MATERIAL_POSTED",
            metadata: { path: ["movementId"], equals: movement.id },
          },
        }),
      ).toBe(1);
      const reversalInput = {
        movementId: movement.id,
        movementDate: date,
        reason: "Move purchased material back to company inventory",
        idempotencyKey: key(),
      };
      const reversal = await reverseProjectMaterialForActor(
        actor,
        reversalInput,
      );
      expect(
        (await reverseProjectMaterialForActor(actor, reversalInput)).id,
      ).toBe(reversal.id);
      expect((await stock()).quantity.toString()).toBe(
        before.quantity.add(5).toString(),
      );
      expect((await stock()).stockValue.toString()).toBe(
        before.stockValue.add(50).toString(),
      );
      expect(
        (
          await loadProjectCostingForActor(actor, a)
        ).metrics.actualCost.toString(),
      ).toBe("0");
      const bill = await client.commercialDocument.findUniqueOrThrow({
        where: { id: doc.id },
      });
      expect(bill.status).toBe("POSTED");
      expect(
        (
          await client.journalEntry.findUniqueOrThrow({
            where: { id: bill.journalEntryId! },
          })
        ).status,
      ).toBe("POSTED");
      const reversalJournal = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: reversal.id },
        include: { lines: { include: { ledgerAccount: true } } },
      });
      expect(
        reversalJournal.lines
          .find((x) => x.ledgerAccount.systemKey === "INVENTORY_ASSET")
          ?.debit.toString(),
      ).toBe("50");
      expect(
        reversalJournal.lines
          .find((x) => x.ledgerAccount.systemKey === "PROJECT_MATERIAL_WIP")
          ?.credit.toString(),
      ).toBe("50");
    });
    it("concurrent identical issue requests post only one movement and journal", async () => {
      const input = {
        projectId: a,
        warehouseId,
        productId,
        projectBudgetLineId: budgetA,
        quantity: "1",
        movementDate: date,
        idempotencyKey: key(),
      };
      const [one, two] = await Promise.all([
        issueInventoryToProjectForActor(actor, input),
        issueInventoryToProjectForActor(actor, input),
      ]);
      expect(one.id).toBe(two.id);
      expect(
        await client.projectMaterialMovement.count({
          where: { companyId, idempotencyKey: input.idempotencyKey },
        }),
      ).toBe(1);
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: one.id, status: "POSTED" },
        }),
      ).toBe(1);
    });
    it("preserves referenced budget identities when edited and rejects deletion", async () => {
      await replaceBudgetForActor(actor, {
        projectId: a,
        lines: [
          {
            id: budgetA,
            category: "Materials",
            title: "Updated budget",
            amount: "600",
          },
        ],
      });
      expect(
        (
          await client.projectBudgetLine.findUniqueOrThrow({
            where: { id: budgetA },
          })
        ).amount.toString(),
      ).toBe("600");
      await expect(
        replaceBudgetForActor(actor, { projectId: a, lines: [] }),
      ).rejects.toThrow("PROJECT_BUDGET_IN_USE");
      expect(
        await client.projectBudgetLine.count({ where: { id: budgetA } }),
      ).toBe(1);
    });
    it("database blocks material inserted with another branch or Project's budget", async () => {
      const data = {
        companyId,
        branchId: otherBranch,
        projectId: a,
        productId,
        movementType: "CONSUMPTION" as const,
        quantity: 1,
        originalUnitCost: 10,
        totalCost: 10,
        movementDate: date,
        createdById: userId,
        idempotencyKey: key(),
      };
      await expect(
        client.projectMaterialMovement.create({ data }),
      ).rejects.toThrow("PROJECT_MATERIAL_BRANCH_MISMATCH");
      await expect(
        client.projectMaterialMovement.create({
          data: { ...data, branchId, projectBudgetLineId: budgetB },
        }),
      ).rejects.toThrow("PROJECT_MATERIAL_BUDGET_MISMATCH");
    });
    it("creates, edits, submits and independently approves extra work without duplicate effects", async () => {
      const input = {
        projectId: a,
        title: "Extra work",
        description: "Approved site addition",
        valueDelta: "100.00",
        estimatedCostDelta: "20",
        idempotencyKey: key(),
      };
      const [first, again] = await Promise.all([
        createChangeOrderForActor(actor, input),
        createChangeOrderForActor(actor, input),
      ]);
      expect(first.id).toBe(again.id);
      await expect(
        createChangeOrderForActor(actor, { ...input, valueDelta: "200" }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
      await expect(
        createChangeOrderForActor(actor, {
          ...input,
          idempotencyKey: key(),
          valueDelta: "NaN",
        }),
      ).rejects.toThrow();
      const edit = {
        projectId: a,
        changeOrderId: first.id,
        title: "Revised extra work",
        description: "Actual approved requirement",
        valueDelta: "150",
        estimatedCostDelta: "25",
      };
      await updateChangeOrderForActor(actor, edit);
      await updateChangeOrderForActor(actor, edit);
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            projectId: a,
            eventType: "PROJECT_UPDATED",
            metadata: { path: ["changeOrderId"], equals: first.id },
          },
        }),
      ).toBe(1);
      await transitionChangeOrderForActor(
        actor,
        a,
        first.id,
        "PENDING_APPROVAL",
      );
      await transitionChangeOrderForActor(
        actor,
        a,
        first.id,
        "PENDING_APPROVAL",
      );
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            eventType: "CHANGE_ORDER_SUBMITTED",
            metadata: { path: ["changeOrderId"], equals: first.id },
          },
        }),
      ).toBe(1);
      await expect(
        transitionChangeOrderForActor(actor, a, first.id, "APPROVED"),
      ).rejects.toThrow("CHANGE_ORDER_SELF_APPROVAL_FORBIDDEN");
      const approverId = key();
      await client.user.create({
        data: {
          id: approverId,
          companyId,
          name: "Independent approver",
          email: `${approverId}@example.test`,
          passwordHash: "fixture-only",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      const approver = { ...actor, id: approverId };
      const before = await loadProjectCostingForActor(actor, a);
      await transitionChangeOrderForActor(approver, a, first.id, "APPROVED");
      await transitionChangeOrderForActor(approver, a, first.id, "APPROVED");
      const after = await loadProjectCostingForActor(actor, a);
      expect(
        after.metrics.contractRevenueBase
          .sub(before.metrics.contractRevenueBase)
          .toString(),
      ).toBe("150");
      expect(after.metrics.revenue.toString()).toBe(
        before.metrics.revenue.toString(),
      );
      expect(after.metrics.actualCost.toString()).toBe(
        before.metrics.actualCost.toString(),
      );
      expect(
        await client.projectAuditEvent.count({
          where: {
            companyId,
            eventType: "CHANGE_ORDER_APPROVED",
            metadata: { path: ["changeOrderId"], equals: first.id },
          },
        }),
      ).toBe(1);
      await expect(updateChangeOrderForActor(actor, edit)).rejects.toThrow(
        "CHANGE_ORDER_NOT_EDITABLE",
      );
      await expect(
        transitionChangeOrderForActor(actor, a, first.id, "APPROVED"),
      ).rejects.toThrow("CHANGE_ORDER_SELF_APPROVAL_FORBIDDEN");
      await expect(
        createChangeOrderForActor(
          { ...actor, accountRole: "ACCOUNTANT" },
          { ...input, idempotencyKey: key() },
        ),
      ).rejects.toThrow("Not authorized");
      const decrease = await createChangeOrderForActor(actor, {
        ...input,
        idempotencyKey: key(),
        valueDelta: "-2000",
      });
      await transitionChangeOrderForActor(
        actor,
        a,
        decrease.id,
        "PENDING_APPROVAL",
      );
      await expect(
        transitionChangeOrderForActor(approver, a, decrease.id, "APPROVED"),
      ).rejects.toThrow("INVALID_PROJECT_VALUE");
      expect(
        (
          await client.projectChangeOrder.findUniqueOrThrow({
            where: { id: decrease.id },
          })
        ).status,
      ).toBe("PENDING_APPROVAL");
      const costDecrease = await createChangeOrderForActor(actor, {
        ...input,
        idempotencyKey: key(),
        estimatedCostDelta: "-2000",
      });
      await transitionChangeOrderForActor(
        actor,
        a,
        costDecrease.id,
        "PENDING_APPROVAL",
      );
      await expect(
        transitionChangeOrderForActor(approver, a, costDecrease.id, "APPROVED"),
      ).rejects.toThrow("INVALID_PROJECT_ESTIMATED_COST");
      await expect(
        createChangeOrderForActor(actor, {
          ...input,
          projectId: key(),
          idempotencyKey: key(),
        }),
      ).rejects.toThrow("Not authorized");
      await client.project.update({
        where: { id: b },
        data: { status: "CLOSED" },
      });
      try {
        await expect(
          createChangeOrderForActor(actor, {
            ...input,
            projectId: b,
            idempotencyKey: key(),
          }),
        ).rejects.toThrow("PROJECT_FINAL");
      } finally {
        await client.project.update({
          where: { id: b },
          data: { status: "ACTIVE" },
        });
      }
    });
    it("keeps Project details available independently of the optional Costing module", async () => {
      const settings = await client.accountSettings.findUniqueOrThrow({
        where: { companyId },
      });
      try {
        await client.accountSettings.update({
          where: { companyId },
          data: {
            enabledModules: settings.enabledModules!.filter(
              (x) => x !== "PROJECT_COSTING",
            ),
          },
        });
        expect((await getProjectForActor(actor, a)).id).toBe(a);
        const options = await mobileProjectOptions({
          ...actor,
          name: "Admin",
          email: "admin@example.test",
          productEdition: "SALESPUNCH360_ACCOUNT",
          authorizedWorkspaces: ["ACCOUNT"],
        });
        expect(options.capabilities.costView).toBe(false);
        expect(options.capabilities.budgetEdit).toBe(true);
        await expect(loadProjectCostingForActor(actor, a)).rejects.toThrow(
          "MODULE_DISABLED:PROJECT_COSTING",
        );
      } finally {
        await client.accountSettings.update({
          where: { companyId },
          data: { enabledModules: settings.enabledModules! },
        });
      }
    });
    it("requires scoped tracking identities, rejects expiry and preserves physical serial availability", async () => {
      const batchProduct = await client.accountProduct.create({
        data: {
          companyId,
          name: "Batch material",
          code: key(),
          trackInventory: true,
          trackingMode: "BATCH",
          costPrice: 10,
        },
      });
      const serialProduct = await client.accountProduct.create({
        data: {
          companyId,
          name: "Serial material",
          code: key(),
          trackInventory: true,
          trackingMode: "SERIAL",
          costPrice: 10,
        },
      });
      const batch = await client.inventoryBatch.create({
        data: {
          companyId,
          productId: batchProduct.id,
          batchNumber: "CURRENT",
          expiryDate: new Date("2027-01-01"),
        },
      });
      const expired = await client.inventoryBatch.create({
        data: {
          companyId,
          productId: batchProduct.id,
          batchNumber: "EXPIRED",
          expiryDate: new Date("2026-01-01"),
        },
      });
      const serial = await client.inventorySerialNumber.create({
        data: {
          companyId,
          productId: serialProduct.id,
          serialNumber: "ONE",
          expiryDate: new Date("2027-01-01"),
        },
      });
      for (const row of [
        { productId: batchProduct.id, batchId: batch.id, quantity: 2 },
        { productId: batchProduct.id, batchId: expired.id, quantity: 2 },
        { productId: serialProduct.id, serialNumberId: serial.id, quantity: 1 },
      ])
        await client.stockMovement.create({
          data: {
            ...row,
            companyId,
            branchId,
            warehouseId,
            movementType: "OPENING",
            unitCost: 10,
            totalCost: row.quantity * 10,
            sourceType: "FIXTURE",
            sourceId: key(),
            movementDate: date,
            createdById: userId,
          },
        });
      const input = {
        projectId: a,
        warehouseId,
        productId: batchProduct.id,
        projectBudgetLineId: budgetA,
        quantity: "1",
        movementDate: date,
        idempotencyKey: key(),
      };
      await expect(
        issueInventoryToProjectForActor(actor, input),
      ).rejects.toThrow("BATCH_REQUIRED");
      await expect(
        issueInventoryToProjectForActor(actor, {
          ...input,
          batchId: expired.id,
        }),
      ).rejects.toThrow("EXPIRED_STOCK");
      await expect(
        issueInventoryToProjectForActor(actor, {
          ...input,
          batchId: randomUUID(),
        }),
      ).rejects.toThrow("INVALID_INVENTORY_BATCH");
      const context = await projectMaterialContextForActor(actor, {
        projectId: a,
        productId: batchProduct.id,
      });
      expect(
        context.products.find((x) => x.id === batchProduct.id)?.trackingMode,
      ).toBe("BATCH");
      expect(context.batches.map((x) => x.id).sort()).toEqual(
        [batch.id, expired.id].sort(),
      );
      expect(context.serialNumbers).toHaveLength(0);
      const issuedBatch = await issueInventoryToProjectForActor(actor, {
        ...input,
        batchId: batch.id,
      });
      const serialInput = {
        ...input,
        productId: serialProduct.id,
        idempotencyKey: key(),
      };
      await expect(
        issueInventoryToProjectForActor(actor, serialInput),
      ).rejects.toThrow("SERIAL_QUANTITY_MISMATCH");
      await expect(
        issueInventoryToProjectForActor(actor, {
          ...serialInput,
          serialNumberId: serial.id,
          quantity: "2",
        }),
      ).rejects.toThrow("SERIAL_QUANTITY_MISMATCH");
      await expect(
        issueInventoryToProjectForActor(actor, {
          ...serialInput,
          batchId: batch.id,
          serialNumberId: serial.id,
        }),
      ).rejects.toThrow("INVALID_INVENTORY_TRACKING");
      const issuedSerial = await issueInventoryToProjectForActor(actor, {
        ...serialInput,
        serialNumberId: serial.id,
      });
      await client.accountSettings.update({
        where: { companyId },
        data: { negativeStockAllowed: true },
      });
      try {
        await expect(
          issueInventoryToProjectForActor(actor, {
            ...serialInput,
            serialNumberId: serial.id,
            idempotencyKey: key(),
          }),
        ).rejects.toThrow("SERIAL_NOT_AVAILABLE");
      } finally {
        await client.accountSettings.update({
          where: { companyId },
          data: { negativeStockAllowed: false },
        });
      }
      await reverse(issuedBatch.id);
      await reverse(issuedSerial.id);
    });
    it("blocks inventory issue when item/stock settings are disabled and keeps material history readable", async () => {
      const input = {
        projectId: a,
        warehouseId,
        productId,
        projectBudgetLineId: budgetA,
        quantity: "1",
        movementDate: date,
        idempotencyKey: key(),
      };
      for (const [itemSettings, error] of [
        [{ enabled: false }, "ITEMS_DISABLED"],
        [{ itemType: "SERVICES" }, "PRODUCTS_DISABLED"],
        [{ stockMaintenance: false }, "STOCK_FIELDS_DISABLED"],
      ] as const) {
        await client.accountSettings.update({
          where: { companyId },
          data: { itemSettings },
        });
        try {
          await expect(
            issueInventoryToProjectForActor(actor, input),
          ).rejects.toThrow(error);
          const context = await projectMaterialContextForActor(actor, {
            projectId: a,
          });
          expect(context.capabilities.ISSUE).toBe(false);
          expect(context.movements.length).toBeGreaterThan(0);
        } finally {
          await client.accountSettings.update({
            where: { companyId },
            data: { itemSettings: {} },
          });
        }
      }
    });
    it("posts supplier returns atomically against Project availability, original cost, GST and payable", async () => {
      for (const treatment of ["ELIGIBLE", "BLOCKED"] as const) {
        const project = await createProjectForActor(actor, {
          branchId,
          customerId,
          name: `Supplier return ${treatment}`,
          projectValue: "1000",
        });
        const budget = await client.projectBudgetLine.create({
          data: {
            companyId,
            projectId: project.id,
            position: 0,
            category: "Materials",
            title: "Return budget",
            amount: 500,
          },
        });
        const beforeStock = await stock();
        const purchase = await createCommercialDocumentForActor(actor, {
          type: "PURCHASE_BILL",
          branchId,
          partyId: vendorId,
          projectId: project.id,
          projectBudgetLineId: budget.id,
          purchasePurpose: "PROJECT",
          materialTreatment: "DIRECT_TO_PROJECT",
          vendorInvoiceNumber: key(),
          vendorInvoiceDate: date,
          issueDate: date,
          taxCreditTreatment: treatment,
          stateOfSupplyCode: "29",
          lines: [
            {
              lineType: "MATERIAL",
              sourceId: productId,
              warehouseId,
              quantity: "5",
              rate: "10",
              taxRate: "18",
            },
          ],
        });
        expect(
          (await getCommercialDocumentForActor(actor, purchase.id)).financial,
        ).toBeNull();
        await postCommercialDocumentForActor(actor, {
          documentId: purchase.id,
        });
        expect(
          (
            await getCommercialDocumentForActor(actor, purchase.id)
          ).financial?.outstanding.eq(purchase.payableAmount!),
        ).toBe(true);
        expect((await stock()).stockValue.eq(beforeStock.stockValue)).toBe(
          true,
        );
        const sourceLine = await client.commercialDocumentLine.findFirstOrThrow(
          { where: { companyId, documentId: purchase.id } },
        );
        const input = {
          type: "DEBIT_NOTE",
          branchId,
          partyId: vendorId,
          purchasePurpose: "PROJECT",
          sourceDocumentId: purchase.id,
          issueDate: date,
          lines: [
            {
              lineType: "MATERIAL",
              sourceId: productId,
              warehouseId,
              sourceCommercialLineId: sourceLine.id,
              stockReturnQuantity: "2",
              quantity: "2",
              rate: "10",
            },
          ],
        };
        const correction = await createCommercialDocumentForActor(actor, input);
        const [journal, concurrentReplay] = await Promise.all([
          postCommercialDocumentForActor(actor, { documentId: correction.id }),
          postCommercialDocumentForActor(actor, { documentId: correction.id }),
        ]);
        expect(concurrentReplay.id).toBe(journal.id);
        expect(
          (
            await postCommercialDocumentForActor(actor, {
              documentId: correction.id,
            })
          ).id,
        ).toBe(journal.id);
        const movement = await client.projectMaterialMovement.findFirstOrThrow({
          where: { companyId, correctionDocumentId: correction.id },
        });
        const original = await client.projectMaterialMovement.findFirstOrThrow({
          where: {
            companyId,
            projectId: project.id,
            purchaseDocumentId: purchase.id,
            movementType: "INVENTORY_ISSUE_TO_PROJECT",
          },
        });
        expect(movement.movementType).toBe("RETURN_TO_VENDOR");
        expect(movement.sourceMovementId).toBe(original.id);
        expect(movement.originalUnitCost.eq(original.originalUnitCost)).toBe(
          true,
        );
        expect(movement.quantity.toString()).toBe("2");
        expect((await balance(project.id)).available.toString()).toBe("3");
        expect((await stock()).quantity.eq(beforeStock.quantity)).toBe(true);
        expect(
          await client.stockMovement.count({
            where: { companyId, sourceId: correction.id },
          }),
        ).toBe(0);
        const originalCost = treatment === "ELIGIBLE" ? "50" : "59";
        const returnedCost = treatment === "ELIGIBLE" ? "20" : "23.6";
        const costing = await loadProjectCostingForActor(actor, project.id);
        expect(costing.metrics.actualCost.toString()).toBe(
          new Prisma.Decimal(originalCost).sub(returnedCost).toString(),
        );
        expect(costing.metrics.materialReturnedToVendor.toString()).toBe(
          returnedCost,
        );
        const lines = await client.journalLine.findMany({
          where: { companyId, journalEntryId: journal.id },
          include: { ledgerAccount: true },
        });
        expect(
          lines
            .find((x) => x.ledgerAccount.systemKey === "PROJECT_MATERIAL_WIP")
            ?.credit.toString(),
        ).toBe(returnedCost);
        expect(
          lines
            .find((x) => x.ledgerAccount.systemKey === "ACCOUNTS_PAYABLE")
            ?.debit.toString(),
        ).toBe("23.6");
        expect(
          lines.some((x) => x.ledgerAccount.systemKey === "INVENTORY_ASSET"),
        ).toBe(false);
        expect(
          await client.projectAuditEvent.count({
            where: {
              companyId,
              projectId: project.id,
              metadata: { path: ["movementId"], equals: movement.id },
            },
          }),
        ).toBe(1);
        await expect(reverse(movement.id)).rejects.toThrow(
          "REVERSE_PROJECT_PURCHASE_DOCUMENT",
        );
        const tooMuch = await createCommercialDocumentForActor(actor, {
          ...input,
          lines: [
            {
              ...input.lines[0],
              stockReturnQuantity: "4",
              quantity: "4",
              rate: "1",
            },
          ],
        });
        await expect(
          postCommercialDocumentForActor(actor, { documentId: tooMuch.id }),
        ).rejects.toThrow("ADJUSTMENT_STOCK_EXCEEDS_SOURCE");
        expect(
          await client.projectMaterialMovement.count({
            where: { companyId, correctionDocumentId: tooMuch.id },
          }),
        ).toBe(0);
        expect(
          (
            await client.commercialDocument.findUniqueOrThrow({
              where: { id: tooMuch.id },
            })
          ).status,
        ).toBe("DRAFT");
        const consumed = await consumeProjectMaterialForActor(actor, {
          projectId: project.id,
          sourceMovementId: original.id,
          quantity: "2",
          movementDate: date,
          idempotencyKey: key(),
        });
        const unavailable = await createCommercialDocumentForActor(actor, {
          ...input,
          lines: [
            {
              ...input.lines[0],
              stockReturnQuantity: "2",
              quantity: "2",
              rate: "1",
            },
          ],
        });
        await expect(
          postCommercialDocumentForActor(actor, { documentId: unavailable.id }),
        ).rejects.toThrow("INSUFFICIENT_PROJECT_MATERIAL");
        expect(
          await client.projectMaterialMovement.count({
            where: { companyId, correctionDocumentId: unavailable.id },
          }),
        ).toBe(0);
        await reverse(consumed.id);
        const priceOnly = await createCommercialDocumentForActor(actor, {
          ...input,
          lines: [
            {
              ...input.lines[0],
              stockReturnQuantity: "0",
              quantity: "1",
              rate: "1",
            },
          ],
        });
        await postCommercialDocumentForActor(actor, {
          documentId: priceOnly.id,
        });
        expect((await balance(project.id)).available.toString()).toBe("3");
        expect(
          await client.projectMaterialMovement.count({
            where: { companyId, correctionDocumentId: priceOnly.id },
          }),
        ).toBe(0);
        expect(
          (
            await loadProjectCostingForActor(actor, project.id)
          ).metrics.actualCost.toString(),
        ).toBe(treatment === "ELIGIBLE" ? "29" : "34.22");
      }
    }, 30000);
    it("splits a mixed inventory/Project purchase return without deducting normal stock twice", async () => {
      const project = await createProjectForActor(actor, {
        branchId,
        customerId,
        name: "Mixed supplier return",
        projectValue: "1000",
      });
      const budget = await client.projectBudgetLine.create({
        data: {
          companyId,
          projectId: project.id,
          position: 0,
          category: "Materials",
          title: "Mixed budget",
          amount: 500,
        },
      });
      const purchase = await createCommercialDocumentForActor(actor, {
        type: "PURCHASE_BILL",
        branchId,
        partyId: vendorId,
        purchasePurpose: "MIXED",
        vendorInvoiceNumber: key(),
        vendorInvoiceDate: date,
        issueDate: date,
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            quantity: "10",
            rate: "10",
            taxRate: "0",
            purchaseAllocations: [
              {
                allocationType: "PROJECT",
                projectId: project.id,
                projectBudgetLineId: budget.id,
                quantity: "4",
                materialTreatment: "DIRECT_TO_PROJECT",
                warehouseId,
              },
              { allocationType: "INVENTORY", quantity: "6", warehouseId },
            ],
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: purchase.id });
      const beforeStock = await stock();
      const correction = await createCommercialDocumentForActor(actor, {
        type: "DEBIT_NOTE",
        branchId,
        partyId: vendorId,
        purchasePurpose: "INVENTORY_SALES",
        sourceDocumentId: purchase.id,
        issueDate: date,
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            sourceCommercialLineId: (
              await client.commercialDocumentLine.findFirstOrThrow({
                where: { companyId, documentId: purchase.id },
              })
            ).id,
            stockReturnQuantity: "5",
            quantity: "5",
            rate: "10",
          },
        ],
      });
      const journal = await postCommercialDocumentForActor(actor, {
        documentId: correction.id,
      });
      expect((await stock()).quantity.toString()).toBe(
        beforeStock.quantity.sub(3).toString(),
      );
      expect((await balance(project.id)).available.toString()).toBe("2");
      expect(
        (
          await loadProjectCostingForActor(actor, project.id)
        ).metrics.actualCost.toString(),
      ).toBe("20");
      const settings = await client.accountSettings.findUniqueOrThrow({
        where: { companyId },
      });
      await client.accountSettings.update({
        where: { companyId },
        data: {
          enabledModules: settings.enabledModules!.filter(
            (x) => x !== "PROJECTS",
          ),
        },
      });
      try {
        await expect(
          postCommercialDocumentForActor(actor, { documentId: correction.id }),
        ).rejects.toThrow("MODULE_DISABLED:PROJECTS");
      } finally {
        await client.accountSettings.update({
          where: { companyId },
          data: { enabledModules: settings.enabledModules! },
        });
      }
      const lines = await client.journalLine.findMany({
        where: { companyId, journalEntryId: journal.id },
        include: { ledgerAccount: true },
      });
      expect(
        lines
          .find((x) => x.ledgerAccount.systemKey === "INVENTORY_ASSET")
          ?.credit.toString(),
      ).toBe("30");
      expect(
        lines
          .find((x) => x.ledgerAccount.systemKey === "PROJECT_MATERIAL_WIP")
          ?.credit.toString(),
      ).toBe("20");
    });
    it("receives a Project-linked inventory purchase into stock and costs it only when issued", async () => {
      const project = await createProjectForActor(actor, {
        branchId,
        customerId,
        name: "Receive then issue",
        projectValue: "1000",
      });
      const budget = await client.projectBudgetLine.create({
        data: {
          companyId,
          projectId: project.id,
          position: 0,
          category: "Materials",
          title: "Inventory budget",
          amount: 500,
        },
      });
      const beforeStock = await stock();
      const purchase = await createCommercialDocumentForActor(actor, {
        type: "PURCHASE_BILL",
        branchId,
        partyId: vendorId,
        projectId: project.id,
        projectBudgetLineId: budget.id,
        purchasePurpose: "PROJECT",
        materialTreatment: "RECEIVE_IN_INVENTORY",
        vendorInvoiceNumber: key(),
        vendorInvoiceDate: date,
        issueDate: date,
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            quantity: "2",
            rate: "10",
            taxRate: "0",
          },
        ],
      });
      await postCommercialDocumentForActor(actor, { documentId: purchase.id });
      expect((await stock()).quantity.eq(beforeStock.quantity.add(2))).toBe(
        true,
      );
      expect(
        await client.projectMaterialMovement.count({
          where: { companyId, purchaseDocumentId: purchase.id },
        }),
      ).toBe(0);
      expect(
        (
          await loadProjectCostingForActor(actor, project.id)
        ).metrics.actualCost.toString(),
      ).toBe("0");
      const issued = await issueInventoryToProjectForActor(actor, {
        projectId: project.id,
        projectBudgetLineId: budget.id,
        productId,
        warehouseId,
        quantity: "2",
        movementDate: date,
        idempotencyKey: key(),
      });
      expect(issued.totalCost.toString()).toBe("20");
      expect(
        (
          await loadProjectCostingForActor(actor, project.id)
        ).metrics.actualCost.toString(),
      ).toBe("20");
      expect((await stock()).quantity.eq(beforeStock.quantity)).toBe(true);
    });
    it("preserves six fractional quantity digits between Project and inventory movements", async () => {
      const beforeStock = await stock();
      const issued = await issueInventoryToProjectForActor(actor, {
        projectId: a,
        projectBudgetLineId: budgetA,
        productId,
        warehouseId,
        quantity: "0.000001",
        movementDate: date,
        idempotencyKey: key(),
      });
      const inventory = await client.stockMovement.findFirstOrThrow({
        where: { companyId, sourceId: issued.id },
      });
      expect(inventory.quantity.eq(issued.quantity)).toBe(true);
      expect(
        (await stock()).quantity.eq(beforeStock.quantity.sub("0.000001")),
      ).toBe(true);
      await reverse(issued.id);
      expect((await stock()).quantity.eq(beforeStock.quantity)).toBe(true);
    });
    it("enforces purchase permission in the service while keeping ordinary accountant/data-entry drafts independent", async () => {
      const input = {
        type: "PURCHASE_BILL",
        branchId,
        partyId: vendorId,
        purchasePurpose: "INVENTORY_SALES",
        vendorInvoiceNumber: key(),
        vendorInvoiceDate: date,
        issueDate: date,
        lines: [
          {
            lineType: "MATERIAL",
            sourceId: productId,
            warehouseId,
            quantity: "1",
            rate: "10",
            taxRate: "0",
          },
        ],
      };
      await expect(
        createCommercialDocumentForActor(
          { ...actor, accountRole: "PROJECT_MANAGER" },
          input,
        ),
      ).rejects.toThrow("Not authorized");
      for (const denied of [
        { ...actor, isActive: false },
        { ...actor, accountAccessActive: false },
      ])
        await expect(
          createCommercialDocumentForActor(denied, input),
        ).rejects.toThrow("Not authorized");
      for (const accountRole of ["ACCOUNTANT", "DATA_ENTRY"] as const) {
        const draft = await createCommercialDocumentForActor(
          { ...actor, accountRole },
          { ...input, vendorInvoiceNumber: key() },
        );
        expect(draft.status).toBe("DRAFT");
        if (accountRole === "DATA_ENTRY")
          await expect(
            postCommercialDocumentForActor(
              { ...actor, accountRole },
              { documentId: draft.id },
            ),
          ).rejects.toThrow("Not authorized");
      }
    });
    it("blocks direct domain reads and every material action when Projects is OFF", async () => {
      await client.accountSettings.update({
        where: { companyId },
        data: { enabledModules: ["INVENTORY", "PURCHASES", "PURCHASE_BILLS"] },
      });
      try {
        const regular = {
          type: "PURCHASE_BILL",
          branchId,
          partyId: vendorId,
          purchasePurpose: "INVENTORY_SALES",
          vendorInvoiceNumber: key(),
          vendorInvoiceDate: date,
          issueDate: date,
          lines: [
            {
              lineType: "MATERIAL",
              sourceId: productId,
              warehouseId,
              quantity: "2",
              rate: "10",
              taxRate: "0",
            },
          ],
        };
        const document = await createCommercialDocumentForActor(actor, regular);
        await postCommercialDocumentForActor(actor, {
          documentId: document.id,
        });
        expect(
          (
            await client.commercialDocument.findUniqueOrThrow({
              where: { id: document.id },
            })
          ).status,
        ).toBe("POSTED");
        await expect(
          createCommercialDocumentForActor(actor, {
            ...regular,
            vendorInvoiceNumber: key(),
            purchasePurpose: "PROJECT",
            projectId: a,
            projectBudgetLineId: budgetA,
            materialTreatment: "DIRECT_TO_PROJECT",
          }),
        ).rejects.toThrow("Not authorized");
        for (const call of [
          () => getProjectForActor(actor, a),
          () => projectMaterialContextForActor(actor),
          () => issueInventoryToProjectForActor(actor, {}),
          () => consumeProjectMaterialForActor(actor, {}),
          () => returnProjectMaterialForActor(actor, {}),
          () => transferProjectMaterialForActor(actor, {}),
          () => reverseProjectMaterialForActor(actor, {}),
        ])
          await expect(call()).rejects.toThrow("MODULE_DISABLED:PROJECTS");
      } finally {
        await client.accountSettings.update({
          where: { companyId },
          data: {
            enabledModules: [
              "PROJECTS",
              "PROJECT_COSTING",
              "INVENTORY",
              "PURCHASES",
              "PURCHASE_BILLS",
              "DEBIT_NOTE",
              "SALES",
              "CUSTOMER_ADVANCES",
              "CUSTOMER_RECEIPTS",
            ],
          },
        });
      }
    });
  },
);

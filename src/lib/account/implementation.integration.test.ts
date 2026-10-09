import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
const url = process.env.ACCOUNT_INTEGRATION_DATABASE_URL;
if (url && !["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("Integration tests require an isolated local database");
const client = new PrismaClient({
  datasources: {
    db: {
      url: url ?? "postgresql://test:test@127.0.0.1:55432/salespunch360_test",
    },
  },
});
vi.mock("@/lib/db", () => ({
  db: new Proxy(
    {},
    { get: (_target, key) => client[key as keyof PrismaClient] },
  ),
}));
import {
  assignAssetForActor,
  createAssetForActor,
  returnAssetForActor,
  setAssetStatusForActor,
  updateAssetForActor,
  listAssetsForActor,
  getAssetForActor,
} from "./assets";
import {
  createExpenseForActor,
  deactivateExpenseCategoryForActor,
  postExpenseForActor,
  reverseExpenseForActor,
  saveExpenseCategoryForActor,
  transitionExpenseForActor,
  updateExpenseForActor,
  getExpenseForActor,
} from "./expenses";
import { runFinancialReportForActor } from "./reports/service";
import {
  postJournalInTx,
  postJournalForActor,
  journalHistoryForActor,
  setPeriodLockForActor,
} from "@/lib/accounting/service";
import { saveCustomFieldValuesInTx } from "./custom-field-values";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  branchA = randomUUID(),
  branchB = randomUUID(),
  userId = randomUUID(),
  fyId = randomUUID(),
  cashId = randomUUID(),
  expenseId = randomUUID(),
  categoryId = randomUUID(),
  moneyId = randomUUID(),
  incomeId = randomUUID();
const actor = {
  id: userId,
  companyId,
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [branchA, branchB],
} as ProjectActor;
const input = (branchId = branchA) => ({
  branchId,
  name: "Integration equipment",
  assetType: "EQUIPMENT",
  purchaseDate: "2026-10-09",
  purchaseValue: "100",
  requestKey: randomUUID(),
});
async function rejectAudit(eventType: string, operation: () => Promise<void>) {
  if (!/^[A-Z_]+$/.test(eventType)) throw new Error("Invalid fixture event");
  const fn = `integration_failure_${randomUUID().replaceAll("-", "")}`;
  await client.$executeRawUnsafe(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId" = '${companyId}'::uuid AND NEW."eventType" = '${eventType}' THEN RAISE EXCEPTION 'integration audit failure'; END IF; RETURN NEW; END $$`,
  );
  await client.$executeRawUnsafe(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    await operation();
  } finally {
    await client.$executeRawUnsafe(
      `DROP TRIGGER ${fn} ON account_operational_audits`,
    );
    await client.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);
  }
}
describe.skipIf(!url)("A042/A045/A046 real PostgreSQL integrity", () => {
  beforeAll(async () => {
    await client.company.create({
      data: {
        id: companyId,
        name: "Isolated implementation tests",
        slug: `integration-${companyId}`,
        productEdition: "SALESPUNCH360_ACCOUNT",
      },
    });
    await client.accountSettings.create({
      data: { companyId, enabledModules: ["ASSETS"] },
    });
    await client.branch.createMany({
      data: [
        { id: branchA, companyId, name: "A", code: "A", isPrimary: true },
        { id: branchB, companyId, name: "B", code: "B" },
      ],
    });
    await client.financialYear.create({
      data: {
        id: fyId,
        companyId,
        name: "2026-27",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
      },
    });
    await client.ledgerAccount.createMany({
      data: [
        {
          id: cashId,
          companyId,
          code: "100",
          name: "Cash",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
        {
          id: expenseId,
          companyId,
          code: "500",
          name: "Expense",
          accountClass: "EXPENSE",
          normalBalance: "DEBIT",
        },
        {
          id: incomeId,
          companyId,
          code: "400",
          name: "Income",
          accountClass: "INCOME",
          normalBalance: "CREDIT",
        },
      ],
    });
    await client.moneyAccount.create({
      data: {
        id: moneyId,
        companyId,
        branchId: branchA,
        type: "CASH",
        name: "Ordinary cash",
        ledgerAccountId: cashId,
      },
    });
    await client.expenseCategory.create({
      data: {
        id: categoryId,
        companyId,
        name: "Test expense",
        scope: "EXPENSE",
        defaultLedgerAccountId: expenseId,
      },
    });
    await client.user.create({
      data: {
        id: userId,
        companyId,
        name: "Test admin",
        email: `${userId}@example.test`,
        passwordHash: "test-only",
        role: "ACCOUNT_USER",
        accountRole: "ACCOUNT_ADMIN",
        accountAccessActive: true,
      },
    });
  });
  afterAll(async () => {
    await client.expenseTransaction.deleteMany({ where: { companyId } });
    await client.expenseCategory.deleteMany({ where: { companyId } });
    await client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
      await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
      await tx.journalLine.deleteMany({ where: { companyId } });
      await tx.journalEntry.deleteMany({ where: { companyId } });
    });
    await client.moneyAccount.deleteMany({ where: { companyId } });
    await client.ledgerAccount.deleteMany({ where: { companyId } });
    await client.accountingPeriodLock.deleteMany({ where: { companyId } });
    await client.financialYear.deleteMany({ where: { companyId } });
    await client.assetAssignmentHistory.deleteMany({ where: { companyId } });
    await client.asset.deleteMany({ where: { companyId } });
    await client.accountOperationalAudit.deleteMany({ where: { companyId } });
    await client.customFieldDefinition.deleteMany({ where: { companyId } });
    await client.vendor.deleteMany({ where: { companyId } });
    await client.numberingSeries.deleteMany({ where: { companyId } });
    await client.accountSettings.deleteMany({ where: { companyId } });
    await client.user.deleteMany({ where: { companyId } });
    await client.branch.deleteMany({ where: { companyId } });
    await client.company.deleteMany({ where: { id: companyId } });
    await client.$disconnect();
  });
  it("allocates company-unique asset numbers across branches", async () => {
    const first = await createAssetForActor(actor, input(branchA)),
      second = await createAssetForActor(actor, input(branchB));
    expect(first.assetNumber).not.toBe(second.assetNumber);
  });
  it("deduplicates concurrent create requests without duplicate numbers or audits", async () => {
    const request = input();
    const rows = await Promise.all([
      createAssetForActor(actor, request),
      createAssetForActor(actor, request),
    ]);
    expect(rows[0].id).toBe(rows[1].id);
    expect(
      await client.asset.count({
        where: { companyId, creationRequestKey: request.requestKey },
      }),
    ).toBe(1);
    expect(
      await client.accountOperationalAudit.count({
        where: { companyId, entityId: rows[0].id, eventType: "ASSET_CREATED" },
      }),
    ).toBe(1);
  });
  it("preserves assignment notes across return and writes one return audit", async () => {
    const row = await createAssetForActor(actor, input());
    await assignAssetForActor(actor, row.id, userId, "Original assignment");
    await returnAssetForActor(actor, row.id, "Returned safely");
    const history = await client.assetAssignmentHistory.findFirstOrThrow({
      where: { companyId, assetId: row.id },
    });
    expect(history.notes).toBe("Original assignment");
    expect(history.returnedAt).not.toBeNull();
    expect(
      (await client.asset.findUniqueOrThrow({ where: { id: row.id } })).status,
    ).toBe("ACTIVE");
  });
  it("rejects conflicting assignment/status operations without invalid state", async () => {
    const row = await createAssetForActor(actor, input());
    const outcomes = await Promise.allSettled([
      assignAssetForActor(actor, row.id, userId),
      setAssetStatusForActor(actor, row.id, "DISPOSED"),
    ]);
    expect(outcomes.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const final = await client.asset.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(
      final.status === "DISPOSED"
        ? final.assignedUserId === null
        : final.status === "ASSIGNED" && final.assignedUserId === userId,
    ).toBe(true);
  });
  it("rolls back a vendor when required custom fields fail", async () => {
    await client.customFieldDefinition.create({
      data: {
        companyId,
        entityType: "VENDOR",
        fieldKey: "required_test",
        label: "Required",
        dataType: "TEXT",
        isRequired: true,
      },
    });
    const name = randomUUID();
    await expect(
      client.$transaction(async (tx) => {
        const row = await tx.vendor.create({ data: { companyId, name } });
        await saveCustomFieldValuesInTx(tx, companyId, "VENDOR", row.id, {});
      }),
    ).rejects.toThrow("CUSTOM_FIELDS_REQUIRED");
    expect(await client.vendor.count({ where: { companyId, name } })).toBe(0);
  });
  it("reverses expense and journal atomically and rejects repeated reversal", async () => {
    const id = randomUUID(),
      journal = await client.$transaction((tx) =>
        postJournalInTx(tx, actor, {
          financialYearId: fyId,
          branchId: branchA,
          entryDate: "2026-10-09",
          sourceType: "EXPENSE",
          sourceId: id,
          lines: [
            { ledgerAccountId: expenseId, debit: "100", credit: "0" },
            { ledgerAccountId: cashId, debit: "0", credit: "100" },
          ],
        }),
      );
    await client.expenseTransaction.create({
      data: {
        id,
        companyId,
        branchId: branchA,
        categoryId,
        type: "OFFICE_EXPENSE",
        status: "POSTED",
        transactionNumber: "EXP-test",
        transactionDate: new Date("2026-10-09"),
        taxableAmount: "100",
        totalAmount: "100",
        journalEntryId: journal.id,
        createdById: userId,
      },
    });
    const reversed = await reverseExpenseForActor(
      actor,
      id,
      new Date("2026-10-10"),
      "Integration correction",
    );
    expect(
      (await client.expenseTransaction.findUniqueOrThrow({ where: { id } }))
        .reversalJournalId,
    ).toBe(reversed.id);
    expect(
      (
        await client.journalEntry.findUniqueOrThrow({
          where: { id: journal.id },
        })
      ).status,
    ).toBe("REVERSED");
    await expect(
      reverseExpenseForActor(
        actor,
        id,
        new Date("2026-10-10"),
        "Repeated correction",
      ),
    ).rejects.toThrow();
    expect(
      await client.journalEntry.count({
        where: { companyId, reversalOfId: journal.id },
      }),
    ).toBe(1);
  });
  it("rolls back asset status when its audit insert fails in PostgreSQL", async () => {
    const row = await createAssetForActor(actor, input());
    const suffix = randomUUID().replaceAll("-", ""),
      fn = `integration_audit_${suffix}`;
    await client.$executeRawUnsafe(
      `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId" = '${companyId}'::uuid AND NEW."eventType" = 'ASSET_STATUS_CHANGED' THEN RAISE EXCEPTION 'integration audit failure'; END IF; RETURN NEW; END $$`,
    );
    await client.$executeRawUnsafe(
      `CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
    );
    try {
      await expect(
        setAssetStatusForActor(actor, row.id, "RETIRED"),
      ).rejects.toThrow("integration audit failure");
      expect(
        (await client.asset.findUniqueOrThrow({ where: { id: row.id } }))
          .status,
      ).toBe("ACTIVE");
    } finally {
      await client.$executeRawUnsafe(
        `DROP TRIGGER ${fn} ON account_operational_audits`,
      );
      await client.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);
    }
  });
  it("preserves richer asset fields on partial edit and clears explicitly nullable fields", async () => {
    const asset = await createAssetForActor(actor, {
      ...input(),
      description: "Keep rich description",
      serialNumber: "SN-123",
      category: "Old category",
      hsnCode: "8471",
      openingQuantity: "2",
      unitPrice: "50",
      effectiveDate: "2026-10-09",
    });
    const edited = await updateAssetForActor(actor, asset.id, {
      name: "Edited equipment",
      category: null,
    });
    expect(edited.category).toBeNull();
    expect(edited.serialNumber).toBe("SN-123");
    expect(edited.description).toBe("Keep rich description");
    expect(edited.openingQuantity?.toString()).toBe("2");
    await expect(
      updateAssetForActor(actor, asset.id, { purchaseValue: "99" }),
    ).rejects.toThrow("OPENING_VALUE_MISMATCH");
    expect(
      (
        await client.asset.findUniqueOrThrow({ where: { id: asset.id } })
      ).purchaseValue.toFixed(2),
    ).toBe("100.00");
  });
  it("retains reversed journals and inactive historic ledgers in reports", async () => {
    await client.ledgerAccount.update({
      where: { id: expenseId },
      data: { isActive: false },
    });
    try {
      const r = await runFinancialReportForActor(actor, "trial-balance", {
        from: "2026-10-09",
        to: "2026-10-10",
      });
      const row = r.rows.find((x) => x[0] === "500");
      expect(row).toBeDefined();
      expect(Number(row?.[6])).toBe(0);
      expect(Number(row?.[7])).toBe(0);
    } finally {
      await client.ledgerAccount.update({
        where: { id: expenseId },
        data: { isActive: true },
      });
    }
  });
  it("uses separate validated BOTH category mappings for income and expense", async () => {
    const category = await saveExpenseCategoryForActor(actor, {
      name: "Both purpose",
      scope: "BOTH",
      defaultLedgerAccountId: expenseId,
      incomeLedgerAccountId: incomeId,
    });
    expect(category).toBeTruthy();
    for (const type of ["OFFICE_EXPENSE", "OTHER_INCOME"] as const) {
      const row = await createExpenseForActor(actor, {
        branchId: branchA,
        categoryId: category!.id,
        type,
        transactionDate: "2026-10-09",
        taxableAmount: "25",
        moneyAccountId: moneyId,
        requestKey: randomUUID(),
      });
      await transitionExpenseForActor(actor, row.id, "PENDING_APPROVAL");
      await postExpenseForActor(actor, row.id);
      expect(row.categoryLedgerAccountId).toBe(
        type === "OTHER_INCOME" ? incomeId : expenseId,
      );
    }
  });
  it("rejects changed category classification after approval without posting", async () => {
    const category = await saveExpenseCategoryForActor(actor, {
      name: "Mapping test",
      scope: "EXPENSE",
      defaultLedgerAccountId: expenseId,
    });
    const row = await createExpenseForActor(actor, {
      branchId: branchA,
      categoryId: category!.id,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "10",
      moneyAccountId: moneyId,
    });
    await transitionExpenseForActor(actor, row.id, "PENDING_APPROVAL");
    await saveExpenseCategoryForActor(
      actor,
      {
        name: "Mapping test",
        scope: "INCOME",
        defaultLedgerAccountId: incomeId,
      },
      category!.id,
    );
    await expect(postExpenseForActor(actor, row.id)).rejects.toThrow(
      "EXPENSE_CATEGORY_CLASS_MISMATCH",
    );
    expect(
      await client.journalEntry.count({
        where: { companyId, sourceId: row.id },
      }),
    ).toBe(0);
    expect(
      (
        await client.expenseTransaction.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe("APPROVED");
  });
  it("blocks an inactive selected cash account instead of silently posting payable", async () => {
    const row = await createExpenseForActor(actor, {
      branchId: branchA,
      categoryId,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "10",
      moneyAccountId: moneyId,
    });
    await transitionExpenseForActor(actor, row.id, "PENDING_APPROVAL");
    await client.moneyAccount.update({
      where: { id: moneyId },
      data: { isActive: false },
    });
    try {
      await expect(postExpenseForActor(actor, row.id)).rejects.toThrow(
        "INVALID_MONEY_ACCOUNT",
      );
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: row.id },
        }),
      ).toBe(0);
    } finally {
      await client.moneyAccount.update({
        where: { id: moneyId },
        data: { isActive: true },
      });
    }
  });
  it("deduplicates expense creation and posts balanced line/charge/rounding totals", async () => {
    const payload = {
      branchId: branchA,
      categoryId,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "0",
      moneyAccountId: moneyId,
      requestKey: randomUUID(),
      billedItems: [{ name: "Fuel", quantity: "2", rate: "10.15" }],
      additionalCharges: "1",
      roundOffEnabled: true,
    };
    const rows = await Promise.all([
      createExpenseForActor(actor, payload),
      createExpenseForActor(actor, payload),
    ]);
    expect(rows[0].id).toBe(rows[1].id);
    expect(rows[0].totalAmount.toFixed(2)).toBe("21.00");
    await transitionExpenseForActor(actor, rows[0].id, "PENDING_APPROVAL");
    const journal = await postExpenseForActor(actor, rows[0].id);
    const lines = await client.journalLine.findMany({
      where: { companyId, journalEntryId: journal.id },
    });
    expect(
      lines.reduce((s, l) => s + l.debit.toNumber() - l.credit.toNumber(), 0),
    ).toBe(0);
  });
  it("includes ordinary cash ledgers in cash-flow without systemKey and keeps branch scope", async () => {
    const r = await runFinancialReportForActor(actor, "cash-flow", {
      from: "2026-10-09",
      to: "2026-10-10",
      branchId: branchA,
    });
    expect(r.rows.find((x) => x[0] === "Operating")?.[1]).toBe("-21.00");
    const other = await runFinancialReportForActor(actor, "cash-flow", {
      from: "2026-10-09",
      to: "2026-10-10",
      branchId: branchB,
    });
    expect(Number(other.rows[0][1])).toBe(0);
  });
  it("rejects income CESS and zero-valued drafts before creation", async () => {
    const category = await saveExpenseCategoryForActor(actor, {
      name: "Income validation",
      scope: "INCOME",
      defaultLedgerAccountId: incomeId,
    });
    const payload = {
      branchId: branchA,
      categoryId: category!.id,
      type: "OTHER_INCOME",
      transactionDate: "2026-10-09",
      taxableAmount: "100",
      moneyAccountId: moneyId,
    };
    await expect(
      createExpenseForActor(actor, { ...payload, cessRate: "2" }),
    ).rejects.toThrow("OTHER_INCOME_TAX_REQUIRES_A12");
    await expect(
      createExpenseForActor(actor, { ...payload, taxableAmount: "0" }),
    ).rejects.toThrow("INVALID_EXPENSE_AMOUNT");
  });
  it("retains scoped before/after category history and rolls back rejected audit writes", async () => {
    const created = await saveExpenseCategoryForActor(actor, {
      name: "Audit category",
      scope: "EXPENSE",
      defaultLedgerAccountId: expenseId,
    });
    await saveExpenseCategoryForActor(
      actor,
      {
        name: "Audit renamed",
        scope: "EXPENSE",
        defaultLedgerAccountId: expenseId,
      },
      created!.id,
    );
    const event = await client.accountOperationalAudit.findFirstOrThrow({
      where: {
        companyId,
        entityId: created!.id,
        eventType: "EXPENSE_CATEGORY_UPDATED",
      },
    });
    expect(event.actorUserId).toBe(userId);
    expect(event.metadata).toMatchObject({
      before: { name: "Audit category" },
      after: { name: "Audit renamed" },
    });
    await rejectAudit("EXPENSE_CATEGORY_DEACTIVATED", async () => {
      await expect(
        deactivateExpenseCategoryForActor(actor, created!.id),
      ).rejects.toThrow("integration audit failure");
      expect(
        (
          await client.expenseCategory.findUniqueOrThrow({
            where: { id: created!.id },
          })
        ).isActive,
      ).toBe(true);
    });
    const count = await client.accountOperationalAudit.count({
      where: { companyId, entityId: created!.id },
    });
    await expect(
      deactivateExpenseCategoryForActor(
        { ...actor, accountRole: "ACCOUNTANT" },
        created!.id,
      ),
    ).rejects.toThrow();
    expect(
      await client.accountOperationalAudit.count({
        where: { companyId, entityId: created!.id },
      }),
    ).toBe(count);
  });
  it("rolls back the journal reversal if expense audit fails", async () => {
    const row = await createExpenseForActor(actor, {
      branchId: branchA,
      categoryId,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "7",
      moneyAccountId: moneyId,
    });
    await transitionExpenseForActor(actor, row.id, "PENDING_APPROVAL");
    const journal = await postExpenseForActor(actor, row.id);
    await rejectAudit("EXPENSE_REVERSED", async () => {
      await expect(
        reverseExpenseForActor(
          actor,
          row.id,
          new Date("2026-10-10"),
          "Rollback verification",
        ),
      ).rejects.toThrow("integration audit failure");
      expect(
        (
          await client.journalEntry.findUniqueOrThrow({
            where: { id: journal.id },
          })
        ).status,
      ).toBe("POSTED");
      expect(
        (
          await client.expenseTransaction.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).status,
      ).toBe("POSTED");
      expect(
        await client.journalEntry.count({
          where: { companyId, reversalOfId: journal.id },
        }),
      ).toBe(0);
    });
  });
  it("persists explicit clears for nullable asset metadata and rejects incomplete opening fields in SQL", async () => {
    const vendor = await client.vendor.create({
      data: { companyId, name: "Asset vendor" },
    });
    const fields = {
      category: "Category",
      description: "Description",
      serialNumber: "SN",
      registrationNumber: "REG",
      makeModel: "Model",
      manufactureYear: 2026,
      location: "Office",
      usefulLifeMonths: 24,
      depreciationStartDate: "2026-10-09",
      assetLedgerId: cashId,
      accumulatedDepreciationLedgerId: cashId,
      depreciationExpenseLedgerId: expenseId,
      vendorId: vendor.id,
      hsnCode: "8471",
    };
    const row = await createAssetForActor(actor, { ...input(), ...fields });
    const cleared = await updateAssetForActor(
      actor,
      row.id,
      Object.fromEntries(Object.keys(fields).map((k) => [k, null])),
    );
    for (const key of Object.keys(fields))
      expect(cleared[key as keyof typeof cleared]).toBeNull();
    await expect(
      client.asset.update({
        where: { id: row.id },
        data: { openingQuantity: "1" },
      }),
    ).rejects.toThrow();
  });
  it("provides complete paginated asset search without crossing branch scope", async () => {
    const rows = Array.from({ length: 205 }, (_, i) => ({
      companyId,
      branchId: branchA,
      assetNumber: `PAGE-${i}`,
      name: `Long fixture ${String(i).padStart(3, "0")}`,
      assetType: "TOOL" as const,
      purchaseDate: new Date("2026-10-09"),
      purchaseValue: "5",
      createdById: userId,
    }));
    await client.asset.createMany({ data: rows });
    const first = await listAssetsForActor(actor, {
      q: "Long fixture",
      limit: 100,
    });
    expect(first.items).toHaveLength(100);
    expect(first.hasMore).toBe(true);
    const last = await listAssetsForActor(actor, {
      q: "Long fixture",
      offset: 200,
      limit: 100,
    });
    expect(last.items).toHaveLength(5);
    expect(last.hasMore).toBe(false);
    const selected = {
      ...actor,
      branchAccessScope: "SELECTED_BRANCHES" as const,
      branchIds: [branchB],
    };
    expect(
      (await listAssetsForActor(selected, { q: "Long fixture" })).items,
    ).toHaveLength(0);
    expect(
      (await listAssetsForActor(actor, { q: "Long fixture 204" })).items,
    ).toHaveLength(1);
    await expect(
      listAssetsForActor(actor, { status: "FORGED" }),
    ).rejects.toThrow();
    const detail = await getAssetForActor(actor, first.items[0].id);
    expect(detail.people.find((x) => x.id === userId)?.name).toBe("Test admin");
    expect(detail.asset.assetNumber).toBe(first.items[0].assetNumber);
  });
  it("retains rejection reason and actor/time and denies non-admin approval", async () => {
    await client.accountSettings.update({
      where: { companyId },
      data: { expenseApprovalRequired: true, expenseApprovalThreshold: "0" },
    });
    const request = {
      branchId: branchA,
      categoryId,
      moneyAccountId: moneyId,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "25",
    };
    const row = await createExpenseForActor(actor, request);
    await transitionExpenseForActor(actor, row.id, "PENDING_APPROVAL");
    await expect(
      transitionExpenseForActor(
        { ...actor, accountRole: "ACCOUNTANT" },
        row.id,
        "REJECTED",
        "Denied",
      ),
    ).rejects.toThrow();
    await expect(
      transitionExpenseForActor(actor, row.id, "REJECTED", " "),
    ).rejects.toThrow();
    expect(
      (
        await client.expenseTransaction.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).status,
    ).toBe("PENDING_APPROVAL");
    await transitionExpenseForActor(
      actor,
      row.id,
      "REJECTED",
      "Receipt does not match claim",
    );
    const detail = await getExpenseForActor(actor, row.id),
      event = detail.history.find((h) => h.eventType === "EXPENSE_REJECTED");
    expect(event).toMatchObject({
      actorUserId: userId,
      metadata: { reason: "Receipt does not match claim" },
    });
    expect(event?.createdAt).toBeInstanceOf(Date);
    expect(detail.category?.name).toBeTruthy();
    expect(detail.capabilities.edit).toBe(false);
    await client.accountSettings.update({
      where: { companyId },
      data: { expenseApprovalRequired: false },
    });
  });
  it("edits creator drafts atomically with audit and rejects terminal and foreign edits", async () => {
    const request = {
      branchId: branchA,
      categoryId,
      moneyAccountId: moneyId,
      type: "OFFICE_EXPENSE",
      transactionDate: "2026-10-09",
      taxableAmount: "25",
    };
    const row = await createExpenseForActor(actor, request);
    await rejectAudit("EXPENSE_DRAFT_UPDATED", async () => {
      await expect(
        updateExpenseForActor(actor, row.id, {
          ...request,
          taxableAmount: "30",
        }),
      ).rejects.toThrow();
    });
    expect(
      (
        await client.expenseTransaction.findUniqueOrThrow({
          where: { id: row.id },
        })
      ).totalAmount.toFixed(2),
    ).toBe("25.00");
    await updateExpenseForActor(actor, row.id, {
      ...request,
      taxableAmount: "30",
    });
    expect(
      (await getExpenseForActor(actor, row.id)).history.some(
        (h) => h.eventType === "EXPENSE_DRAFT_UPDATED",
      ),
    ).toBe(true);
    await expect(
      updateExpenseForActor({ ...actor, id: randomUUID() }, row.id, request),
    ).rejects.toThrow("EXPENSE_NOT_EDITABLE");
    await transitionExpenseForActor(actor, row.id, "CANCELLED");
    await expect(
      updateExpenseForActor(actor, row.id, request),
    ).rejects.toThrow();
  });
  it("rejects duplicate categories without changing existing mappings or audit history", async () => {
    const input = {
      name: "Duplicate category",
      scope: "EXPENSE",
      defaultLedgerAccountId: expenseId,
    };
    const row = await saveExpenseCategoryForActor(actor, input);
    const auditCount = await client.accountOperationalAudit.count({
      where: { companyId, entityId: row!.id },
    });
    await expect(saveExpenseCategoryForActor(actor, input)).rejects.toThrow(
      "EXPENSE_CATEGORY_NAME_EXISTS",
    );
    expect(
      await client.expenseCategory.count({
        where: { companyId, name: input.name },
      }),
    ).toBe(1);
    expect(
      await client.accountOperationalAudit.count({
        where: { companyId, entityId: row!.id },
      }),
    ).toBe(auditCount);
  });
  it("posts multi-line journals once across repeated responses and refuses altered retry content", async () => {
    const request = {
      financialYearId: fyId,
      branchId: branchA,
      entryDate: "2026-10-09",
      sourceType: "MANUAL_JOURNAL",
      sourceId: randomUUID(),
      postingPurpose: "PRIMARY",
      lines: [
        { ledgerAccountId: cashId, debit: "100", credit: "0" },
        { ledgerAccountId: incomeId, debit: "0", credit: "60" },
        { ledgerAccountId: expenseId, debit: "0", credit: "40" },
      ],
    };
    const [a, b] = await Promise.all([
      postJournalForActor(actor, request),
      postJournalForActor(actor, request),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await client.journalEntry.count({
        where: { companyId, sourceId: request.sourceId },
      }),
    ).toBe(1);
    await expect(
      postJournalForActor(actor, { ...request, reference: "changed" }),
    ).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
    await expect(
      postJournalForActor(
        {
          ...actor,
          branchAccessScope: "SELECTED_BRANCHES",
          branchIds: [branchB],
        },
        request,
      ),
    ).rejects.toThrow("INVALID_BRANCH");
    await setPeriodLockForActor(actor, {
      financialYearId: fyId,
      lockedThrough: "2026-10-09",
      reason: "Approved close",
    });
    expect((await postJournalForActor(actor, request)).id).toBe(a.id);
    await expect(
      setPeriodLockForActor(actor, {
        financialYearId: fyId,
        lockedThrough: null,
        reason: "Clear attempt",
      }),
    ).rejects.toThrow("PERIOD_UNLOCK_NOT_SUPPORTED");
    await expect(
      setPeriodLockForActor(actor, {
        financialYearId: fyId,
        lockedThrough: "2026-10-08",
        reason: "Backdate attempt",
      }),
    ).rejects.toThrow();
    await expect(
      postJournalForActor(actor, { ...request, sourceId: randomUUID() }),
    ).rejects.toThrow("PERIOD_LOCKED");
  });
  it("discovers older journals beyond 100 with stable scoped history pages", async () => {
    for (let i = 0; i < 105; i++)
      await postJournalForActor(actor, {
        financialYearId: fyId,
        branchId: branchA,
        entryDate: "2026-10-10",
        sourceType: "MANUAL_JOURNAL",
        sourceId: randomUUID(),
        reference: "history-fixture",
        lines: [
          { ledgerAccountId: cashId, debit: "1", credit: "0" },
          { ledgerAccountId: incomeId, debit: "0", credit: "1" },
        ],
      });
    const pages = await Promise.all(
      [1, 2, 3].map((page) =>
        journalHistoryForActor(actor, { q: "history-fixture", page }),
      ),
    );
    expect(pages.map((p) => p.items.length)).toEqual([50, 50, 5]);
    expect(pages[2].hasMore).toBe(false);
    expect(new Set(pages.flatMap((p) => p.items.map((x) => x.id))).size).toBe(
      105,
    );
    expect(
      (
        await journalHistoryForActor(
          {
            ...actor,
            branchAccessScope: "SELECTED_BRANCHES",
            branchIds: [branchB],
          },
          { q: "history-fixture" },
        )
      ).items,
    ).toHaveLength(0);
    await expect(
      journalHistoryForActor(actor, { branchId: randomUUID() }),
    ).rejects.toThrow("INVALID_BRANCH");
    await expect(
      journalHistoryForActor(actor, { from: "2026-10-10", to: "2026-10-09" }),
    ).rejects.toThrow("INVALID_DATE_RANGE");
  }, 30000);
  it("enforces module OFF without deleting historical assets", async () => {
    const before = await client.asset.count({ where: { companyId } });
    await client.accountSettings.update({
      where: { companyId },
      data: { enabledModules: [] },
    });
    await expect(createAssetForActor(actor, input())).rejects.toThrow(
      "MODULE_DISABLED:ASSETS",
    );
    expect(await client.asset.count({ where: { companyId } })).toBe(before);
  });
});

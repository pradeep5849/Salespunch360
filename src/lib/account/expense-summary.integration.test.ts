import { PrismaClient, Prisma } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import {
  expenseSummarySql,
  expenseSummaryResult,
  type ExpenseSummaryRow,
  type ExpenseSummaryScope,
  type ExpenseSummaryFilters,
} from "./expense-summary";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const db = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },
});
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const company = id(1),
  branch = id(2),
  otherBranch = id(3),
  category = id(4),
  incomeCategory = id(5),
  project = id(6);
afterAll(async () => db.$disconnect());
async function summary(
  scope: ExpenseSummaryScope,
  filters: ExpenseSummaryFilters = {},
) {
  return db.$transaction(async (tx) => {
    // Temporary tables isolate aggregate-query tests from all persisted company data.
    for (const sql of [
      'CREATE TEMP TABLE expense_transactions (id uuid, "companyId" uuid, "branchId" uuid, "projectId" uuid, "categoryId" uuid, type text, status text, "transactionNumber" text, reference text, "journalEntryId" uuid) ON COMMIT DROP',
      'CREATE TEMP TABLE journal_entries (id uuid, "companyId" uuid, "branchId" uuid, status text, "reversalOfId" uuid) ON COMMIT DROP',
      'CREATE TEMP TABLE journal_lines ("companyId" uuid, "journalEntryId" uuid, "ledgerAccountId" uuid, debit numeric(18,2), credit numeric(18,2)) ON COMMIT DROP',
      'CREATE TEMP TABLE ledger_accounts (id uuid, "companyId" uuid, "accountClass" text) ON COMMIT DROP',
      'CREATE TEMP TABLE expense_categories (id uuid, "companyId" uuid, name text, "isActive" boolean) ON COMMIT DROP',
    ])
      await tx.$executeRawUnsafe(sql);
    await tx.$executeRaw`INSERT INTO expense_categories VALUES (${category}::uuid,${company}::uuid,'Inactive travel',false),(${incomeCategory}::uuid,${company}::uuid,'Other income',true)`;
    await tx.$executeRaw`INSERT INTO ledger_accounts VALUES (${id(10)}::uuid,${company}::uuid,'EXPENSE'),(${id(11)}::uuid,${company}::uuid,'INCOME'),(${id(12)}::uuid,${company}::uuid,'ASSET'),(${id(13)}::uuid,${company}::uuid,'LIABILITY')`;
    const fixture = [
      {
        n: 20,
        cat: category,
        b: branch,
        type: "OFFICE_EXPENSE",
        status: "POSTED",
        debit: "10.10",
        credit: "0",
        ledger: id(10),
        ref: "literal%_target",
      },
      {
        n: 21,
        cat: category,
        b: branch,
        type: "PROJECT_EXPENSE",
        status: "REVERSED",
        debit: "20.20",
        credit: "0",
        ledger: id(10),
        ref: "reversed",
      },
      {
        n: 22,
        cat: incomeCategory,
        b: branch,
        type: "OTHER_INCOME",
        status: "POSTED",
        debit: "0",
        credit: "30.30",
        ledger: id(11),
        ref: "income",
      },
      {
        n: 23,
        cat: category,
        b: otherBranch,
        type: "OFFICE_EXPENSE",
        status: "POSTED",
        debit: "99.99",
        credit: "0",
        ledger: id(10),
        ref: "other branch",
      },
      {
        n: 24,
        cat: category,
        b: branch,
        type: "OFFICE_EXPENSE",
        status: "DRAFT",
        debit: "100",
        credit: "0",
        ledger: id(10),
        ref: "draft",
      },
    ];
    for (const f of fixture) {
      await tx.$executeRaw`INSERT INTO expense_transactions VALUES (${id(f.n)}::uuid,${company}::uuid,${f.b}::uuid,${project}::uuid,${f.cat}::uuid,${f.type},${f.status},${`E-${f.n}`},${f.ref},${id(f.n + 100)}::uuid)`;
      await tx.$executeRaw`INSERT INTO journal_entries VALUES (${id(f.n + 100)}::uuid,${company}::uuid,${f.b}::uuid,${f.status},NULL)`;
      await tx.$executeRaw`INSERT INTO journal_lines VALUES (${company}::uuid,${id(f.n + 100)}::uuid,${f.ledger}::uuid,${new Prisma.Decimal(f.debit)},${new Prisma.Decimal(f.credit)})`;
    }
    await tx.$executeRaw`INSERT INTO journal_entries VALUES (${id(150)}::uuid,${company}::uuid,${branch}::uuid,'POSTED',${id(121)}::uuid)`;
    await tx.$executeRaw`INSERT INTO journal_lines VALUES (${company}::uuid,${id(150)}::uuid,${id(10)}::uuid,0,20.20),(${company}::uuid,${id(120)}::uuid,${id(12)}::uuid,1000,0),(${company}::uuid,${id(120)}::uuid,${id(13)}::uuid,0,1000)`;
    await tx.$executeRawUnsafe(
      'ALTER TABLE expense_transactions ADD COLUMN "occurrenceKey" text',
    );
    await tx.$executeRaw`UPDATE expense_transactions SET "occurrenceKey"=${id(70) + ":2026-10-01"} WHERE id IN (${id(20)}::uuid,${id(23)}::uuid)`;
    return expenseSummaryResult(
      await tx.$queryRaw<ExpenseSummaryRow[]>(
        expenseSummarySql(scope, filters),
      ),
    );
  });
}
describe.skipIf(!url)(
  "A052 posted expense/income aggregate on isolated PostgreSQL",
  () => {
    it("reconciles all matching recurring bills without including other schedules or branches", async () => {
      expect(
        await summary(
          { companyId: company, branchIds: [branch] },
          { templateId: id(70) },
        ),
      ).toMatchObject({ expense: "10.10", income: "0.00" });
      expect(
        await summary({ companyId: company }, { templateId: id(71) }),
      ).toMatchObject({ expense: "0.00", income: "0.00" });
    });
    it("reconciles exact P&L including reversal while excluding draft, tax assets and loan principal", async () => {
      const result = await summary({ companyId: company, branchIds: [branch] });
      expect(result).toMatchObject({
        expense: "10.10",
        income: "30.30",
        period: "ALL_POSTED_HISTORY",
      });
      expect(
        result.categories.find((r) => r.categoryId === category),
      ).toMatchObject({ isActive: false, expense: "10.10" });
    });
    it("applies company and branch isolation with zero for an empty scope", async () => {
      expect(await summary({ companyId: id(99) })).toMatchObject({
        expense: "0.00",
        income: "0.00",
        categories: [],
      });
      expect(
        await summary({ companyId: company, branchIds: [] }),
      ).toMatchObject({ expense: "0.00", income: "0.00" });
      expect(
        await summary({ companyId: company, branchIds: [otherBranch] }),
      ).toMatchObject({ expense: "99.99", income: "0.00" });
    });
    it("preserves project-manager project and expense-type scope", async () => {
      expect(
        await summary({
          companyId: company,
          projectIds: [project],
          types: ["PROJECT_EXPENSE", "REIMBURSEMENT"],
        }),
      ).toMatchObject({ expense: "0.00", income: "0.00" });
      expect(
        await summary({ companyId: company, projectIds: [] }),
      ).toMatchObject({ expense: "0.00", income: "0.00" });
    });
    it("filters category, lifecycle and literal wildcard search without recognizing drafts", async () => {
      expect(
        await summary({ companyId: company }, { status: "DRAFT" }),
      ).toMatchObject({ expense: "0.00", income: "0.00" });
      expect(
        await summary({ companyId: company }, { categoryId: incomeCategory }),
      ).toMatchObject({ expense: "0.00", income: "30.30" });
      expect(await summary({ companyId: company }, { q: "%_" })).toMatchObject({
        expense: "10.10",
        income: "0.00",
      });
      expect(
        await summary({ companyId: company }, { categorySearch: "Inactive" }),
      ).toMatchObject({ expense: "110.09", income: "0.00" });
    });
  },
);

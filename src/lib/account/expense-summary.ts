import { Prisma } from "@prisma/client";

export type ExpenseSummaryScope = {
  companyId: string;
  branchIds?: string[];
  projectIds?: string[];
  types?: string[];
};
export type ExpenseSummaryFilters = {
  branchId?: string;
  categoryId?: string;
  status?: string;
  type?: string;
  q?: string;
  categorySearch?: string;
};
const literalContains = (value: string) =>
  `%${value.replace(/[\\%_]/g, "\\$&")}%`;

/** Aggregate the effective P&L lines, including originals and their reversals.
 * Input scopes are resolved by the permission-enforcing expense service.
 * No transaction gross amount, tax asset or loan principal enters these totals.
 */
export function expenseSummarySql(
  scope: ExpenseSummaryScope,
  filters: ExpenseSummaryFilters,
) {
  const conditions = [Prisma.sql`e."companyId" = ${scope.companyId}::uuid`];
  if (scope.branchIds) {
    conditions.push(
      scope.branchIds.length
        ? Prisma.sql`e."branchId" IN (${Prisma.join(scope.branchIds.map((id) => Prisma.sql`${id}::uuid`))}) AND j."branchId" IN (${Prisma.join(scope.branchIds.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql`FALSE`,
    );
  }
  if (scope.projectIds)
    conditions.push(
      scope.projectIds.length
        ? Prisma.sql`e."projectId" IN (${Prisma.join(scope.projectIds.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql`FALSE`,
    );
  if (scope.types)
    conditions.push(
      scope.types.length
        ? Prisma.sql`e.type::text IN (${Prisma.join(scope.types)})`
        : Prisma.sql`FALSE`,
    );
  if (filters.branchId)
    conditions.push(
      Prisma.sql`e."branchId" = ${filters.branchId}::uuid AND j."branchId" = ${filters.branchId}::uuid`,
    );
  if (filters.categoryId)
    conditions.push(Prisma.sql`e."categoryId" = ${filters.categoryId}::uuid`);
  if (filters.status)
    conditions.push(Prisma.sql`e.status::text = ${filters.status}`);
  if (filters.type) conditions.push(Prisma.sql`e.type::text = ${filters.type}`);
  if (filters.q)
    conditions.push(
      Prisma.sql`(e."transactionNumber" ILIKE ${literalContains(filters.q)} OR e.reference ILIKE ${literalContains(filters.q)})`,
    );
  if (filters.categorySearch)
    conditions.push(
      Prisma.sql`c.name ILIKE ${literalContains(filters.categorySearch)}`,
    );
  return Prisma.sql`
    SELECT e."categoryId", c.name AS "categoryName", c."isActive",
      COALESCE(SUM(CASE WHEN a."accountClass"::text = 'EXPENSE' THEN l.debit-l.credit ELSE 0 END),0)::text AS expense,
      COALESCE(SUM(CASE WHEN a."accountClass"::text = 'INCOME' THEN l.credit-l.debit ELSE 0 END),0)::text AS income
    FROM expense_transactions e
    JOIN journal_entries j ON j."companyId" = e."companyId"
      AND j."branchId" = e."branchId"
      AND (j.id = e."journalEntryId" OR j."reversalOfId" = e."journalEntryId")
    JOIN journal_lines l ON l."companyId" = j."companyId" AND l."journalEntryId" = j.id
    JOIN ledger_accounts a ON a."companyId" = l."companyId" AND a.id = l."ledgerAccountId"
    JOIN expense_categories c ON c."companyId" = e."companyId" AND c.id = e."categoryId"
    WHERE ${Prisma.join(conditions, " AND ")}
      AND j.status::text IN ('POSTED','REVERSED')
      AND a."accountClass"::text IN ('EXPENSE','INCOME')
    GROUP BY e."categoryId", c.name, c."isActive"
    ORDER BY c.name, e."categoryId"`;
}
export type ExpenseSummaryRow = {
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  expense: string;
  income: string;
};
export function expenseSummaryResult(rows: ExpenseSummaryRow[]) {
  const sum = (field: "expense" | "income") =>
    rows
      .reduce((total, row) => total.add(row[field]), new Prisma.Decimal(0))
      .toFixed(2);
  return {
    period: "ALL_POSTED_HISTORY" as const,
    recognition:
      "Effective posted ledger amounts, including reversals; drafts are excluded." as const,
    expense: sum("expense"),
    income: sum("income"),
    categories: rows.map((row) => ({
      ...row,
      expense: new Prisma.Decimal(row.expense).toFixed(2),
      income: new Prisma.Decimal(row.income).toFixed(2),
    })),
  };
}

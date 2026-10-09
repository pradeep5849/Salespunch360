import { Prisma } from "@prisma/client";
import { enabledModulesForCompany, requireAccountModules } from "./modules";
import { db } from "@/lib/db";
import { assertAccountBranchContext } from "./branch-context";
import type {
  AccountBranchActor,
  AccountBranchContext,
} from "./branch-context";
import { documentOutstandingsBatch } from "./commercial";
import { profitAndLoss, type ReportLine } from "./financial-reports";
import {
  inventorySnapshotForActor,
  lowStockSnapshotForActor,
} from "./inventory";
import type { ProjectActor } from "./projects";
import { DASHBOARD_EXPENSE_TYPES } from "./dashboard-policy";
const D = Prisma.Decimal,
  Z = new D(0),
  sum = (v: Prisma.Decimal[]) => v.reduce((a, b) => a.add(b), Z);
export function dashboardExpenseSummary(
  total: Prisma.Decimal | null,
  groups: Array<{ categoryId: string; amount: Prisma.Decimal }>,
  names: Map<string, string>,
) {
  return {
    currentMonthExpenses: total ?? Z,
    expenseBreakdown: groups.slice(0, 5).map((row) => ({
      categoryId: row.categoryId,
      category: names.get(row.categoryId) ?? "Uncategorized",
      amount: row.amount,
    })),
  };
}
export async function accountBranchDashboard(
  actor: AccountBranchActor,
  context: AccountBranchContext,
  from: Date,
  to: Date,
  projection: "FULL" | "SUMMARY" = "FULL",
) {
  await assertAccountBranchContext(actor, context);
  const full = projection === "FULL";
  const branch =
      context.mode === "BRANCH" ? { branchId: context.branchId } : {},
    period = { issueDate: { gte: from, lte: to } },
    projectScope =
      actor.accountRole === "PROJECT_MANAGER"
        ? { projectManagerId: actor.id }
        : {};
  if (actor.accountRole === "PROJECT_MANAGER") {
    await requireAccountModules(actor, "PROJECTS");
    const p = await db.project.aggregate({
      where: { companyId: actor.companyId, ...branch, ...projectScope },
      _count: true,
      _sum: { projectValue: true },
    });
    return {
      projectOnly: true,
      projects: p._count,
      projectValue: p._sum.projectValue ?? Z,
      from,
      to,
      context,
    } as const;
  }
  const modules = await enabledModulesForCompany(actor.companyId!);
  const [
    sr,
    pr,
    rd,
    pd,
    expense,
    projects,
    warehouses,
    moneyAccounts,
    accounts,
    journalGroups,
    branches,
  ] = await Promise.all([
    full
      ? db.commercialDocument.groupBy({
          by: ["type"],
          where: {
            companyId: actor.companyId,
            status: "POSTED",
            type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
            ...branch,
            ...period,
          },
          _sum: { taxableTotal: true },
        })
      : Promise.resolve([]),
    full
      ? db.commercialDocument.groupBy({
          by: ["type"],
          where: {
            companyId: actor.companyId,
            status: "POSTED",
            type: { in: ["PURCHASE_BILL", "DEBIT_NOTE"] },
            ...branch,
            ...period,
          },
          _sum: { taxableTotal: true },
        })
      : Promise.resolve([]),
    full
      ? db.commercialDocument.findMany({
          where: {
            companyId: actor.companyId,
            status: "POSTED",
            type: "SALES_INVOICE",
            issueDate: { lte: to },
            ...branch,
          },
          select: { id: true, grandTotal: true, payableAmount: true },
        })
      : Promise.resolve([]),
    full
      ? db.commercialDocument.findMany({
          where: {
            companyId: actor.companyId,
            status: "POSTED",
            type: "PURCHASE_BILL",
            issueDate: { lte: to },
            ...branch,
          },
          select: { id: true, grandTotal: true, payableAmount: true },
        })
      : Promise.resolve([]),
    full
      ? db.expenseTransaction.aggregate({
          where: {
            companyId: actor.companyId,
            status: "POSTED",
            type: { in: [...DASHBOARD_EXPENSE_TYPES] },
            transactionDate: { gte: from, lte: to },
            ...branch,
          },
          _sum: { taxableAmount: true },
        })
      : Promise.resolve({ _sum: { taxableAmount: Z } }),
    full && modules.includes("PROJECTS")
      ? db.project.aggregate({
          where: {
            companyId: actor.companyId,
            ...branch,
            ...projectScope,
            status: { in: ["PLANNING", "ACTIVE", "ON_HOLD"] },
          },
          _count: true,
          _sum: { projectValue: true },
        })
      : Promise.resolve({ _count: 0, _sum: { projectValue: Z } }),
    full
      ? db.warehouse.count({
          where: { companyId: actor.companyId, isActive: true, ...branch },
        })
      : Promise.resolve(0),
    db.moneyAccount.findMany({
      where: {
        companyId: actor.companyId,
        ...(context.mode === "BRANCH"
          ? { OR: [{ branchId: context.branchId }, { branchId: null }] }
          : {}),
      },
      select: { ledgerAccountId: true, type: true },
    }),
    full
      ? db.ledgerAccount.findMany({
          where: {
            companyId: actor.companyId,
            accountClass: { in: ["INCOME", "EXPENSE"] },
          },
          select: { id: true, code: true, name: true, accountClass: true },
        })
      : Promise.resolve([]),
    full
      ? db.journalLine.groupBy({
          by: ["ledgerAccountId"],
          where: {
            companyId: actor.companyId,
            journalEntry: {
              status: { in: ["POSTED", "REVERSED"] },
              entryDate: { gte: from, lte: to },
              ...branch,
            },
          },
          _sum: { debit: true, credit: true },
        })
      : Promise.resolve([]),
    context.mode === "COMPANY"
      ? db.branch.findMany({
          where: { companyId: actor.companyId, isActive: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const [rm, pm, moneyLines] = await Promise.all([
      documentOutstandingsBatch(actor.companyId, rd),
      documentOutstandingsBatch(actor.companyId, pd),
      db.journalLine.groupBy({
        by: ["ledgerAccountId"],
        where: {
          companyId: actor.companyId,
          ledgerAccountId: { in: moneyAccounts.map((x) => x.ledgerAccountId) },
          journalEntry: {
            status: { in: ["POSTED", "REVERSED"] },
            entryDate: { lte: to },
            ...branch,
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]),
    sales = sum(
      sr.map((x) =>
        (x._sum.taxableTotal ?? Z).mul(x.type === "CREDIT_NOTE" ? -1 : 1),
      ),
    ),
    purchases = sum(
      pr.map((x) =>
        (x._sum.taxableTotal ?? Z).mul(x.type === "DEBIT_NOTE" ? -1 : 1),
      ),
    );
  const lines: ReportLine[] = accounts.map((a) => {
      const g = journalGroups.find((x) => x.ledgerAccountId === a.id);
      return {
        ledgerId: a.id,
        code: a.code,
        name: a.name,
        accountClass: a.accountClass,
        openingDebit: Z,
        openingCredit: Z,
        periodDebit: g?._sum.debit ?? Z,
        periodCredit: g?._sum.credit ?? Z,
      };
    }),
    pnl = profitAndLoss(lines),
    cashBank = sum(
      moneyLines.map((x) => new D(x._sum.debit ?? 0).sub(x._sum.credit ?? 0)),
    );
  const cmp =
    context.mode === "COMPANY"
      ? await Promise.all([
          db.commercialDocument.groupBy({
            by: ["branchId", "type"],
            where: {
              companyId: actor.companyId,
              status: "POSTED",
              type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
              ...period,
            },
            _sum: { taxableTotal: true },
          }),
          db.expenseTransaction.groupBy({
            by: ["branchId"],
            where: {
              companyId: actor.companyId,
              status: "POSTED",
              type: { in: [...DASHBOARD_EXPENSE_TYPES] },
              transactionDate: { gte: from, lte: to },
            },
            _sum: { taxableAmount: true },
          }),
        ])
      : null;
  const monthStart = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1),
    ),
    trendStart = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5, 1),
    ),
    previousStart = new Date(
      Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 1, 1),
    );
  const [
    trendRows,
    products,
    inventoryPositions,
    monthlyExpense,
    expenseGroups,
  ] = await Promise.all([
    db.commercialDocument.groupBy({
      by: ["issueDate", "type"],
      where: {
        companyId: actor.companyId,
        status: "POSTED",
        type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
        issueDate: { gte: trendStart, lte: to },
        ...branch,
      },
      _sum: { taxableTotal: true },
    }),
    db.accountProduct.findMany({
      where: {
        companyId: actor.companyId,
        isActive: true,
        trackInventory: true,
      },
      select: { id: true, lowStockThreshold: true },
    }),
    modules.includes("INVENTORY")
      ? inventorySnapshotForActor(
          {
            ...actor,
            branchAccessScope:
              context.mode === "BRANCH" ? "SELECTED_BRANCHES" : "ALL_BRANCHES",
            branchIds: context.mode === "BRANCH" ? [context.branchId] : [],
          } as ProjectActor,
          to,
        )
      : Promise.resolve([]),
    db.expenseTransaction.aggregate({
      where: {
        companyId: actor.companyId,
        status: "POSTED",
        type: { in: [...DASHBOARD_EXPENSE_TYPES] },
        transactionDate: { gte: monthStart, lte: to },
        ...branch,
      },
      _sum: { taxableAmount: true },
    }),
    db.expenseTransaction.groupBy({
      by: ["categoryId"],
      where: {
        companyId: actor.companyId,
        status: "POSTED",
        type: { in: [...DASHBOARD_EXPENSE_TYPES] },
        transactionDate: { gte: monthStart, lte: to },
        ...branch,
      },
      _sum: { taxableAmount: true },
      orderBy: { _sum: { taxableAmount: "desc" } },
      take: 5,
    }),
  ]);
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(
        Date.UTC(to.getUTCFullYear(), to.getUTCMonth() - 5 + i, 1),
      );
      return date.toISOString().slice(0, 7);
    }),
    trendMap = new Map(monthKeys.map((key) => [key, Z]));
  for (const row of trendRows) {
    const key = row.issueDate.toISOString().slice(0, 7);
    trendMap.set(
      key,
      (trendMap.get(key) ?? Z).add(
        (row._sum.taxableTotal ?? Z).mul(row.type === "CREDIT_NOTE" ? -1 : 1),
      ),
    );
  }
  const currentMonthSales =
      trendMap.get(monthStart.toISOString().slice(0, 7)) ?? Z,
    previousMonthSales =
      trendMap.get(previousStart.toISOString().slice(0, 7)) ?? Z,
    salesGrowthPercent = previousMonthSales.isZero()
      ? null
      : currentMonthSales
          .sub(previousMonthSales)
          .div(previousMonthSales.abs())
          .mul(100)
          .toDecimalPlaces(1);
  const lowStockPositions = modules.includes("INVENTORY")
    ? await lowStockSnapshotForActor(
        {
          ...actor,
          branchAccessScope:
            context.mode === "BRANCH" ? "SELECTED_BRANCHES" : "ALL_BRANCHES",
          branchIds: context.mode === "BRANCH" ? [context.branchId] : [],
        } as ProjectActor,
        to,
        inventoryPositions,
      )
    : [];
  const categories = await db.expenseCategory.findMany({
    where: {
      companyId: actor.companyId,
      id: { in: expenseGroups.map((row) => row.categoryId) },
    },
    select: { id: true, name: true },
  });
  const stockValue = modules.includes("INVENTORY")
    ? sum(inventoryPositions.map((row) => row.stockValue))
    : Z;
  const bankLedgerIds = new Set(
    moneyAccounts
      .filter((account) => account.type === "BANK")
      .map((account) => account.ledgerAccountId),
  );
  const bank = sum(
    moneyLines
      .filter((line) => bankLedgerIds.has(line.ledgerAccountId))
      .map((line) => new D(line._sum.debit ?? 0).sub(line._sum.credit ?? 0)),
  );
  const cash = cashBank.sub(bank);
  const categoryNames = new Map(
    categories.map((category) => [category.id, category.name]),
  );
  const expenseSummary = dashboardExpenseSummary(
    monthlyExpense._sum.taxableAmount,
    expenseGroups.map((row) => ({
      categoryId: row.categoryId,
      amount: row._sum.taxableAmount ?? Z,
    })),
    categoryNames,
  );
  return {
    projectOnly: false as const,
    context,
    from,
    to,
    sales,
    purchases,
    receivables: sum([...rm.values()]),
    payables: sum([...pm.values()]),
    expenses: expense._sum.taxableAmount ?? Z,
    ...expenseSummary,
    profit: pnl.profit,
    cashBank,
    cash,
    bank,
    projects: projects._count,
    projectValue: projects._sum.projectValue ?? Z,
    warehouses,
    stockValue,
    currentMonthSales,
    previousMonthSales,
    salesGrowthPercent,
    salesTrend: monthKeys.map((month) => ({
      month,
      total: trendMap.get(month) ?? Z,
    })),
    itemCount: products.length,
    lowStockItems: lowStockPositions.length,
    lowStockPreview: lowStockPositions.slice(0, 3).map((row) => ({
      productId: row.productId,
      warehouseId: row.warehouseId,
      name: row.product.name,
      warehouse: row.warehouse.name,
      quantity: row.quantity,
    })),
    branchComparison: cmp
      ? branches.map((b) => {
          const revenue = sum(
              cmp[0]
                .filter((x) => x.branchId === b.id)
                .map((x) =>
                  (x._sum.taxableTotal ?? Z).mul(
                    x.type === "CREDIT_NOTE" ? -1 : 1,
                  ),
                ),
            ),
            cost =
              cmp[1].find((x) => x.branchId === b.id)?._sum.taxableAmount ?? Z;
          return {
            id: b.id,
            name: b.name,
            sales: revenue,
            expenses: cost,
            operatingContribution: revenue.sub(cost),
          };
        })
      : [],
  };
}

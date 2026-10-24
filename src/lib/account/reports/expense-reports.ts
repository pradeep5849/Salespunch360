import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAccountModules } from "../modules";
import { postedJournalAt } from "../settlement-policy";
import { billedItemSchema } from "../expense-totals";
import type { FinancialReportContext, ReportResult } from "./service";
const D = Prisma.Decimal;
export const EXPENSE_REPORTS = ["expense-transactions", "expense-category", "expense-items"];
/** Read posted costs, including historical entries reversed after the requested cutoff. */
export async function expenseReport(name: string, c: FinancialReportContext): Promise<ReportResult> {
  await requireAccountModules(c.actor, "EXPENSES");
  const candidates = await db.expenseTransaction.findMany({
    where: {
      companyId: c.actor.companyId, ...c.branch,
      journalEntryId: { not: null },
      status: { in: ["POSTED", "REVERSED"] },
      type: { not: "OTHER_INCOME" },
      transactionDate: { gte: c.from, lte: c.to },
      ...(c.f.projectId ? { projectId: c.f.projectId } : {}),
    },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const journals = await db.journalEntry.findMany({
    where: { companyId: c.actor.companyId, ...c.branch, ...postedJournalAt(c.to), id: { in: candidates.flatMap(e => e.journalEntryId ? [e.journalEntryId] : []) } },
    select: { id: true },
  });
  const eligible = new Set(journals.map(j => j.id));
  const expenses = candidates.filter(e => e.journalEntryId && eligible.has(e.journalEntryId));
  const total = expenses.reduce((sum, expense) => sum.add(expense.totalAmount), new D(0));
  if (name === "expense-transactions") return {
    title: "Expense Transactions", columns: ["Date", "Document", "Type", "Description", "Amount"],
    rows: expenses.map(e => [e.transactionDate.toISOString().slice(0, 10), e.transactionNumber, e.type.replaceAll("_", " "), e.notes || e.reference || e.transactionNumber, e.totalAmount.toString()]),
    rowLinks: expenses.map(e => `/workspace/account/expenses/${e.id}`),
    totals: ["Total expense", "", "", "", total.toString()],
    summary: [{ label: "No. of Transactions", value: String(expenses.length), money: false }, { label: "Total Expense", value: total.toString(), money: true }],
    note: "Posted expense amounts including tax and charges. Drafts and other income are excluded; approval review does not post costs twice. Payment settlement is separate from expense recognition.",
  };
  if (name === "expense-category") {
    const categories = await db.expenseCategory.findMany({ where: { companyId: c.actor.companyId, id: { in: [...new Set(expenses.map(e => e.categoryId))] } }, select: { id: true, name: true } });
    const names = new Map(categories.map(category => [category.id, category.name]));
    const grouped = new Map<string, Prisma.Decimal>();
    for (const expense of expenses) grouped.set(expense.categoryId, (grouped.get(expense.categoryId) ?? new D(0)).add(expense.totalAmount));
    return { title: "Expense Category Report", columns: ["Expense Category", "Amount"], rows: [...grouped].map(([id, amount]) => [names.get(id) ?? "Unavailable category", amount.toString()]).sort((a,b) => a[0].localeCompare(b[0])), totals: ["Total Expense", total.toString()], note: "Posted costs including tax and charges, grouped by category. Other income and drafts are excluded." };
  }
  const grouped = new Map<string, { name: string; quantity: Prisma.Decimal; amount: Prisma.Decimal }>();
  let malformed = 0;
  for (const expense of expenses) {
    if (!Array.isArray(expense.billedItems)) { if (expense.billedItems !== null) malformed++; continue; }
    for (const raw of expense.billedItems) {
      const parsed = billedItemSchema.safeParse(raw);
      if (!parsed.success) { malformed++; continue; }
      const line = parsed.data, key = line.name.toLocaleLowerCase(), current = grouped.get(key) ?? { name: line.name, quantity: new D(0), amount: new D(0) };
      current.quantity = current.quantity.add(line.quantity);
      current.amount = current.amount.add(new D(line.quantity).mul(line.rate).toDecimalPlaces(2));
      grouped.set(key, current);
    }
  }
  const rows = [...grouped.values()].sort((a,b) => a.name.localeCompare(b.name));
  return { title: "Expense Item Report", columns: ["Expense Item", "Quantity", "Amount"], rows: rows.map(row => [row.name, row.quantity.toString(), row.amount.toString()]), totals: ["Total Item Expense", "", rows.reduce((sum,row) => sum.add(row.amount), new D(0)).toString()], note: `Billed item quantity × rate, rounded per line. Invoice tax, additional charges, round-off and expenses without billed items are excluded; this is not the total expense ledger.${malformed ? ` ${malformed} malformed historical item record(s) could not be included.` : ""}` };
}

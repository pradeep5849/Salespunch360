import { listOpeningOutstandings } from "../opening-balances";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import {
  aging,
  balanceSheet,
  cashFlow,
  profitAndLoss,
  runningLedger,
  trialBalance,
  type ReportLine,
} from "../financial-reports";
import { gstReport } from "../tax";
import { itemProfitability } from "../inventory";
import {
  authorizedProjectBranchIds,
  projectRecordScope,
  type ProjectActor,
} from "../projects";
import { loadProjectCostingForActor } from "../project-costing";
import { documentOutstandingsBatch } from "../commercial";
const D = Prisma.Decimal,
  Z = new D(0),
  filterSchema = z
    .object({
      from: z.coerce.date().optional(),
      to: z.coerce.date().optional(),
      asOf: z.coerce.date().optional(),
      branchId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      customerId: z.string().uuid().optional(),
      vendorId: z.string().uuid().optional(),
      productId: z.string().uuid().optional(),
      ledgerId: z.string().uuid().optional(),
    })
    .strict();
export type ReportFilter = z.infer<typeof filterSchema>;
export type ReportResult = {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  totals?: Array<string | number>;
  note?: string;
};
async function context(
  raw: unknown,
  projectOnly = false,
  provided?: ProjectActor,
) {
  const actor =
    provided ?? ((await requirePermission("ACCOUNT_REPORTS")) as ProjectActor);
  if (
    !["ACCOUNT_ADMIN", "ACCOUNTANT", "PROJECT_MANAGER"].includes(
      actor.accountRole ?? "",
    )
  )
    throw new AuthorizationError();
  const f = filterSchema.parse(raw),
    from = f.from ?? new Date(Date.UTC(new Date().getUTCFullYear(), 3, 1)),
    to = f.to ?? f.asOf ?? new Date();
  if (to < from) throw new Error("INVALID_DATE_RANGE");
  if (actor.accountRole === "PROJECT_MANAGER" && !projectOnly)
    throw new AuthorizationError();
  if (
    f.branchId &&
    actor.branchAccessScope === "SELECTED_BRANCHES" &&
    !actor.branchIds?.includes(f.branchId)
  )
    throw new AuthorizationError();
  if (
    f.branchId &&
    !(await db.branch.findFirst({
      where: { id: f.branchId, companyId: actor.companyId, isActive: true },
    }))
  )
    throw new AuthorizationError();
  return {
    actor,
    f,
    from,
    to,
    branch: f.branchId
      ? { branchId: f.branchId }
      : actor.branchAccessScope === "SELECTED_BRANCHES"
        ? { branchId: { in: actor.branchIds ?? [] } }
        : {},
  };
}
async function ledgerData(raw: unknown, actor?: ProjectActor) {
  const c = await context(raw, false, actor),
    accounts = await db.ledgerAccount.findMany({
      where: { companyId: c.actor.companyId, isActive: true },
      orderBy: { code: "asc" },
    }),
    lines = await db.journalLine.findMany({
      where: {
        companyId: c.actor.companyId,
        journalEntry: {
          status: "POSTED",
          entryDate: { lte: c.to },
          ...c.branch,
        },
      },
      select: {
        ledgerAccountId: true,
        debit: true,
        credit: true,
        journalEntry: { select: { entryDate: true } },
      },
    }),
    mapped: ReportLine[] = accounts.map((a) => {
      const own = lines.filter((x) => x.ledgerAccountId === a.id),
        opening = own.filter((x) => x.journalEntry.entryDate < c.from),
        period = own.filter((x) => x.journalEntry.entryDate >= c.from);
      return {
        ledgerId: a.id,
        code: a.code,
        name: a.name,
        accountClass: a.accountClass,
        openingDebit: opening.reduce((n, x) => n.add(x.debit), Z),
        openingCredit: opening.reduce((n, x) => n.add(x.credit), Z),
        periodDebit: period.reduce((n, x) => n.add(x.debit), Z),
        periodCredit: period.reduce((n, x) => n.add(x.credit), Z),
      };
    });
  return { ...c, lines: mapped };
}
const n = (x: Prisma.Decimal) => x.toFixed(2);
export function vendorDocumentAmount(document: {
  grandTotal: Prisma.Decimal;
  payableAmount: Prisma.Decimal | null;
}) {
  return document.payableAmount ?? document.grandTotal;
}
export async function runFinancialReportForActor(
  actor: ProjectActor,
  name: string,
  raw: unknown,
): Promise<ReportResult> {
  if (name === "projects" || name === "budget-vs-actual")
    return projectReport(name, raw, actor);
  if (name === "tax") {
    const c = await context(raw, false, actor),
      r = await gstReport({ from: c.from, to: c.to, branchId: c.f.branchId });
    return {
      title: "GST / Tax",
      columns: [
        "Date",
        "Document",
        "Type",
        "Party",
        "Taxable",
        "CGST",
        "SGST",
        "IGST",
        "CESS",
        "TDS",
        "TCS",
      ],
      rows: r.rows.map((x) => [
        x.date.toISOString().slice(0, 10),
        x.number,
        x.type,
        x.party,
        n(x.taxable),
        n(x.cgst),
        n(x.sgst),
        n(x.igst),
        n(x.cess),
        n(x.tds),
        n(x.tcs),
      ]),
    };
  }
  if (
    ["profit-loss", "balance-sheet", "trial-balance", "branches"].includes(name)
  ) {
    const d = await ledgerData(raw, actor);
    if (name === "profit-loss" || name === "branches") {
      const p = profitAndLoss(d.lines);
      return {
        title: name === "branches" ? "Branch Profit & Loss" : "Profit & Loss",
        columns: ["Section", "Amount"],
        rows: [
          ["Income", n(p.income)],
          ["Expenses / COGS", n(p.expenses)],
          ["Profit", n(p.profit)],
        ],
      };
    }
    if (name === "balance-sheet") {
      const b = balanceSheet(d.lines);
      return {
        title: "Balance Sheet",
        columns: ["Section", "Amount"],
        rows: [
          ["Assets", n(b.assets)],
          ["Liabilities", n(b.liabilities)],
          ["Equity", n(b.equity)],
          ["Current Earnings", n(b.currentEarnings)],
          ["Difference", n(b.difference)],
        ],
      };
    }
    const t = trialBalance(d.lines);
    return {
      title: "Trial Balance",
      columns: [
        "Code",
        "Ledger",
        "Opening Dr",
        "Opening Cr",
        "Period Dr",
        "Period Cr",
        "Closing Dr",
        "Closing Cr",
      ],
      rows: t.rows.map((x) => [
        x.code,
        x.name,
        n(x.openingDebit),
        n(x.openingCredit),
        n(x.periodDebit),
        n(x.periodCredit),
        n(x.closingDebit),
        n(x.closingCredit),
      ]),
      totals: [
        "",
        "Totals",
        n(t.totals.openingDebit),
        n(t.totals.openingCredit),
        n(t.totals.periodDebit),
        n(t.totals.periodCredit),
        n(t.totals.closingDebit),
        n(t.totals.closingCredit),
      ],
    };
  }
  const c = await context(raw, false, actor);
  if (name === "general-ledger") {
    if (!c.f.ledgerId) throw new Error("LEDGER_REQUIRED");
    if (
      !(await db.ledgerAccount.findFirst({
        where: { id: c.f.ledgerId, companyId: c.actor.companyId },
      }))
    )
      throw new AuthorizationError();
    const openingRows = await db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: c.f.ledgerId,
          journalEntry: {
            status: "POSTED",
            entryDate: { lt: c.from },
            ...c.branch,
          },
        },
      }),
      opening = openingRows.reduce((v, x) => v.add(x.debit).sub(x.credit), Z),
      rows = await db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: c.f.ledgerId,
          journalEntry: {
            status: "POSTED",
            entryDate: { gte: c.from, lte: c.to },
            ...c.branch,
          },
        },
        include: { journalEntry: true },
        orderBy: { journalEntry: { entryDate: "asc" } },
      }),
      running = runningLedger(opening, rows);
    return {
      title: "General Ledger",
      columns: [
        "Date",
        "Source",
        "Reference",
        "Narration",
        "Debit",
        "Credit",
        "Balance",
      ],
      rows: running.map((x) => [
        x.journalEntry.entryDate.toISOString().slice(0, 10),
        x.journalEntry.sourceType,
        x.journalEntry.reference ?? "",
        x.journalEntry.narration ?? "",
        n(x.debit),
        n(x.credit),
        n(x.runningBalance),
      ]),
    };
  }
  if (name === "cash-flow") {
    const rows = await db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          journalEntry: {
            status: "POSTED",
            entryDate: { gte: c.from, lte: c.to },
            ...c.branch,
          },
          ledgerAccount: { systemKey: { in: ["CASH", "BANK"] } },
        },
        include: { journalEntry: true },
      }),
      r = cashFlow(
        rows.map((x) => ({
          sourceType: x.journalEntry.sourceType,
          amount: x.debit.gt(0) ? x.debit : x.credit,
          direction: x.debit.gt(0) ? ("IN" as const) : ("OUT" as const),
        })),
      );
    return {
      title: "Cash Flow",
      columns: ["Activity", "Amount"],
      rows: [
        ["Operating", n(r.operating)],
        ["Investing", n(r.investing)],
        ["Financing", n(r.financing)],
        ["Net", n(r.net)],
      ],
    };
  }
  if (["receivable-aging", "payable-aging"].includes(name)) {
    const sales = name === "receivable-aging",
      docs = await db.commercialDocument.findMany({
        where: {
          companyId: c.actor.companyId,
          status: "POSTED",
          type: sales ? "SALES_INVOICE" : "PURCHASE_BILL",
          issueDate: { lte: c.to },
          ...c.branch,
        },
        orderBy: { issueDate: "asc" },
      }),
      outstanding = await documentOutstandingsBatch(c.actor.companyId!, docs),
      open = docs.filter((x) => (outstanding.get(x.id) ?? Z).gt(0)),
      opening = await listOpeningOutstandings({
        companyId: c.actor.companyId!,
        partyType: sales ? "CUSTOMER" : "VENDOR",
        branchIds:
          c.actor.branchAccessScope === "SELECTED_BRANCHES"
            ? (c.actor.branchIds ?? [])
            : c.f.branchId
              ? [c.f.branchId]
              : undefined,
        asOf: c.to,
      }),
      agingRows = [
        ...open.map((x) => ({
          id: x.id,
          partyId: x.partyId,
          dueDate: x.dueDate,
          issueDate: x.issueDate,
          outstanding: outstanding.get(x.id)!,
        })),
        ...opening.map((x) => ({
          id: x.id,
          partyId: x.partyId,
          dueDate: null,
          issueDate: x.effectiveDate,
          outstanding: x.outstanding,
        })),
      ],
      b = aging(agingRows, c.to);
    return {
      title: sales ? "Receivable Aging" : "Payable Aging",
      columns: ["Document", "Party", "Due", "Outstanding"],
      rows: [
        ...open.map((x) => [
          x.documentNumber,
          x.partyName,
          (x.dueDate ?? x.issueDate).toISOString().slice(0, 10),
          n(outstanding.get(x.id)!),
        ]),
        ...opening.map((x) => [
          "Opening balance",
          x.partyName,
          x.effectiveDate.toISOString().slice(0, 10),
          n(x.outstanding),
        ]),
      ],
      totals: [
        "Buckets",
        `Current ${n(b.current)}`,
        `1-30 ${n(b["1_30"])}`,
        `31-60 ${n(b["31_60"])}`,
        `61-90 ${n(b["61_90"])}`,
        `90+ ${n(b["90_plus"])}`,
      ],
    };
  }
  if (["customer-ledger", "vendor-ledger"].includes(name)) {
    const customer = name === "customer-ledger",
      partyId = customer ? c.f.customerId : c.f.vendorId;
    if (!partyId)
      throw new Error(customer ? "CUSTOMER_REQUIRED" : "VENDOR_REQUIRED");
    const docs = await db.commercialDocument.findMany({
        where: {
          companyId: c.actor.companyId,
          ...(customer ? { customerId: partyId } : { vendorId: partyId }),
          status: "POSTED",
          issueDate: { gte: c.from, lte: c.to },
          ...c.branch,
        },
        orderBy: { issueDate: "asc" },
      }),
      settlements = await db.accountSettlement.findMany({
        where: {
          companyId: c.actor.companyId,
          ...(customer ? { customerId: partyId } : { vendorId: partyId }),
          transactionDate: { gte: c.from, lte: c.to },
          ...c.branch,
        },
      }),
      entries = [
        ...docs.map((x) => {
          const value = customer ? x.grandTotal : vendorDocumentAmount(x),
            debit =
              (customer && x.type === "SALES_INVOICE") ||
              (!customer && x.type === "DEBIT_NOTE")
                ? value
                : Z,
            credit =
              (customer && x.type === "CREDIT_NOTE") ||
              (!customer && x.type === "PURCHASE_BILL")
                ? value
                : Z;
          return {
            date: x.issueDate,
            source: x.type,
            reference: x.documentNumber,
            debit,
            credit,
          };
        }),
        ...settlements.map((x) => ({
          date: x.transactionDate,
          source: x.type,
          reference: x.settlementNumber,
          debit: customer ? Z : x.amount,
          credit: customer ? x.amount : Z,
        })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime()),
      rows = entries.reduce<Array<Array<string | number>>>((result, x) => {
        const prior = result.length ? new D(result[result.length - 1][5]) : Z,
          balance = customer
            ? prior.add(x.debit).sub(x.credit)
            : prior.add(x.credit).sub(x.debit);
        result.push([
          x.date.toISOString().slice(0, 10),
          x.source,
          x.reference,
          n(x.debit),
          n(x.credit),
          n(balance),
        ]);
        return result;
      }, []);
    return {
      title: customer ? "Customer Ledger" : "Vendor Ledger",
      columns: ["Date", "Source", "Reference", "Debit", "Credit", "Balance"],
      rows,
    };
  }
  if (name === "cash-bank") {
    const accounts = await db.moneyAccount.findMany({
        where: {
          companyId: c.actor.companyId,
          isActive: true,
          ...(c.f.branchId
            ? { OR: [{ branchId: null }, { branchId: c.f.branchId }] }
            : {}),
        },
      }),
      lines = await db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: { in: accounts.map((x) => x.ledgerAccountId) },
          journalEntry: {
            status: "POSTED",
            entryDate: { lte: c.to },
            ...c.branch,
          },
        },
        include: { journalEntry: true },
      });
    return {
      title: "Cash / Bank Book",
      columns: ["Account", "Opening", "Receipts", "Payments", "Closing"],
      rows: accounts.map((a) => {
        const own = lines.filter(
            (x) => x.ledgerAccountId === a.ledgerAccountId,
          ),
          opening = own
            .filter((x) => x.journalEntry.entryDate < c.from)
            .reduce((v, x) => v.add(x.debit).sub(x.credit), Z),
          period = own.filter((x) => x.journalEntry.entryDate >= c.from),
          receipts = period.reduce((v, x) => v.add(x.debit), Z),
          payments = period.reduce((v, x) => v.add(x.credit), Z);
        return [
          a.name,
          n(opening),
          n(receipts),
          n(payments),
          n(opening.add(receipts).sub(payments)),
        ];
      }),
    };
  }
  if (name === "owner-capital") {
    const owners = await db.ownerFinancialAccount.findMany({
        where: { companyId: c.actor.companyId },
      }),
      users = await db.user.findMany({
        where: {
          companyId: c.actor.companyId,
          id: { in: owners.map((x) => x.userId) },
        },
      }),
      lines = await db.journalLine.groupBy({
        by: ["ledgerAccountId"],
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: {
            in: owners.flatMap((x) => [
              x.capitalLedgerId,
              x.drawingsLedgerId,
              x.loanLedgerId,
            ]),
          },
          journalEntry: {
            status: "POSTED",
            entryDate: { lte: c.to },
            ...c.branch,
          },
        },
        _sum: { debit: true, credit: true },
      }),
      map = new Map(
        lines.map((x) => [
          x.ledgerAccountId,
          new D(x._sum.credit ?? 0).sub(x._sum.debit ?? 0),
        ]),
      );
    return {
      title: "Owner Capital",
      columns: ["Owner", "Capital", "Drawings", "Loan"],
      rows: owners.map((x) => [
        users.find((u) => u.id === x.userId)?.name ?? x.userId,
        n(map.get(x.capitalLedgerId) ?? Z),
        n((map.get(x.drawingsLedgerId) ?? Z).neg()),
        n(map.get(x.loanLedgerId) ?? Z),
      ]),
    };
  }
  if (["items", "invoices", "customers"].includes(name)) {
    const docs = await db.commercialDocument.findMany({
        where: {
          companyId: c.actor.companyId,
          status: "POSTED",
          type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
          issueDate: { gte: c.from, lte: c.to },
          ...c.branch,
        },
        include: { lines: true },
      }),
      movements = await db.stockMovement.findMany({
        where: {
          companyId: c.actor.companyId,
          sourceId: { in: docs.map((x) => x.id) },
        },
      }),
      group = new Map<
        string,
        {
          label: string;
          revenue: Prisma.Decimal;
          cogs: Prisma.Decimal;
          quantity: Prisma.Decimal;
        }
      >();
    for (const doc of docs) {
      for (const line of doc.lines) {
        const key =
            name === "items"
              ? (line.productId ?? line.itemName)
              : name === "invoices"
                ? doc.id
                : doc.partyId,
          old = group.get(key) ?? {
            label:
              name === "items"
                ? line.itemName
                : name === "invoices"
                  ? doc.documentNumber
                  : doc.partyName,
            revenue: Z,
            cogs: Z,
            quantity: Z,
          },
          sign = doc.type === "CREDIT_NOTE" ? new D(-1) : new D(1),
          cost = movements
            .filter((m) => m.sourceLineId === line.id)
            .reduce((v, m) => v.add(m.totalCost), Z);
        old.revenue = old.revenue.add(line.taxableAmount.mul(sign));
        old.quantity = old.quantity.add(line.quantity.mul(sign));
        old.cogs = old.cogs.add(cost.mul(sign));
        group.set(key, old);
      }
    }
    return {
      title: `${name} Profit`,
      columns: [
        name.slice(0, -1),
        "Quantity",
        "Revenue",
        "COGS",
        "Profit",
        "Margin %",
      ],
      rows: [...group.values()].map((x) => {
        const p = itemProfitability(x.revenue, x.cogs);
        return [
          x.label,
          x.quantity.toFixed(4),
          n(p.revenue),
          n(p.cogs),
          n(p.profit),
          p.marginPercent.toFixed(2),
        ];
      }),
      note: "Tax-exclusive posted sales revenue less linked inventory movement cost; service cost is not fabricated.",
    };
  }
  throw new Error("UNKNOWN_REPORT");
}
async function projectReport(name: string, raw: unknown, actor: ProjectActor) {
  const c = await context(raw, true, actor),
    branches = await authorizedProjectBranchIds(c.actor),
    projects = await db.project.findMany({
      where: {
        ...projectRecordScope(c.actor, branches),
        ...(c.f.projectId ? { id: c.f.projectId } : {}),
      },
      select: { id: true, projectNumber: true, name: true },
    }),
    rows = [] as Array<Array<string | number>>;
  for (const p of projects) {
    const x = await loadProjectCostingForActor(c.actor, p.id);
    rows.push([
      p.projectNumber,
      p.name,
      n(x.metrics.contractRevenueBase),
      n(x.metrics.actualCost),
      n(x.metrics.profit),
      n(x.metrics.budgetVariance),
    ]);
  }
  return {
    title: name === "projects" ? "Project Profit & Loss" : "Budget vs Actual",
    columns: [
      "Project",
      "Name",
      "Revenue Base",
      "Actual Cost",
      "Profit",
      "Budget Variance",
    ],
    rows,
  };
}
export async function reportOptionsForActor(a: ProjectActor) {
  const branchFilter =
    a.branchAccessScope === "SELECTED_BRANCHES"
      ? { id: { in: a.branchIds ?? [] } }
      : {};
  return {
    branches: await db.branch.findMany({
      where: { companyId: a.companyId, isActive: true, ...branchFilter },
    }),
    ledgers: await db.ledgerAccount.findMany({
      where: { companyId: a.companyId, isActive: true },
    }),
    customers: await db.customer.findMany({
      where: {
        companyId: a.companyId,
        isActive: true,
        isAccountCustomer: true,
      },
    }),
    vendors: await db.vendor.findMany({
      where: { companyId: a.companyId, isActive: true },
    }),
    products: await db.accountProduct.findMany({
      where: { companyId: a.companyId, isActive: true },
    }),
    projects: await db.project.findMany({
      where: { ...projectRecordScope(a, await authorizedProjectBranchIds(a)) },
      select: { id: true, name: true, projectNumber: true },
    }),
  };
}

export async function runFinancialReport(name: string, raw: unknown) {
  return runFinancialReportForActor(
    (await requirePermission("ACCOUNT_REPORTS")) as ProjectActor,
    name,
    raw,
  );
}
export async function reportOptions() {
  return reportOptionsForActor(
    (await requirePermission("ACCOUNT_REPORTS")) as ProjectActor,
  );
}

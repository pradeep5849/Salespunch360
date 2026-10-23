import {allTransactionsReport} from "./all-transactions";
import {allPartiesReport} from "./all-parties";
import {categoryTradeReport} from "./category-trade";
import {partyItemsReport} from "./party-items";
import {itemBatchReport} from "./item-batch";
import {dayBookFilterDates,dayBookReport} from "./day-book";
import {classificationSalesReport} from "./classification-sales";
import {orderReport} from "./order-reports";
import {WITHHOLDING_REPORTS,withholdingReport} from "./withholding";
import {loanStatementReport} from "./loan-statement";
import {itemDiscountReport} from "./item-discount";
import {itemSerialReport} from "./item-serial";
import {gstRateReport} from "./gst-rate";
import {partyTradeReport} from "./party-trade";
import {stockLevelReport} from "./stock-level";
import {bankStatementReport} from "./bank-statement";
import {financialLedgerBreakdown,type LedgerBreakdown} from "./ledger-breakdown";
import {stockCategoryReport} from "./stock-category";
import {stockDetailReport} from "./stock-detail";
import {EXPENSE_REPORTS,expenseReport} from "./expense-reports";
import {TRANSACTION_REPORTS,transactionReport} from "./transaction-reports";
import {reportSpecificFilters} from "./catalogue";
import { requireAccountModules } from "../modules";
import { reportQuantity, reportUnitKey } from "./quantity";
import { economicDocumentsAt } from "../commercial-report-policy";
import { partyLedgerReport } from "./party-ledger";
import { postedJournalAt } from "../settlement-policy";
import { LEDGER_EFFECTIVE_JOURNAL_STATUSES } from "@/lib/accounting/ledger-policy";
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
import { gstReportForActor } from "../tax";
import { reportCalendarDate, reportFinancialYearStart } from "./dates";
import { itemProfitability } from "../inventory";
import {
  requireProjectFunction,
  authorizedProjectBranchIds,
  projectRecordScope,
  type ProjectActor,
} from "../projects";
import { loadProjectCostingForActor } from "../project-costing";
import { documentOutstandingsBatch } from "../commercial";

const blankFilter = (value: unknown) =>
  typeof value === "string" && !value.trim() ? undefined : value;

const D = Prisma.Decimal.clone({precision:48}),
  Z = new D(0),
  filterSchema = z
    .object({
      scope: z.literal("all").optional(),
      from: z.preprocess(blankFilter, z.coerce.date().optional()),
      to: z.preprocess(blankFilter, z.coerce.date().optional()),
      asOf: z.preprocess(blankFilter, z.coerce.date().optional()),
      branchId: z.preprocess(blankFilter, z.string().uuid().optional()),
      projectId: z.preprocess(blankFilter, z.string().uuid().optional()),
      customerId: z.preprocess(blankFilter, z.string().uuid().optional()),
      vendorId: z.preprocess(blankFilter, z.string().uuid().optional()),
      productId: z.preprocess(blankFilter, z.string().uuid().optional()),
      ledgerId: z.preprocess(blankFilter, z.string().uuid().optional()),
      ownerId: z.preprocess(blankFilter, z.string().uuid().optional()),
      loanId: z.preprocess(blankFilter, z.string().uuid().optional()),
      moneyAccountId: z.preprocess(blankFilter, z.string().uuid().optional()),
      categoryId: z.preprocess(blankFilter, z.union([z.string().uuid(), z.literal("UNCATEGORIZED")]).optional()),
      stockLevel: z.preprocess(blankFilter,z.enum(["AVAILABLE","LOW","NEGATIVE"]).optional()),
      itemSearch: z.preprocess(blankFilter,z.string().trim().max(240).optional()),
      itemStatus: z.preprocess(blankFilter, z.enum(["ACTIVE", "INACTIVE"]).optional()),
      classificationSide:z.preprocess(blankFilter,z.enum(["SALES","PURCHASES"]).optional()),
      orderType:z.preprocess(blankFilter,z.enum(["SALES_ORDER","PURCHASE_ORDER"]).optional()),
      orderStatus:z.preprocess(blankFilter,z.enum(["OPEN","CLOSED","DRAFT","CANCELLED","UNRESOLVED"]).optional()),
      accountType:z.preprocess(blankFilter,z.enum(["CASH","BANK","PETTY_CASH"]).optional()),
    })
    .strict();

export type ReportFilter = z.infer<typeof filterSchema>;
export type ReportResult = {
  breakdown?:LedgerBreakdown[];
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  rowLinks?: string[];
  nativeRowLinks?:string[];
  summary?:Array<{label:string;value:string;money:boolean;displayValue?:string}>;
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
    to = f.to ?? f.asOf ?? new Date(reportCalendarDate()),
    from = f.from ?? reportFinancialYearStart(to);

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
      select: { id: true },
    }))
  )
    throw new AuthorizationError();

  if (
    f.ownerId &&
    !(await db.ownerFinancialAccount.findFirst({
      where: { id: f.ownerId, companyId: actor.companyId },
      select: { id: true },
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

export type FinancialReportContext=Awaited<ReturnType<typeof context>>;

const sumPairMap = (
  rows: Array<{
    ledgerAccountId: string;
    _sum: { debit: Prisma.Decimal | null; credit: Prisma.Decimal | null };
  }>,
) =>
  new Map(
    rows.map((x) => [
      x.ledgerAccountId,
      {
        debit: new D(x._sum.debit ?? 0),
        credit: new D(x._sum.credit ?? 0),
      },
    ]),
  );

async function ledgerData(raw: unknown, actor?: ProjectActor) {
  const c = await context(raw, false, actor);
  const [accounts, openingGrouped, periodGrouped] = await Promise.all([
    db.ledgerAccount.findMany({
      where: { companyId: c.actor.companyId },
      orderBy: { code: "asc" },
    }),
    db.journalLine.groupBy({
      by: ["ledgerAccountId"],
      where: {
        companyId: c.actor.companyId,
        journalEntry: {
          status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
          entryDate: { lt: c.from },
          ...c.branch,
        },
      },
      _sum: { debit: true, credit: true },
    }),
    db.journalLine.groupBy({
      by: ["ledgerAccountId"],
      where: {
        companyId: c.actor.companyId,
        journalEntry: {
          status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
          entryDate: { gte: c.from, lte: c.to },
          ...c.branch,
        },
      },
      _sum: { debit: true, credit: true },
    }),
  ]);
  const opening = sumPairMap(openingGrouped),
    period = sumPairMap(periodGrouped);
  const mapped: ReportLine[] = accounts.map((a) => ({
    ledgerId: a.id,
    code: a.code,
    name: a.name,
    accountClass: a.accountClass,
    openingDebit: opening.get(a.id)?.debit ?? Z,
    openingCredit: opening.get(a.id)?.credit ?? Z,
    periodDebit: period.get(a.id)?.debit ?? Z,
    periodCredit: period.get(a.id)?.credit ?? Z,
  }));
  return { ...c, lines: mapped };
}

// Keep report values exact until the presentation/export boundary applies display precision.
const n = (x: Prisma.Decimal) => x.toString();
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
  if(raw&&typeof raw==="object"){
    const allowed=new Set(["scope","from","to","asOf","branchId",...reportSpecificFilters(name)]);
    for(const [key,value]of Object.entries(raw))if(key in filterSchema.shape&&!allowed.has(key)&&value!==undefined&&value!==null&&String(value).trim())throw new Error("REPORT_FILTER_NOT_SUPPORTED");
  }
  if(name==="day-book"){const filters=filterSchema.parse(raw);return dayBookReport(await context({...filters,...dayBookFilterDates(filters)},false,actor))}
  if(["order-transactions","order-items"].includes(name))return orderReport(await context(raw,false,actor),name==="order-items");
  if(["hsn-sales","sac-sales"].includes(name))return classificationSalesReport(await context(raw,false,actor),name==="sac-sales");
  if(name==="all-transactions")return allTransactionsReport(await context(raw,false,actor));
  if(name==="all-parties")return allPartiesReport(await context(raw,false,actor));
  if(name==="category-trade")return categoryTradeReport(await context(raw,false,actor));
  if(name==="party-items"||name==="item-party")return partyItemsReport(await context(raw,false,actor),name==="item-party");
  if(name==="item-discount")return itemDiscountReport(await context(raw,false,actor));
  if(name==="item-batch")return itemBatchReport(await context(raw,false,actor));
  if(name==="item-serial")return itemSerialReport(await context(raw,false,actor));
  if(name==="gst-rate")return gstRateReport(await context(raw,false,actor));
  if(["sale-purchase-party","discount-party","gst-party"].includes(name))return partyTradeReport(await context(raw,false,actor),name==="gst-party"?"GST":name==="discount-party"?"DISCOUNT":"TRADE");
  if(EXPENSE_REPORTS.includes(name))return expenseReport(name,await context(raw,false,actor));
  if(name==="stock-category")return stockCategoryReport(await context(raw,false,actor));
  if(["stock-summary","low-stock-summary"].includes(name))return stockLevelReport(name,await context(raw,false,actor));
  if(WITHHOLDING_REPORTS.includes(name))return withholdingReport(await context(raw,false,actor),name);
  if(name==="loan-statement")return loanStatementReport(await context(raw,false,actor));
  if(name==="bank-statement")return bankStatementReport(await context(raw,false,actor));
  if(name==="stock-detail")return stockDetailReport(await context(raw,false,actor));
  if(TRANSACTION_REPORTS.includes(name))return transactionReport(name,await context(raw,false,actor));
  if (name === "projects" || name === "budget-vs-actual")
    return projectReport(name, raw, actor);
  if (
    [
      "project-material-balance",
      "material-consumption",
      "project-transfer",
    ].includes(name)
  )
    return projectMaterialReport(name, raw, actor);

  if (name === "tax") {
    const c = await context(raw, false, actor),
      r = await gstReportForActor(c.actor, {
        from: c.from,
        to: c.to,
        branchId: c.f.branchId,
      });
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
        breakdown:financialLedgerBreakdown(d.lines,false),
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
        breakdown:financialLedgerBreakdown(d.lines,true),
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
        select: { id: true },
      }))
    )
      throw new AuthorizationError();
    const [openingAgg, rows] = await Promise.all([
      db.journalLine.aggregate({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: c.f.ledgerId,
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate: { lt: c.from },
            ...c.branch,
          },
        },
        _sum: { debit: true, credit: true },
      }),
      db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: c.f.ledgerId,
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate: { gte: c.from, lte: c.to },
            ...c.branch,
          },
        },
        include: { journalEntry: true },
        orderBy: { journalEntry: { entryDate: "asc" } },
      }),
    ]);
    const opening = new D(openingAgg._sum.debit ?? 0).sub(
        openingAgg._sum.credit ?? 0,
      ),
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
    const moneyAccounts = await db.moneyAccount.findMany({
      where: {
        companyId: c.actor.companyId,
        ...(c.f.branchId
          ? { OR: [{ branchId: null }, { branchId: c.f.branchId }] }
          : c.actor.branchAccessScope === "SELECTED_BRANCHES"
            ? {
                OR: [
                  { branchId: null },
                  { branchId: { in: c.actor.branchIds ?? [] } },
                ],
              }
            : {}),
      },
      select: { ledgerAccountId: true },
    });
    const rows = await db.journalLine.findMany({
      where: {
        companyId: c.actor.companyId,
        journalEntry: {
          status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
          entryDate: { gte: c.from, lte: c.to },
          ...c.branch,
        },
        OR: [
          { ledgerAccount: { systemKey: { in: ["CASH", "BANK"] } } },
          {
            ledgerAccountId: {
              in: moneyAccounts.map((x) => x.ledgerAccountId),
            },
          },
        ],
      },
      include: { journalEntry: true },
    });
    const r = cashFlow(
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
    const sales = name === "receivable-aging";
    const docs = await db.commercialDocument.findMany({
      where: {
        companyId: c.actor.companyId,
        status: {in:["POSTED","CANCELLED"]},
        journalEntry: {is:postedJournalAt(c.to)},
        type: sales ? "SALES_INVOICE" : "PURCHASE_BILL",
        issueDate: { lte: c.to },
        ...c.branch,
      },
      orderBy: { issueDate: "asc" },
    });
    const [outstanding, opening] = await Promise.all([
      documentOutstandingsBatch(c.actor.companyId!, docs, c.to),
      listOpeningOutstandings({
        companyId: c.actor.companyId!,
        partyType: sales ? "CUSTOMER" : "VENDOR",
        branchIds: c.f.branchId
          ? [c.f.branchId]
          : c.actor.branchAccessScope === "SELECTED_BRANCHES"
            ? (c.actor.branchIds ?? [])
            : undefined,
        asOf: c.to,
      }),
    ]);
    const open = docs.filter((x) => (outstanding.get(x.id) ?? Z).gt(0)),
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
    const customer=name==="customer-ledger",partyId=customer?c.f.customerId:c.f.vendorId;
    if(!partyId)throw new Error(customer?"CUSTOMER_REQUIRED":"VENDOR_REQUIRED");
    return partyLedgerReport({companyId:c.actor.companyId,partyId,customer,from:c.from,to:c.to,branches:c.f.branchId?[c.f.branchId]:c.actor.branchAccessScope==="SELECTED_BRANCHES"?[...(c.actor.branchIds??[])]:undefined});
  }

  if (name === "purchase-register") {
    await requireAccountModules(c.actor,"PURCHASES");
    const docs = await db.commercialDocument.findMany({
        where: {
          companyId: c.actor.companyId,
          type: "PURCHASE_BILL",
          ...economicDocumentsAt(c.to),
          issueDate: { gte: c.from, lte: c.to },
          ...c.branch,
          ...(c.f.vendorId ? { vendorId: c.f.vendorId } : {}),
        },
        include: {
          project: true,
          lines: { include: { purchaseAllocations: true } },
        },
        orderBy: { issueDate: "asc" },
      }),
      outstanding = await documentOutstandingsBatch(c.actor.companyId, docs,c.to);
    return {
      title: "Purchase Register",
      columns: [
        "Date",
        "Document",
        "Vendor invoice",
        "Vendor",
        "Purchase For",
        "Project",
        "Cost category / allocation",
        "Tax",
        "Total",
        "Outstanding",
      ],
      note:"Bills are included by their issue date and effective journal history at the selected end date. Outstanding uses payments and corrections effective at the selected end date.",
      nativeRowLinks:docs.map(doc=>`/workspace/account/purchases/${doc.id}`),
      rowLinks:docs.map(doc=>`/workspace/account/transactions/${doc.id}`),
      rows: docs.map((doc) => [
        doc.issueDate.toISOString().slice(0, 10),
        doc.documentNumber,
        doc.vendorInvoiceNumber ?? "",
        doc.partyName,
        doc.purchasePurpose ?? "",
        doc.project?.name ?? "",
        doc.lines
          .flatMap((line) =>
            line.purchaseAllocations.map(
              (a) => `${a.allocationType}: ${n(a.taxableAmount)}`,
            ),
          )
          .join("; "),
        n(doc.taxTotal),
        n(doc.grandTotal),
        n(outstanding.get(doc.id) ?? Z),
      ]),
    };
  }

  if (name === "cash-bank") {
    const accounts = await db.moneyAccount.findMany({
      where: {
        companyId: c.actor.companyId,
        ...(c.f.accountType?{type:c.f.accountType}:{}),
        ...(c.f.branchId
          ? { OR: [{ branchId: null }, { branchId: c.f.branchId }] }
          : c.actor.branchAccessScope === "SELECTED_BRANCHES"
            ? {
                OR: [
                  { branchId: null },
                  { branchId: { in: c.actor.branchIds ?? [] } },
                ],
              }
            : {}),
      },
    });
    const ledgerIds = accounts.map((x) => x.ledgerAccountId);
    const [openingGrouped, periodGrouped] = await Promise.all([
      db.journalLine.groupBy({
        by: ["ledgerAccountId"],
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: { in: ledgerIds },
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate: { lt: c.from },
            ...c.branch,
          },
        },
        _sum: { debit: true, credit: true },
      }),
      db.journalLine.groupBy({
        by: ["ledgerAccountId"],
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: { in: ledgerIds },
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate: { gte: c.from, lte: c.to },
            ...c.branch,
          },
        },
        _sum: { debit: true, credit: true },
      }),
    ]);
    const opening = sumPairMap(openingGrouped),
      period = sumPairMap(periodGrouped);
    const rows=accounts.map((a)=>{const o=opening.get(a.ledgerAccountId),p=period.get(a.ledgerAccountId),start=(o?.debit??Z).sub(o?.credit??Z),receipts=p?.debit??Z,payments=p?.credit??Z;return[a.name,n(start),n(receipts),n(payments),n(start.add(receipts).sub(payments))]});
    return {
      title: "Cash / Bank Book",
      columns: ["Account", "Opening", "Receipts", "Payments", "Closing"],
      rows,
      summary:["Opening","Receipts","Payments","Closing"].map((label,index)=>({label,value:rows.reduce((sum,row)=>sum.add(row[index+1]),new D(0)).toString(),money:true})),
      note:"Opening + receipts − payments = closing. Values follow the selected account type, branch and report period.",
    };
  }

  if (name === "profit-withdrawal") {
    const owners = await db.ownerFinancialAccount.findMany({
      where: {
        companyId: c.actor.companyId,
        ...(c.f.ownerId ? { id: c.f.ownerId } : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const [users, entries] = await Promise.all([
      db.user.findMany({
        where: {
          companyId: c.actor.companyId,
          id: {
            in: owners
              .map((owner) => owner.userId)
              .filter((id): id is string => Boolean(id)),
          },
        },
        select: { id: true, name: true },
      }),
      db.journalLine.findMany({
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: {
            in: owners.map((owner) => owner.drawingsLedgerId),
          },
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate: { gte: c.from, lte: c.to },
            ...c.branch,
          },
        },
        include: { journalEntry: true },
        orderBy: [{ journalEntry: { entryDate: "asc" } }, { id: "asc" }],
      }),
    ]);
    const names = new Map(users.map((user) => [user.id, user.name]));
    const ownerNames = new Map(
      owners.map((owner) => [
        owner.drawingsLedgerId,
        owner.name || names.get(owner.userId ?? "") || "Owner",
      ]),
    );
    return {
      title: "Profit Withdrawal Report",
      columns: [
        "Date",
        "Owner / Partner",
        "Reference",
        "Amount",
        "Transaction",
      ],
      rows: entries.map((entry) => [
        entry.journalEntry.entryDate.toISOString().slice(0, 10),
        ownerNames.get(entry.ledgerAccountId) ?? "",
        entry.journalEntry.reference ?? "",
        n(entry.debit.sub(entry.credit)),
        entry.journalEntry.sourceType,
      ]),
      totals: [
        "Net withdrawals",
        "",
        "",
        n(
          entries.reduce(
            (total, entry) => total.add(entry.debit).sub(entry.credit),
            Z,
          ),
        ),
        "",
      ],
      note: "Owner/partner drawings from the business; withdrawals are not business expenses. Reversals reduce withdrawals on their journal date. This report does not calculate distributable profit.",
    };
  }

  if (name === "owner-capital") {
    const owners = await db.ownerFinancialAccount.findMany({
      where: {
        companyId: c.actor.companyId,
        ...(c.f.ownerId ? { id: c.f.ownerId } : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
    const ledgerIds = owners.flatMap((owner) => [
      owner.capitalLedgerId,
      owner.drawingsLedgerId,
      owner.loanLedgerId,
    ]);
    const aggregate = (entryDate: Prisma.DateTimeFilter) =>
      db.journalLine.groupBy({
        by: ["ledgerAccountId"],
        where: {
          companyId: c.actor.companyId,
          ledgerAccountId: { in: ledgerIds },
          journalEntry: {
            status: { in: [...LEDGER_EFFECTIVE_JOURNAL_STATUSES] },
            entryDate,
            ...c.branch,
          },
        },
        _sum: { debit: true, credit: true },
      });
    const [openingRows, periodRows] = await Promise.all([
      aggregate({ lt: c.from }),
      aggregate({ gte: c.from, lte: c.to }),
    ]);
    const opening = sumPairMap(openingRows),
      period = sumPairMap(periodRows);
    const creditNet = (map: ReturnType<typeof sumPairMap>, id: string) =>
      (map.get(id)?.credit ?? Z).sub(map.get(id)?.debit ?? Z);
    const rows = owners.map((owner) => {
      const capitalOpen = creditNet(opening, owner.capitalLedgerId),
        capitalMovement = creditNet(period, owner.capitalLedgerId),
        drawingsPeriod = creditNet(period, owner.drawingsLedgerId).neg(),
        drawingsClosing = creditNet(opening, owner.drawingsLedgerId)
          .neg()
          .add(drawingsPeriod),
        loan = creditNet(opening, owner.loanLedgerId).add(
          creditNet(period, owner.loanLedgerId),
        );
      return [
        owner.name,
        n(capitalOpen),
        n(capitalMovement),
        n(capitalOpen.add(capitalMovement)),
        n(drawingsPeriod),
        n(drawingsClosing),
        n(loan),
      ];
    });
    return {
      title: "Owner Capital",
      columns: [
        "Owner / Partner",
        "Opening Capital",
        "Net Capital Movement",
        "Capital",
        "Period Drawings",
        "Drawings",
        "Loan",
      ],
      rows,
      rowLinks: owners.map(
        (owner) => `/workspace/account/money/capital/${owner.id}`,
      ),
      totals: [
        "Combined total",
        ...Array.from({ length: 6 }, (_, i) =>
          n(rows.reduce((sum, row) => sum.add(row[i + 1]), Z)),
        ),
      ],
      note: "Opening capital precedes the selected period. Net capital movement includes capital additions, capital withdrawals and their corrections. Profit distributions and legacy unclassified withdrawals appear in drawings; they do not reduce capital. Loan is separate. Figures include effective reversals and only authorized branches; owners remain visible when inactive.",
    };
  }

  if (["items", "invoices", "customers"].includes(name)) {
    const docs = await db.commercialDocument.findMany({
      where: {
        companyId: c.actor.companyId,
        ...economicDocumentsAt(c.to),
        type: { in: ["SALES_INVOICE", "CREDIT_NOTE"] },
        issueDate: { gte: c.from, lte: c.to },
        ...c.branch,
        ...(c.f.customerId ? { customerId: c.f.customerId } : {}),
        ...(c.f.projectId ? { projectId: c.f.projectId } : {}),
        ...(c.f.productId ? { lines: { some: { productId: c.f.productId } } } : {}),
      },
      include: { lines: c.f.productId ? { where: { productId: c.f.productId } } : true },
    });
    const docsById=new Map(docs.map(doc=>[doc.id,doc]));
    const movementGrouped = await db.stockMovement.groupBy({
      by: ["sourceLineId"],
      where: {
        companyId: c.actor.companyId,
        sourceId: { in: docs.map((x) => x.id) },
        sourceLineId: { not: null },
      },
      _sum: { totalCost: true },
    });
    const costByLine = new Map(
      movementGrouped.flatMap((x) =>
        x.sourceLineId
          ? [[x.sourceLineId, new D(x._sum.totalCost ?? 0)] as const]
          : [],
      ),
    );
    const group = new Map<
      string,
      {
        label: string;
        revenue: Prisma.Decimal;
        cogs: Prisma.Decimal;
        quantities: Map<string, Prisma.Decimal>;
      }
    >();
    for (const doc of docs)
      for (const line of doc.lines) {
        const key =
            name === "items"
              ? `${line.productId ?? line.itemName}:${reportUnitKey(line)}`
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
            quantities: new Map<string, Prisma.Decimal>(),
          },
          sign = doc.type === "CREDIT_NOTE" ? new D(-1) : new D(1),
          cost = costByLine.get(line.id) ?? Z;
        old.revenue = old.revenue.add(line.taxableAmount.mul(sign));
        const unitKey = reportUnitKey(line);
        old.quantities.set(unitKey, (old.quantities.get(unitKey) ?? Z).add(line.quantity.mul(sign)));
        old.cogs = old.cogs.add(cost.mul(sign));
        group.set(key, old);
      }
    return {
      title: name==="items"?"Item Wise Profit & Loss":name==="invoices"?"Bill Wise Profit":"Party Wise Profit & Loss",
      columns: [
        name==="items"?"Item":name==="invoices"?"Invoice":"Party",
        "Quantity",
        "Revenue",
        "COGS",
        "Profit",
        "Margin %",
        ...(name==="invoices"?["Date","Party","Type"]:[]),
      ],
      rows: [...group.entries()].map(([key,x]) => {
        const p = itemProfitability(x.revenue, x.cogs);
        return [
          x.label,
          reportQuantity(x.quantities),
          n(p.revenue),
          n(p.cogs),
          n(p.profit),
          p.marginPercent.toFixed(2),
          ...(name==="invoices"?[docsById.get(key)!.issueDate.toISOString().slice(0,10),docsById.get(key)!.partyName,docsById.get(key)!.type]:[]),
        ];
      }),
      summary:[{label:"Revenue (excluding tax)",value:[...group.values()].reduce((sum,row)=>sum.add(row.revenue),new D(0)).toString(),money:true},{label:"Total Profit / Loss",value:[...group.values()].reduce((sum,row)=>sum.add(row.revenue).sub(row.cogs),new D(0)).toString(),money:true}],
      ...(name==="invoices"?{rowLinks:[...group.keys()].map(id=>{const doc=docsById.get(id)!;return doc.type==="SALES_INVOICE"?`/workspace/account/sales/${id}`:`/workspace/account/transactions/${id}`}),nativeRowLinks:[...group.keys()].map(id=>`/workspace/account/sales/${id}`)}:{}),
      note: "Tax-exclusive posted sales revenue,net of credit notes,less linked inventory movement cost; service cost is not fabricated. Summaries use exactly the displayed row scope. Quantities retain saved units; mixed units are not added or converted.",
    };
  }

  throw new Error("UNKNOWN_REPORT");
}

async function projectMaterialReport(
  name: string,
  raw: unknown,
  actor: ProjectActor,
): Promise<ReportResult> {
  const c = await context(raw, true, actor);
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_MATERIAL_VIEW");
  await requireProjectFunction(actor, "ACCOUNT_PROJECT_COST_VIEW");
  await requireAccountModules(actor, "PROJECT_COSTING");
  const authorizedBranches = await authorizedProjectBranchIds(actor),
    branches = c.f.branchId
      ? authorizedBranches.filter(id => id === c.f.branchId)
      : authorizedBranches,
    projects = await db.project.findMany({
      where: {
        ...projectRecordScope(actor, branches),
        ...(c.f.projectId ? { id: c.f.projectId } : {}),
      },
      select: { id: true },
    });
  if (c.f.projectId && !projects.some(project => project.id === c.f.projectId))
    throw new AuthorizationError();
  const rows = await db.projectMaterialMovement.findMany({
    where: {
      companyId: actor.companyId,
      movementDate: { gte: c.from, lte: c.to },
      projectId: { in: projects.map(project => project.id) },
      ...(c.f.productId ? { productId: c.f.productId } : {}),
      branchId: { in: branches },
      ...(name === "material-consumption"
        ? { movementType: "CONSUMPTION" }
        : name === "project-transfer"
          ? { movementType: { in: ["TRANSFER_OUT", "TRANSFER_IN"] } }
          : {}),
    },
    orderBy: [{ movementDate: "asc" }, { createdAt: "asc" }],
  });
  return {
    title: name.replaceAll("-", " ").replace(/\b\w/g, (x) => x.toUpperCase()),
    columns: [
      "Date",
      "Project",
      "Movement",
      "Product",
      "Quantity",
      "Unit cost",
      "Value",
      "Source",
      "Destination",
      "Purchase document",
      "Correction document",
      "Original receipt",
    ],
    rows: rows.map((x) => [
      x.movementDate.toISOString().slice(0, 10),
      x.projectId,
      x.movementType,
      x.productId,
      x.quantity.toString(),
      n(x.originalUnitCost),
      n(x.totalCost),
      x.sourceProjectId ?? "",
      x.destinationProjectId ?? "",
      x.purchaseDocumentId ?? "",
      x.correctionDocumentId ?? "",
      x.sourceMovementId ?? "",
    ]),
    note: "Internal Project movements preserve original cost and create no GST. Supplier-return GST is recorded once by the linked debit note.",
  };
}

async function projectReport(name: string, raw: unknown, actor: ProjectActor) {
  const c = await context(raw, true, actor),
    authorizedBranches = await authorizedProjectBranchIds(c.actor),
    branches = c.f.branchId
      ? authorizedBranches.filter((id) => id === c.f.branchId)
      : authorizedBranches,
    projects = await db.project.findMany({
      where: {
        ...projectRecordScope(c.actor, branches),
        ...(c.f.projectId ? { id: c.f.projectId } : {}),
      },
      select: { id: true, projectNumber: true, name: true },
      orderBy: [{ projectNumber: "asc" }, { name: "asc" }],
    });
  const costings = await Promise.all(
    projects.map((p) => loadProjectCostingForActor(c.actor, p.id)),
  );
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
    rows: projects.map((p, index) => {
      const x = costings[index];
      return [
        p.projectNumber,
        p.name,
        n(x.metrics.contractRevenueBase),
        n(x.metrics.actualCost),
        n(x.metrics.profit),
        n(x.metrics.budgetVariance),
      ];
    }),
    note: "Lifetime-to-date project values. Date filters do not apply.",
  };
}

export async function reportOptionsForActor(a: ProjectActor) {
  const branchFilter =
    a.branchAccessScope === "SELECTED_BRANCHES"
      ? { id: { in: a.branchIds ?? [] } }
      : {};
  const projectBranches = await authorizedProjectBranchIds(a),projectOnly=a.accountRole==="PROJECT_MANAGER";
  const [branches, ledgers, customers, vendors, products, projects, owners] =
    await Promise.all([
      db.branch.findMany({
        where: { companyId: a.companyId, isActive: true, ...branchFilter },
        select:{id:true,name:true,code:true},
      }),
      projectOnly?Promise.resolve([]):db.ledgerAccount.findMany({
        where: { companyId: a.companyId, isActive: true },
        select:{id:true,name:true,code:true},
      }),
      projectOnly?Promise.resolve([]):db.customer.findMany({
        where: {
          companyId: a.companyId,
          isActive: true,
          isAccountCustomer: true,
          ...(a.branchAccessScope === "SELECTED_BRANCHES"
            ? { branchId: { in: a.branchIds ?? [] } }
            : {}),
        },
        select:{id:true,name:true},
      }),
      projectOnly?Promise.resolve([]):db.vendor.findMany({ where: { companyId: a.companyId, isActive: true },select:{id:true,name:true} }),
      projectOnly?Promise.resolve([]):db.accountProduct.findMany({
        where: { companyId: a.companyId, isActive: true },
        select:{id:true,name:true,code:true},
      }),
      db.project.findMany({
        where: { ...projectRecordScope(a, projectBranches) },
        select: { id: true, name: true, projectNumber: true },
      }),
      a.accountRole === "PROJECT_MANAGER"
        ? Promise.resolve([])
        : db.ownerFinancialAccount.findMany({
            where: { companyId: a.companyId },
            select: { id: true, name: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
          }),
    ]);
  return { branches, ledgers, customers, vendors, products, projects, owners };
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

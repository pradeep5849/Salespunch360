import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { economicDocumentsAt } from "../commercial-report-policy";
import { documentOutstandingsBatch } from "../commercial";
import { requireAccountModules } from "../modules";
import type { FinancialReportContext, ReportResult } from "./service";
const D = Prisma.Decimal;
export const TRANSACTION_REPORTS = ["sale-report", "purchase-report"];
/** Invoice balances already include credits; a return must not subtract the credit twice. */
export async function transactionReport(
  name: string,
  c: FinancialReportContext,
): Promise<ReportResult> {
  const sales = name === "sale-report";
  await requireAccountModules(c.actor, sales ? "SALES" : "PURCHASES");
  const docs = await db.commercialDocument.findMany({
    where: {
      companyId: c.actor.companyId,
      ...c.branch,
      ...economicDocumentsAt(c.to),
      issueDate: { gte: c.from, lte: c.to },
      type: {
        in: sales
          ? ["SALES_INVOICE", "CREDIT_NOTE"]
          : ["PURCHASE_BILL", "DEBIT_NOTE"],
      },
      ...(c.f.projectId ? { projectId: c.f.projectId } : {}),
      ...(sales && c.f.customerId ? { customerId: c.f.customerId } : {}),
      ...(!sales && c.f.vendorId ? { vendorId: c.f.vendorId } : {}),
    },
    orderBy: [{ issueDate: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  const invoices = docs.filter(
    (doc) => doc.type === (sales ? "SALES_INVOICE" : "PURCHASE_BILL"),
  );
  const balances = await documentOutstandingsBatch(
    c.actor.companyId,
    invoices,
    c.to,
  );
  let total = new D(0),
    outstanding = new D(0);
  const rows = docs.map((doc) => {
    const amount = doc.grandTotal.mul(
        ["CREDIT_NOTE", "DEBIT_NOTE"].includes(doc.type) ? -1 : 1,
      ),
      balance = balances.get(doc.id) ?? new D(0);
    total = total.add(amount);
    outstanding = outstanding.add(balance);
    return [
      doc.issueDate.toISOString().slice(0, 10),
      doc.documentNumber,
      doc.type.replaceAll("_", " "),
      doc.partyName,
      amount.toString(),
      balance.toString(),
    ];
  });
  return {
    title: sales ? "Sale Report" : "Purchase Report",
    columns: ["Date", "Document", "Type", "Party", "Total", "Outstanding"],
    rows,
    rowLinks: docs.map((doc) =>
      sales && doc.type === "SALES_INVOICE"
        ? `/workspace/account/sales/${doc.id}`
        : `/workspace/account/transactions/${doc.id}`,
    ),
    nativeRowLinks: docs.map(
      (doc) => `/workspace/account/${sales ? "sales" : "purchases"}/${doc.id}`,
    ),
    totals: ["Net total", "", "", "", total.toString(), outstanding.toString()],
    summary: [
      {
        label: "No. of Transactions",
        value: String(docs.length),
        money: false,
      },
      {
        label: sales ? "Total Sale" : "Total Purchase",
        value: total.toString(),
        money: true,
      },
      { label: "Balance Due", value: outstanding.toString(), money: true },
    ],
    note: "Returns reduce the transaction total. Balance Due uses invoice balances after payments, advances and linked credits; returns are not deducted twice.",
  };
}

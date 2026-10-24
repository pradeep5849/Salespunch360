import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import { requireAccountModules } from "../modules";
import { orderQuantitySummary } from "../orders/fulfilment";
import { effectiveOrderTargetsInTx } from "../orders/effective-targets";
import type { FinancialReportContext, ReportResult } from "./service";

const D = Prisma.Decimal.clone({precision:48});

/** Read-only, batched order commitments; recorded order amounts are never treated as payments. */
export async function orderReport(c: FinancialReportContext, items: boolean): Promise<ReportResult> {
  if (!canUsePermission(c.actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_LEDGER_VIEW")) throw new AuthorizationError();
  const type = c.f.orderType ?? "SALES_ORDER", sales = type === "SALES_ORDER";
  await requireAccountModules(c.actor, ...(sales ? ["SALES", "SALES_ORDER"] as const : ["PURCHASES", "PURCHASE_ORDER"] as const));
  if ((sales && c.f.vendorId) || (!sales && c.f.customerId)) throw new Error("REPORT_FILTER_NOT_SUPPORTED");
  return db.$transaction(async tx => {
    const rows: ReportResult["rows"] = [], links: string[] = []; let cursor: string | undefined;
    let count = 0, total = new D(0);
    for (;;) {
      const orders = await tx.commercialDocument.findMany({
        where: { companyId: c.actor.companyId, ...c.branch, type, issueDate: { gte: c.from, lte: c.to },
          ...(c.f.customerId ? { customerId: c.f.customerId } : {}), ...(c.f.vendorId ? { vendorId: c.f.vendorId } : {}) },
        include: { lines: { orderBy: { position: "asc" } } }, orderBy: { id: "asc" }, take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!orders.length) break;
      const ids = orders.map(o => o.id);
      const [allTargets, closed] = await Promise.all([
        tx.commercialDocument.findMany({ where: { companyId: c.actor.companyId, ...c.branch,
          ...(sales ? { sourceSalesOrderId: { in: ids } } : { sourcePurchaseOrderId: { in: ids } }),
          status: "POSTED", OR: [{ journalEntryId: null }, { journalEntry: { is: { status: "POSTED" } } }] }, include: { lines: true } }),
        tx.accountOperationalAudit.findMany({ where: { companyId: c.actor.companyId, entityType: "COMMERCIAL_DOCUMENT", entityId: { in: ids }, eventType: "ORDER_REMAINING_CLOSED" }, select: { entityId: true } }),
      ]);
      const targets = await effectiveOrderTargetsInTx(tx, c.actor.companyId!, allTargets), closedIds = new Set(closed.map(x => x.entityId));
      for (const order of orders) {
        const fulfilling = targets.filter(t => (sales ? t.sourceSalesOrderId : t.sourcePurchaseOrderId) === order.id);
        const legacy = fulfilling.some(t => t.lines.some(l => !l.sourceOrderLineId));
        const quantities = !legacy && order.lines.length ? orderQuantitySummary(order.lines, fulfilling.map(t => ({ id: t.id, status: "POSTED", lines: t.lines.map(l => ({ ...l, sourceOrderLineId: l.sourceOrderLineId! })) })), closedIds.has(order.id)) : null;
        const status = order.status !== "POSTED" ? order.status : closedIds.has(order.id) ? "CLOSED" : quantities?.status ?? "UNRESOLVED";
        if (c.f.orderStatus && status !== c.f.orderStatus) continue;
        count++; total = total.add(order.grandTotal);
        const link = `/workspace/account/transactions/${order.id}`;
        if (!items) { rows.push([order.issueDate.toISOString().slice(0, 10), order.documentNumber, order.partyName, status, order.grandTotal.toFixed(2)]); links.push(link); }
        else for (const line of order.lines) {
          const q = quantities?.lines.find(q => q.id === line.id);
          rows.push([order.documentNumber, order.partyName, status, line.itemName, q?.ordered ?? "Unresolved", q?.fulfilled ?? "Unresolved", q?.remaining ?? "Unresolved", line.lineTotal.toFixed(2)]); links.push(link);
        }
      }
      if (orders.length < 500) break;
      cursor = orders[orders.length - 1].id;
    }
    return { title: items ? "Order Item Report" : "Order Transaction Report",
      columns: items ? ["Order", "Party", "Status", "Item", "Ordered Qty (primary)", "Invoiced/Billed Qty (primary)", "Remaining Qty (primary)", "Amount"] : ["Date", "Order", "Party", "Status", "Amount"],
      rows, rowLinks: links, nativeRowLinks: links,
      summary: [{ label: "Orders", value: String(count), money: false }, { label: "Recorded order amount", value: total.toFixed(2), money: true }],
      note: "Amounts are full recorded order commitments, not payments or remaining invoice debt. Quantities use each item's primary unit; different items must not be added together. Only posted invoices/bills fulfil quantities. Cancelled or corrected sales are excluded. Legacy unallocated fulfilments remain unresolved. Status reflects current fulfilment; the date filter selects order issue dates. No ledger or stock changes." };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}

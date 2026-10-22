import {saleInvoiceIdentity} from "./sale-invoice-identity";
import { gstStateName } from "./gst-states";
import { db } from "@/lib/db";
import { canUsePermission } from "@/lib/auth/permissions";
import {
  AuthorizationError,
  requirePermission,
} from "@/lib/auth/authorization";
import { getCommercialDocumentForActor } from "./commercial";
import { currentPartyBalanceForActor } from "./party-balance";
import type { ProjectActor } from "./projects";

export async function saleDetailForActor(actor: ProjectActor, id: string) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_LEDGER_VIEW"))
    throw new AuthorizationError();
  return db.$transaction(
    async (tx) => {
      const sale = await getCommercialDocumentForActor(actor, id, tx);
      if (sale.type !== "SALES_INVOICE") throw new Error("NOT_FOUND");
      const identity=await saleInvoiceIdentity(tx,sale);
      const zero = sale.grandTotal.mul(0);
      const receipts = sale.allocations.filter(
        (row) => row.settlement.type === "CUSTOMER_RECEIPT",
      );
      const [partyBalance, pendingCheques] =
        await Promise.all([
          currentPartyBalanceForActor(actor, sale.partyId, true, tx),
          tx.settlementAllocation.count({
            where: { companyId: actor.companyId, documentId: sale.id, settlement:{status:"PENDING_CHEQUE"} },
          }),
        ]);
      const active =
        sale.status === "POSTED" && sale.journalEntry?.status !== "REVERSED";
      const base = sale.payableAmount ?? sale.grandTotal;
      const outstanding = active ? (sale.financial?.outstanding ?? base) : zero;
      return {
        ...sale,
        documentNumber:identity.printedNumber,
        internalDocumentNumber:sale.documentNumber,
        invoiceRevision:identity.revision,
        previousInvoiceId:identity.previousInvoiceId,
        stateOfSupplyName: gstStateName(sale.stateOfSupplyCode),
        partyBalance,
        paymentSummary: {
          received: receipts
            .reduce(
              (total, row) => total.add(row.amount.sub(row.discountAmount)),
              zero,
            )
            .toFixed(2),
          paymentDiscount: receipts
            .reduce((total, row) => total.add(row.discountAmount), zero)
            .toFixed(2),
          advanceApplied: sale.advanceApplications
            .reduce((total, row) => total.add(row.amount), zero)
            .toFixed(2),
          credits: sale.adjustments
            .filter((row) => row.type === "CREDIT_NOTE")
            .reduce(
              (total, row) => total.add(row.payableAmount ?? row.grandTotal),
              zero,
            )
            .toFixed(2),
          outstanding: outstanding.toFixed(2),
          lifecycle:
            sale.journalEntry?.status === "REVERSED" ? "REVERSED" : sale.status,
          canChange:
            active &&
            Boolean(sale.financial) &&
            !pendingCheques &&
            outstanding.add(sale.allocations.reduce((sum,row)=>sum.add(row.amount),zero)).add(sale.advanceApplications.reduce((sum,row)=>sum.add(row.amount),zero)).eq(base) &&
            !sale.adjustments.length &&
            canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST") &&
            (!(sale.allocations.length||sale.advanceApplications.length)||(["ACCOUNT_ADMIN","ACCOUNTANT"].includes(actor.accountRole??"")&&canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SETTLEMENT_ENTRY"))) &&
            canUsePermission(
              actor,
              "SALESPUNCH360_ACCOUNT",
              "ACCOUNT_SALES_ENTRY",
            ),
        },
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
export async function saleDetail(id: string) {
  const actor = await requirePermission("ACCOUNT_LEDGER_VIEW");
  if (!actor.companyId) throw new AuthorizationError();
  return saleDetailForActor({ ...actor, companyId: actor.companyId }, id);
}

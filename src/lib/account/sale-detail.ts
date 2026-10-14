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
      const zero = sale.grandTotal.mul(0);
      const receipts = sale.allocations.filter(
        (row) => row.settlement.type === "CUSTOMER_RECEIPT",
      );
      const [partyBalance, allocationHistory, advanceHistory] =
        await Promise.all([
          currentPartyBalanceForActor(actor, sale.partyId, true, tx),
          tx.settlementAllocation.count({
            where: { companyId: actor.companyId, documentId: sale.id },
          }),
          tx.advanceApplication.count({
            where: { companyId: actor.companyId, documentId: sale.id },
          }),
        ]);
      const active =
        sale.status === "POSTED" && sale.journalEntry?.status !== "REVERSED";
      const base = sale.payableAmount ?? sale.grandTotal;
      const outstanding = active ? (sale.financial?.outstanding ?? base) : zero;
      return {
        ...sale,
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
            outstanding.eq(base) &&
            !sale.adjustments.length &&
            !allocationHistory &&
            !advanceHistory &&
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

import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
import { canUsePermission } from "@/lib/auth/permissions";
import type { ProjectActor } from "./projects";

/** Invoices plus openings, less credits and posted payments; prepayments remain negative. */
export async function currentPartyBalanceForActor(
  actor: ProjectActor,
  partyId: string,
  customer = true,
  reader?: Prisma.TransactionClient,
) {
  if (!canUsePermission(actor, "SALESPUNCH360_ACCOUNT", "ACCOUNT_LEDGER_VIEW"))
    throw new AuthorizationError();
  z.string().guid().parse(partyId);
  return scopedPartyBalance(
    actor.companyId,
    partyId,
    customer,
    actor.branchAccessScope === "SELECTED_BRANCHES"
      ? [...(actor.branchIds ?? [])]
      : undefined,
    reader,
  );
}

export async function scopedPartyBalance(
  companyId: string,
  partyId: string,
  customer: boolean,
  branches?: string[],
  reader: Pick<Prisma.TransactionClient, "$queryRaw"> = db,
) {
  const restrict = (column: Prisma.Sql) =>
    branches === undefined
      ? Prisma.empty
      : branches.length
        ? Prisma.sql`AND ${column} IN (${Prisma.join(branches.map((id) => Prisma.sql`${id}::uuid`))})`
        : Prisma.sql`AND FALSE`;
  const invoiceType = customer ? "SALES_INVOICE" : "PURCHASE_BILL";
  const adjustmentType = customer ? "CREDIT_NOTE" : "DEBIT_NOTE";
  const paymentType = customer ? "CUSTOMER_RECEIPT" : "VENDOR_PAYMENT";
  const advanceType = customer ? "CUSTOMER_ADVANCE" : "VENDOR_ADVANCE";
  const rows = await reader.$queryRaw<
    Array<{ balance: Prisma.Decimal }>
  >(Prisma.sql`
    SELECT COALESCE(SUM(value),0) AS balance FROM (
      SELECT SUM(CASE WHEN d.type::text=${invoiceType}
        THEN COALESCE(d."payableAmount",d."grandTotal") ELSE -COALESCE(d."payableAmount",d."grandTotal") END) AS value
      FROM commercial_documents d LEFT JOIN journal_entries j ON j.id=d."journalEntryId" AND j."companyId"=d."companyId"
      WHERE d."companyId"=${companyId}::uuid AND d."partyId"=${partyId}::uuid AND d.status='POSTED'
        AND (d."journalEntryId" IS NULL OR j.status='POSTED') AND d.type::text IN (${invoiceType},${adjustmentType})
        ${restrict(Prisma.sql`d."branchId"`)}
      UNION ALL
      SELECT SUM(o.amount) FROM party_opening_balances o JOIN journal_entries j ON j.id=o."journalEntryId" AND j."companyId"=o."companyId"
      WHERE o."companyId"=${companyId}::uuid AND o."partyId"=${partyId}::uuid AND o."partyType"::text=${customer ? "CUSTOMER" : "VENDOR"}
        AND j.status='POSTED' ${restrict(Prisma.sql`o."branchId"`)}
      UNION ALL
      SELECT -SUM(s.amount + CASE WHEN s.type::text=${paymentType} THEN s."discountAmount" ELSE 0 END)
      FROM account_settlements s JOIN journal_entries j ON j.id=s."journalEntryId" AND j."companyId"=s."companyId"
      WHERE s."companyId"=${companyId}::uuid AND s."partyId"=${partyId}::uuid AND s.status='POSTED' AND j.status='POSTED'
        AND s."paymentMode"::text<>'ACCOUNT_CREDIT' AND s.type::text IN (${paymentType},${advanceType}) ${restrict(Prisma.sql`s."branchId"`)}
      UNION ALL
      SELECT SUM(a."discountAmount") FROM settlement_allocations a
      JOIN account_settlements c ON c."receiptCreditSourceAllocationId"=a.id AND c."companyId"=a."companyId"
      WHERE c."companyId"=${companyId}::uuid AND c."partyId"=${partyId}::uuid AND c.status='POSTED'
        ${restrict(Prisma.sql`c."branchId"`)}
    ) balances
  `);
  return new Prisma.Decimal(rows[0]?.balance ?? 0).toFixed(2);
}

import type { CommercialDocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { AccountBranchActor, AccountBranchContext } from "./branch-context";
import { accountHomeScopes } from "./account-home";

export const accountHomeTransactionTypes = [
  "SALES_INVOICE", "SALES_ORDER", "CREDIT_NOTE", "PURCHASE_BILL",
  "PURCHASE_ORDER", "DEBIT_NOTE", "PROFORMA_INVOICE", "DELIVERY_CHALLAN",
  "SUBCONTRACT_PURCHASE",
] as const satisfies readonly CommercialDocumentType[];

export function normalizedHomeTypes(values: string[] | undefined): CommercialDocumentType[] {
  const supported = new Set<string>(accountHomeTransactionTypes);
  return [...new Set((values ?? []).filter((value): value is CommercialDocumentType => supported.has(value)))];
}

export async function accountMobileHomeData(actor: AccountBranchActor, context: AccountBranchContext, input: { tab?: string; q?: string; types?: string[] }) {
  const scopes = accountHomeScopes(actor, context);
  const q = input.q?.trim().slice(0, 100) ?? "";
  const types = normalizedHomeTypes(input.types);
  const documentWhere: Prisma.CommercialDocumentWhereInput = {
    ...scopes.document,
    ...(types.length ? { type: { in: types } } : {}),
    ...(q ? { OR: [
      { partyName: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { projectReference: { contains: q, mode: "insensitive" } },
    ] } : {}),
  };
  const partyWhere: Prisma.CustomerWhereInput = {
    companyId: actor.companyId,
    isActive: true,
    isAccountCustomer: true,
    ...(context.mode === "BRANCH" ? { branchId: context.branchId } : {}),
    ...(actor.accountRole === "PROJECT_MANAGER" ? { projects: { some: { projectManagerId: actor.id } } } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [transactions, parties] = await Promise.all([
    db.commercialDocument.findMany({
      where: documentWhere,
      orderBy: [{ issueDate: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: { id: true, partyName: true, type: true, documentNumber: true, issueDate: true, status: true, grandTotal: true, balanceDue: true },
    }),
    db.customer.findMany({ where: partyWhere, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true, updatedAt: true } }),
  ]);
  const partyIds = parties.map(party => party.id);
  const balances = partyIds.length ? await db.commercialDocument.groupBy({
    by: ["customerId"],
    where: { ...scopes.document, customerId: { in: partyIds }, status: "POSTED" },
    _sum: { balanceDue: true },
    _max: { issueDate: true },
  }) : [];
  const balanceByParty = new Map(balances.map(row => [row.customerId, row]));
  return {
    q, types,
    transactions: transactions.map(row => ({ ...row, grandTotal: row.grandTotal.toString(), balanceDue: row.balanceDue.toString() })),
    parties: parties.map(party => ({ id: party.id, name: party.name, lastActivity: balanceByParty.get(party.id)?._max.issueDate ?? party.updatedAt, balance: balanceByParty.get(party.id)?._sum.balanceDue?.toString() ?? "0" })),
  };
}

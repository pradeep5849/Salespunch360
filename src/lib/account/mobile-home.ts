import type { CommercialDocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { documentOutstandingsBatch } from "@/lib/account/commercial";
import type { AccountBranchActor, AccountBranchContext } from "./branch-context";
import { accountHomeScopes } from "./account-home";

export const accountHomeTransactionTypes = [
  "SALES_INVOICE", "SALES_ORDER", "CREDIT_NOTE", "PURCHASE_BILL",
  "PURCHASE_ORDER", "DEBIT_NOTE", "PROFORMA_INVOICE", "DELIVERY_CHALLAN",
  "SUBCONTRACT_PURCHASE",
] as const satisfies readonly CommercialDocumentType[];

export const accountHomeFilterKeys = [...accountHomeTransactionTypes,
  "CUSTOMER_RECEIPT", "VENDOR_PAYMENT", "ESTIMATE", "EXPENSE", "P2P_RECEIVED", "P2P_PAID",
  "SALE_FA", "PURCHASE_FA", "SALE_CANCELLED", "JOB_WORK_OUT", "SALE_REPEATING",
] as const;

export function normalizedHomeTypes(values: string[] | undefined): string[] {
  const supported = new Set<string>(accountHomeFilterKeys);
  return [...new Set((values ?? []).filter(value => supported.has(value)))];
}

export async function accountMobileHomeData(actor: AccountBranchActor, context: AccountBranchContext, input: { tab?: string; q?: string; types?: string[] }) {
  const scopes = accountHomeScopes(actor, context);
  const q = input.q?.trim().slice(0, 100) ?? "";
  const types = normalizedHomeTypes(input.types);
  const commercialTypes = types.filter((type): type is CommercialDocumentType => (accountHomeTransactionTypes as readonly string[]).includes(type));
  const documentFilters: Prisma.CommercialDocumentWhereInput[] = commercialTypes.map(type => ({ type }));
  if (types.includes("SALE_CANCELLED")) documentFilters.push({ type: "SALES_INVOICE", status: "CANCELLED" });
  const documentWhere: Prisma.CommercialDocumentWhereInput = {
    ...scopes.document,
    NOT: { type: "SALES_INVOICE", status: "DRAFT" },
    ...((types.length || q) ? { AND: [
      ...(types.length ? [{ OR: documentFilters.length ? documentFilters : [{ id: { equals: "__no_commercial_document__" } }] }] : []),
      ...(q ? [{ OR: [
        { partyName: { contains: q, mode: "insensitive" as const } },
        { documentNumber: { contains: q, mode: "insensitive" as const } },
        { projectReference: { contains: q, mode: "insensitive" as const } },
      ] }] : []),
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
      select: { id: true, partyName: true, type: true, documentNumber: true, issueDate: true, status: true, grandTotal: true, payableAmount: true, balanceDue: true },
    }),
    db.customer.findMany({ where: partyWhere, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true, updatedAt: true } }),
  ]);
  const postedSales = transactions.filter(row => row.type === "SALES_INVOICE" && row.status === "POSTED");
  const saleOutstandings = postedSales.length ? await documentOutstandingsBatch(actor.companyId, postedSales) : new Map();
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
    transactions: transactions.map(row => {
      const outstanding = row.type === "SALES_INVOICE" && row.status === "POSTED" ? saleOutstandings.get(row.id) : undefined;
      const base = row.payableAmount ?? row.grandTotal;
      const paymentStatus = outstanding === undefined ? undefined : outstanding.isZero() ? "PAID" : outstanding.lt(base) ? "PARTIALLY_PAID" : "UNPAID";
      return { ...row, grandTotal: row.grandTotal.toString(), balanceDue: (outstanding ?? row.balanceDue).toString(), paymentStatus };
    }),
    parties: parties.map(party => ({ id: party.id, name: party.name, lastActivity: balanceByParty.get(party.id)?._max.issueDate ?? party.updatedAt, balance: balanceByParty.get(party.id)?._sum.balanceDue?.toString() ?? "0" })),
  };
}

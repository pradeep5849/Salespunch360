import {ACCOUNT_ROLE_PERMISSIONS} from "@/lib/auth/permissions";
import {enabledModulesForCompany} from "./modules";
import {homeNonCommercialRows,homeReadBranches} from "./home-noncommercial";
import type { CommercialDocumentType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {commercialDocumentPolicies, documentOutstandingsBatch } from "@/lib/account/commercial";
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

/** Keep reference categories visible without silently claiming an unsupported source has no records. */
export const HOME_UNAVAILABLE_FILTERS:Readonly<Record<string,string>>={SALE_FA:"Sale FA",PURCHASE_FA:"Purchase FA",JOB_WORK_OUT:"Job work out (Challan)",SALE_REPEATING:"Sale [Repeating]"};
export function unavailableHomeFilters(types:readonly string[]){return types.filter(key=>Object.hasOwn(HOME_UNAVAILABLE_FILTERS,key)).map(key=>({key,label:HOME_UNAVAILABLE_FILTERS[key],message:`${HOME_UNAVAILABLE_FILTERS[key]} is not available in Home yet. Transactions from this category are not included.`}))}

export function normalizedHomeTypes(values: string[] | undefined): string[] {
  const supported = new Set<string>(accountHomeFilterKeys);
  return [...new Set((values ?? []).filter(value => supported.has(value)))];
}

export async function accountMobileHomeData(actor: AccountBranchActor, context: AccountBranchContext, input: { tab?: string; q?: string; types?: string[];includeNonCommercial?:boolean }) {
  const scopes = accountHomeScopes(actor, context);
  const q = input.q?.trim().slice(0, 100) ?? "";
  const types = normalizedHomeTypes(input.types);
  const modules=input.includeNonCommercial?new Set(await enabledModulesForCompany(actor.companyId)):undefined;
  const permissions=new Set(actor.accountRole?ACCOUNT_ROLE_PERMISSIONS[actor.accountRole]:[]);
  const readBranches=input.includeNonCommercial?homeReadBranches(actor,context):undefined;
  const viewBranch=readBranches===undefined?{}:{branchId:{in:readBranches}};
  const allowedTypes=modules?(permissions.has("ACCOUNT_LEDGER_VIEW")?accountHomeTransactionTypes.filter(type=>commercialDocumentPolicies[type].modules.every(key=>modules.has(key))):[]):accountHomeTransactionTypes;
  const commercialTypes = types.filter((type): type is CommercialDocumentType => (accountHomeTransactionTypes as readonly string[]).includes(type));
  const documentFilters: Prisma.CommercialDocumentWhereInput[] = commercialTypes.map(type => ({ type }));
  if (types.includes("SALE_CANCELLED")) documentFilters.push({ type: "SALES_INVOICE", status: "CANCELLED" });
  const documentWhere: Prisma.CommercialDocumentWhereInput = {
    ...scopes.document,
    ...viewBranch,
    ...(modules?{type:{in:[...allowedTypes]}}:{}),
    NOT: { type: "SALES_INVOICE", status: "DRAFT" },
    ...((types.length || q) ? { AND: [
      ...(types.length ? [{ OR: documentFilters.length ? documentFilters : [{ id: { in: [] } }] }] : []),
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
    ...viewBranch,
    ...(actor.accountRole === "PROJECT_MANAGER" ? { projects: { some: { projectManagerId: actor.id } } } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
  };
  const [transactions, parties,extraRows] = await Promise.all([
    modules&&!allowedTypes.length?[]:db.commercialDocument.findMany({
      where: documentWhere,
      orderBy: [{ issueDate: "desc" }, { updatedAt: "desc" }],
      take: 20,
      select: { id: true, partyName: true, type: true, documentNumber: true, issueDate: true, status: true, grandTotal: true, payableAmount: true, balanceDue: true,updatedAt:true },
    }),
    modules&&(!modules.size||(!permissions.has("ACCOUNT_ACCOUNTS")&&actor.accountRole!=="PROJECT_MANAGER"))?[]:db.customer.findMany({ where: partyWhere, orderBy: { updatedAt: "desc" }, take: 20, select: { id: true, name: true, updatedAt: true } }),
    modules?homeNonCommercialRows(actor,context,{q,types},modules,permissions):[],
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
  const normalized=transactions.map(row => {
      const outstanding = row.type === "SALES_INVOICE" && row.status === "POSTED" ? saleOutstandings.get(row.id) : undefined;
      const base = row.payableAmount ?? row.grandTotal;
      const paymentStatus = outstanding === undefined ? undefined : outstanding.isZero() ? "PAID" : outstanding.lt(base) ? "PARTIALLY_PAID" : "UNPAID";
      return {...row,sourceKind:"COMMERCIAL" as const,filterType:row.type,detailHref:row.type==="SALES_INVOICE"?`/workspace/account/sales/${row.id}`:`/workspace/account/transactions/${row.id}`,printType:row.type,showBalance:true,balanceLabel:"Balance",sortAt:row.updatedAt,grandTotal:(modules?base:row.grandTotal).toString(),payableAmount:row.payableAmount?.toString()??null,balanceDue:(outstanding??row.balanceDue).toString(),paymentStatus};
    });
  const merged=[...normalized,...extraRows].sort((a,b)=>b.issueDate.getTime()-a.issueDate.getTime()||(b.sortAt?.getTime()??0)-(a.sortAt?.getTime()??0)||b.id.localeCompare(a.id)).slice(0,20);
  return {q,types,unavailableFilters:unavailableHomeFilters(types),transactions:merged.map(item=>{const {sortAt,...row}=item;void sortAt;return row;}),
    parties: parties.map(party => ({ id: party.id, name: party.name, lastActivity: balanceByParty.get(party.id)?._max.issueDate ?? party.updatedAt, balance: balanceByParty.get(party.id)?._sum.balanceDue?.toString() ?? "0" })),
  };
}

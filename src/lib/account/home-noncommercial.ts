import {homeSettlementProjectScope} from "./home-settlement-scope";
import {homeSettlementRow} from "./home-settlement";
import {Prisma,type AccountModule} from "@prisma/client";
import {db} from "@/lib/db";
import {ACCOUNT_ROLE_PERMISSIONS,type Permission} from "@/lib/auth/permissions";
import type {AccountBranchActor,AccountBranchContext} from "./branch-context";

export type HomeSourceRow={id:string;sourceKind:"SETTLEMENT"|"EXPENSE"|"QUOTATION";type:string;filterType:string;partyName:string;documentNumber:string;issueDate:Date;status:string;grandTotal:string;balanceDue:string;balanceLabel:string;showBalance:boolean;detailHref:string;printType:string|null};
/** Intersect display context with assigned branches even for internal callers. */
export function homeReadBranches(actor:AccountBranchActor,context:AccountBranchContext):string[]|undefined{
 const assigned=actor.branchAccessScope==="SELECTED_BRANCHES"?[...(actor.branchIds??[])]:undefined;
 if(context.mode==="BRANCH")return assigned&&!assigned.includes(context.branchId)?[]:[context.branchId];
 return assigned;
}
export async function homeNonCommercialRows(actor:AccountBranchActor,context:AccountBranchContext,input:{q:string;types:string[]},modules:ReadonlySet<AccountModule>,permissions:ReadonlySet<Permission>):Promise<HomeSourceRow[]>{
 const branches=homeReadBranches(actor,context),branch=branches===undefined?{}:{branchId:{in:branches}},wanted=(key:string)=>!input.types.length||input.types.includes(key);
 if(branches?.length===0)return [];
 const can=(permission:Permission)=>permissions.has(permission)&&Boolean(actor.accountRole&&ACCOUNT_ROLE_PERMISSIONS[actor.accountRole].includes(permission));
 const paymentTypes: Array<"CUSTOMER_RECEIPT"|"CUSTOMER_ADVANCE"|"VENDOR_PAYMENT"|"VENDOR_ADVANCE">=[];
 if(can("ACCOUNT_LEDGER_VIEW")){
  if(wanted("CUSTOMER_RECEIPT")){if(modules.has("CUSTOMER_RECEIPTS"))paymentTypes.push("CUSTOMER_RECEIPT");if(modules.has("CUSTOMER_ADVANCES"))paymentTypes.push("CUSTOMER_ADVANCE");}
  if(wanted("VENDOR_PAYMENT")){if(modules.has("VENDOR_PAYMENTS"))paymentTypes.push("VENDOR_PAYMENT");if(modules.has("VENDOR_ADVANCES"))paymentTypes.push("VENDOR_ADVANCE");}
 }
 const project=paymentTypes.length?await homeSettlementProjectScope(actor):{};
 const [payments,expenses,quotes]=await Promise.all([
  paymentTypes.length?db.accountSettlement.findMany({where:{companyId:actor.companyId,...branch,...project,type:{in:paymentTypes},...(input.q?{OR:[{settlementNumber:{contains:input.q,mode:"insensitive" as const}},{reference:{contains:input.q,mode:"insensitive" as const}},{customer:{is:{name:{contains:input.q,mode:"insensitive" as const}}}},{vendor:{is:{name:{contains:input.q,mode:"insensitive" as const}}}}]}:{})},select:{id:true,type:true,settlementNumber:true,transactionDate:true,status:true,amount:true,remainingAmount:true,customer:{select:{name:true}},vendor:{select:{name:true}},journalEntry:{select:{status:true}}},orderBy:[{transactionDate:"desc"},{createdAt:"desc"},{id:"desc"}],take:20}):[],
  wanted("EXPENSE")&&can("ACCOUNT_EXPENSE_VIEW")&&modules.has("EXPENSES")?db.$queryRaw<Array<{id:string;type:string;transactionNumber:string;transactionDate:Date;status:string;totalAmount:Prisma.Decimal;paidDate:Date|null;categoryName:string;journalStatus:string|null}>>(Prisma.sql`
   SELECT e.id,e.type::text AS type,e."transactionNumber",e."transactionDate",e.status::text AS status,e."totalAmount",e."paidDate",c.name AS "categoryName",j.status::text AS "journalStatus"
   FROM expense_transactions e JOIN expense_categories c ON c.id=e."categoryId" AND c."companyId"=e."companyId"
   LEFT JOIN journal_entries j ON j.id=e."journalEntryId" AND j."companyId"=e."companyId"
   WHERE e."companyId"=${actor.companyId}::uuid
   ${branches===undefined?Prisma.empty:branches.length?Prisma.sql`AND e."branchId" IN (${Prisma.join(branches.map(id=>Prisma.sql`${id}::uuid`))})`:Prisma.sql`AND FALSE`}
   ${actor.accountRole==="PROJECT_MANAGER"?Prisma.sql`AND EXISTS (SELECT 1 FROM projects p WHERE p.id=e."projectId" AND p."companyId"=e."companyId" AND p."projectManagerId"=${actor.id}::uuid)`:Prisma.empty}
   ${input.q?Prisma.sql`AND (e."transactionNumber" ILIKE ${"%"+input.q+"%"} OR e.reference ILIKE ${"%"+input.q+"%"} OR c.name ILIKE ${"%"+input.q+"%"})`:Prisma.empty}
   ORDER BY e."transactionDate" DESC,e."createdAt" DESC,e.id DESC LIMIT 20
  `):[],
  wanted("ESTIMATE")&&can("ACCOUNT_QUOTATION_VIEW")&&modules.has("QUOTATIONS_BOQ")?db.$queryRaw<Array<{id:string;documentType:string;documentNumber:string;status:string;issueDate:Date;customerName:string;grandTotal:Prisma.Decimal}>>(Prisma.sql`
   SELECT d.id,d."documentType"::text AS "documentType",d."documentNumber",d.status::text AS status,r."issueDate",r."customerName",r."grandTotal"
   FROM quotation_documents d JOIN LATERAL (SELECT "issueDate","customerName","grandTotal" FROM quotation_revisions WHERE "documentId"=d.id ORDER BY "revisionNumber" DESC LIMIT 1) r ON TRUE
   WHERE d."companyId"=${actor.companyId}::uuid AND d."documentType"::text IN ('ESTIMATE','QUOTATION')
   ${branches===undefined?Prisma.empty:branches.length?Prisma.sql`AND d."branchId" IN (${Prisma.join(branches.map(id=>Prisma.sql`${id}::uuid`))})`:Prisma.sql`AND FALSE`}
   ${input.q?Prisma.sql`AND (d."documentNumber" ILIKE ${"%"+input.q+"%"} OR r."customerName" ILIKE ${"%"+input.q+"%"})`:Prisma.empty}
   ORDER BY r."issueDate" DESC,d."updatedAt" DESC,d.id DESC LIMIT 20
  `):[],
 ]);
 return [
  ...payments.map(homeSettlementRow),
  ...expenses.map(row=>{const status=row.journalStatus==="REVERSED"?"REVERSED":row.status,showBalance=status==="APPROVED"||status==="POSTED";return{id:row.id,sourceKind:"EXPENSE" as const,type:row.type==="OTHER_INCOME"?"OTHER_INCOME":"EXPENSE",filterType:"EXPENSE",partyName:row.categoryName,documentNumber:row.transactionNumber,issueDate:row.transactionDate,status,grandTotal:row.totalAmount.toString(),balanceDue:showBalance&&!row.paidDate?row.totalAmount.toString():"0",balanceLabel:row.type==="OTHER_INCOME"?"Unreceived amount":"Unpaid amount",showBalance,detailHref:`/workspace/account/expenses/${row.id}`,printType:null};}),
  ...quotes.map(row=>({id:row.id,sourceKind:"QUOTATION" as const,type:row.documentType,filterType:"ESTIMATE",partyName:row.customerName,documentNumber:row.documentNumber,issueDate:row.issueDate,status:row.status,grandTotal:row.grandTotal.toString(),balanceDue:"0",balanceLabel:"Balance",showBalance:false,detailHref:`/workspace/account/quotations/${row.id}`,printType:"QUOTATION"})),
 ];
}

import {homeSettlementProjectScope} from "./home-settlement-scope";
import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {ACCOUNT_ROLE_PERMISSIONS} from "@/lib/auth/permissions";
import {requireAccountModules} from "./modules";
import type {AccountBranchActor} from "./branch-context";
import type {HomeSourceRow} from "./home-noncommercial";
type Amount={toString():string};
type Header={id:string;type:string;settlementNumber:string;transactionDate:Date;status:string;amount:Amount;remainingAmount:Amount;createdAt?:Date;customer?:{name:string}|null;vendor?:{name:string}|null;journalEntry?:{status:string}|null};
export function homeSettlementRow(row:Header):HomeSourceRow{
 const incoming=row.type.startsWith("CUSTOMER"),status=row.journalEntry?.status==="REVERSED"?"REVERSED":row.status;
 return{id:row.id,sourceKind:"SETTLEMENT",sortAt:row.createdAt,type:row.type,filterType:incoming?"CUSTOMER_RECEIPT":"VENDOR_PAYMENT",partyName:row.customer?.name??row.vendor?.name??"Party",documentNumber:row.settlementNumber,issueDate:row.transactionDate,status,grandTotal:row.amount.toString(),balanceDue:status==="POSTED"?row.remainingAmount.toString():"0",balanceLabel:"Unallocated",showBalance:true,detailHref:`/workspace/account/settlements/${row.id}`,printType:row.type};
}
/** Read-only receipt/payment destination for Home; no posting or allocation is
 * performed by opening this view. Amounts distinguish cash from discounts. */
export async function homeSettlementForActor(actor:AccountBranchActor,id:string){
 if(!actor.accountRole||!ACCOUNT_ROLE_PERMISSIONS[actor.accountRole].includes("ACCOUNT_LEDGER_VIEW"))throw new AuthorizationError();
 if(!z.string().guid().safeParse(id).success)return null;
 const project=await homeSettlementProjectScope(actor);
 const row=await db.accountSettlement.findFirst({where:{id,companyId:actor.companyId,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:[...(actor.branchIds??[])]}}:{}),...project},include:{customer:{select:{name:true}},vendor:{select:{name:true}},branch:{select:{name:true}},journalEntry:{select:{status:true}},allocations:{include:{document:{select:{documentNumber:true,type:true,status:true}}}},openingAllocations:{include:{openingBalance:{select:{effectiveDate:true}}}}}});
 if(!row)return null;
 await requireAccountModules(actor,({CUSTOMER_RECEIPT:"CUSTOMER_RECEIPTS",CUSTOMER_ADVANCE:"CUSTOMER_ADVANCES",VENDOR_PAYMENT:"VENDOR_PAYMENTS",VENDOR_ADVANCE:"VENDOR_ADVANCES"} as const)[row.type]);
 const applications=await db.advanceApplication.findMany({where:{companyId:actor.companyId,advanceId:row.id},select:{id:true,amount:true,documentId:true,document:{select:{documentNumber:true,type:true,status:true}}}});
 const target=(doc:{type:string;documentNumber:string;status:string},id:string)=>({number:doc.documentNumber,status:doc.status,href:doc.type==="SALES_INVOICE"?`/workspace/account/sales/${id}`:`/workspace/account/transactions/${id}`});
 return{entry:homeSettlementRow(row),branch:row.branch.name,paymentMode:row.paymentMode,reference:row.reference,notes:row.notes,discountAmount:row.discountAmount.toString(),applications:[...row.allocations.map(item=>({id:item.id,...target(item.document,item.documentId),amount:item.amount.toString(),discount:item.discountAmount.toString()})),...row.openingAllocations.map(item=>({id:item.id,number:`Opening balance ${item.openingBalance.effectiveDate.toISOString().slice(0,10)}`,status:"POSTED",href:null,amount:item.amount.toString(),discount:"0"})),...applications.map(item=>({id:item.id,...target(item.document,item.documentId),amount:item.amount.toString(),discount:"0"}))]};
}

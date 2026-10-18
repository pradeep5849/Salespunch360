import {Prisma} from "@prisma/client";
import {z} from "zod";
import {AuthorizationError} from "@/lib/auth/authorization";
import {canUsePermission} from "@/lib/auth/permissions";
import {createCommercialDocumentForActor,postCommercialDocumentForActor,createSettlementForActor,saleReceiptBalanceForActor} from "./commercial";
import {ensureOpenFinancialYearForDate} from "./financial-year";
import {inAccountTransaction} from "./transaction-scope";
import {chequePaymentDetails} from "./cheque-payment-input";
type Actor=Parameters<typeof createCommercialDocumentForActor>[0];
const paymentInput=z.object({receivedAmount:z.union([z.number(),z.string()]).default("0").refine(value=>/^-?\d+(?:\.\d+)?$/.test(String(value)),"Invalid received amount"),receivedInFull:z.boolean().default(false),paymentType:z.string().default("CASH"),chequeNumber:z.string().optional(),chequeDate:z.string().optional(),moneyAccountId:z.string().uuid().optional(),reference:z.string().optional()});
/** Sale Save is one commit: invoice, posting and any receipt. No independent draft survives failure. */
export async function submitSaleForActor(actor:Actor,raw:unknown,payment:unknown={},receiptPrefix:"sale-save-receipt"|"mobile-sale-receipt"="sale-save-receipt"){
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||(raw as {type?:unknown}).type!=="SALES_INVOICE")throw new Error("INVALID_INPUT");
 if(!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_JOURNAL_POST"))throw new AuthorizationError();
 const p=paymentInput.parse(payment),received=new Prisma.Decimal(p.receivedAmount);
 if(!received.isFinite()||received.isNegative())throw new Error("INVALID_AMOUNT");
 const hasPayment=p.receivedInFull||received.gt(0);
 if(hasPayment&&!canUsePermission(actor,"SALESPUNCH360_ACCOUNT","ACCOUNT_SETTLEMENT_ENTRY"))throw new AuthorizationError();
 if(hasPayment&&p.paymentType==="CHEQUE")chequePaymentDetails.parse(p);
 return inAccountTransaction(undefined,async tx=>{
  const row=await createCommercialDocumentForActor(actor,raw,tx);
  await ensureOpenFinancialYearForDate(actor.companyId,row.issueDate,tx);
  await postCommercialDocumentForActor(actor,{documentId:row.id},tx);
  const key=`${receiptPrefix}:${row.id}`;
  const amount=p.receivedInFull?new Prisma.Decimal(await saleReceiptBalanceForActor(actor,row.id,key,tx)):received;
  if(amount.gt(0))await createSettlementForActor(actor,{
   idempotencyKey:key,type:"CUSTOMER_RECEIPT",branchId:row.branchId,partyId:row.partyId,
   paymentMode:p.paymentType==="CHEQUE"?"CHEQUE":p.paymentType==="CASH"?"CASH":"BANK",
   ...(p.moneyAccountId?{moneyAccountId:p.moneyAccountId}:{}),...(p.paymentType==="CHEQUE"?{chequeNumber:p.chequeNumber,chequeDate:p.chequeDate}:{}),...(p.reference?{reference:p.reference}:{}),
   amount:amount.toFixed(2),transactionDate:row.issueDate,allocations:[{documentId:row.id,amount:amount.toFixed(2)}],
  },tx);
  return {id:row.id,documentNumber:row.documentNumber,companyId:row.companyId,branchId:row.branchId,partyId:row.partyId,issueDate:row.issueDate,status:"POSTED" as const};
 });
}

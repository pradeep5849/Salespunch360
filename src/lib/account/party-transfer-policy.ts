import {Prisma} from "@prisma/client";
import {z} from "zod";
const D=Prisma.Decimal.clone({precision:48});
const amount=z.union([z.string(),z.number()]).transform(String).refine(value=>/^\d{1,16}(?:\.\d{1,2})?$/.test(value),"Use a non-negative amount with up to two decimal places").transform(value=>new D(value).toFixed(2));
const party=z.object({kind:z.enum(["CUSTOMER","VENDOR"]),id:z.string().uuid()}).strict();
/** Agency/pass-through flow: only the retained difference is Other Income. */
export const partyTransferInput=z.object({
 requestKey:z.string().uuid(),branchId:z.string().uuid(),moneyAccountId:z.string().uuid(),transactionDate:z.string().date(),
 receivedParty:party,paidParty:party,receivedAmount:amount,paidAmount:amount,notes:z.string().trim().max(5000).default(""),
}).strict().superRefine((value,ctx)=>{
 if(new D(value.receivedAmount).lte(0))ctx.addIssue({code:"custom",path:["receivedAmount"],message:"Received amount must be greater than zero"});
 if(new D(value.paidAmount).gt(value.receivedAmount))ctx.addIssue({code:"custom",path:["paidAmount"],message:"Paid amount cannot exceed received amount in a pass-through transfer"});
 if(value.receivedParty.kind===value.paidParty.kind&&value.receivedParty.id===value.paidParty.id)ctx.addIssue({code:"custom",path:["paidParty"],message:"Select two different parties"});
});
export type PartyTransferInput=z.infer<typeof partyTransferInput>;
export function partyTransferAmounts(input:Pick<PartyTransferInput,"receivedAmount"|"paidAmount">){
 const received=new D(input.receivedAmount),paid=new D(input.paidAmount);
 if(!received.isFinite()||!paid.isFinite()||received.lte(0)||paid.lt(0)||paid.gt(received))throw new Error("INVALID_PARTY_TRANSFER_AMOUNTS");
 return{receivedAmount:received.toFixed(2),paidAmount:paid.toFixed(2),passThroughAmount:paid.toFixed(2),commissionAmount:received.sub(paid).toFixed(2),commissionHead:"OTHER_INCOME" as const,expenseAmount:"0.00"};
}

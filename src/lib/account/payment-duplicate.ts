import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
import {homeSettlementForActor} from "./home-settlement";
import type {ProjectActor} from "./projects";
export async function paymentDuplicateForActor(actor:ProjectActor,id:string){
 if(!["ACCOUNT_ADMIN","ACCOUNTANT"].includes(actor.accountRole??""))throw new AuthorizationError();
 const source=await homeSettlementForActor(actor,id);if(!source)throw new Error("PAYMENT_DUPLICATE_UNAVAILABLE");
 const row=await db.accountSettlement.findFirstOrThrow({where:{id,companyId:actor.companyId},select:{type:true,branchId:true,partyId:true,paymentMode:true,moneyAccountId:true,amount:true,notes:true}});
 // ACCOUNT_CREDIT is non-cash source history, never a new cash receipt template.
 if(row.paymentMode==="ACCOUNT_CREDIT")throw new Error("PAYMENT_DUPLICATE_UNAVAILABLE");
 return {type:row.type,branchId:row.branchId,partyId:row.partyId,paymentMode:row.paymentMode,moneyAccountId:row.moneyAccountId??"",amount:row.amount.toString(),notes:row.notes??""};
}

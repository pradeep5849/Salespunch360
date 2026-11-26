import { z } from "zod";
import { db } from "@/lib/db";
const seats=z.number().int().min(0).max(10000).default(0);
const ids=z.array(z.string().uuid()).max(10000).default([]);
export const cartSelectionSchema=z.object({
 kind:z.enum(["SALES","PLUS","ACCOUNT_PACKAGE"]),
 billingPeriod:z.enum(["SIX_MONTH","YEARLY"]),
 purchaseMode:z.enum(["RENEW","ADD_TEAM","ADD_ACCOUNT"]).optional(),
 adminSeats:seats,managerSeats:seats,salesSeats:seats,telecallerSeats:seats,accountPackages:seats,
 quantity:z.number().int().min(1).max(100).optional(),
 retainAdminUserIds:ids,retainManagerUserIds:ids,retainSalesUserIds:ids
}).strict().refine(s=>s.kind==="ACCOUNT_PACKAGE"?s.quantity!==undefined:s.managerSeats+s.salesSeats>0);
export const cartMutationSchema=z.object({revision:z.number().int().nonnegative(),selection:cartSelectionSchema.nullable()}).strict();
export async function readBillingCart(companyId:string){
 return db.billingCart.findUnique({where:{companyId},select:{selection:true,revision:true,updatedAt:true}});
}
// Callers must authenticate and authorize SALES_BILLING before passing companyId.
export async function writeBillingCart(companyId:string,raw:unknown){
 const {revision,selection}=cartMutationSchema.parse(raw);
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM companies WHERE id = ${companyId}::uuid FOR UPDATE`;
  const current=await tx.billingCart.findUnique({where:{companyId}});
  if((current?.revision??0)!==revision)throw new Error("CART_REVISION_CONFLICT");
  // Preserve revision even after clearing, preventing stale clients restoring old selections.
  const value=selection??{};
  return tx.billingCart.upsert({where:{companyId},create:{companyId,selection:value,revision:1},update:{selection:value,revision:{increment:1}},select:{selection:true,revision:true,updatedAt:true}});
 });
}

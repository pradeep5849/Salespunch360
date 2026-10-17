import {db} from "@/lib/db";
import type {ProjectActor} from "./projects";

/** Called after the commercial editor's sales permission check. Never expose another branch's parties. */
export async function customerPriceOptionsForActor(actor: Pick<ProjectActor,"companyId"|"accountRole"|"branchAccessScope"|"branchIds">, enabled: boolean) {
  if (!enabled || !actor.companyId || actor.accountRole === "PROJECT_MANAGER") return [];
  const customers = await db.customer.findMany({where:{companyId:actor.companyId,isActive:true,isAccountCustomer:true,
    ...(actor.branchAccessScope === "SELECTED_BRANCHES" ? {branchId:{in:actor.branchIds??[]}} : {})},select:{id:true}});
  if (!customers.length) return [];
  const products = await db.accountProduct.findMany({where:{companyId:actor.companyId,isActive:true},select:{id:true}});
  const rows = await db.productPrice.findMany({where:{companyId:actor.companyId,isActive:true,priceType:"CUSTOMER",
    customerId:{in:customers.map(row=>row.id)},productId:{in:products.map(row=>row.id)}},
    orderBy:[{createdAt:"desc"},{id:"desc"}],select:{id:true,productId:true,customerId:true,rate:true,effectiveFrom:true,effectiveTo:true}});
  return rows.map(row=>({...row,rate:row.rate.toFixed(2),effectiveFrom:row.effectiveFrom?.toISOString().slice(0,10)??null,effectiveTo:row.effectiveTo?.toISOString().slice(0,10)??null}));
}

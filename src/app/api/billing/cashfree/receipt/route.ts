import { requirePermissionForMutation } from "@/lib/auth/authorization";
import { renderCashfreeReceipt } from "@/lib/billing/cashfree-receipt";
import { z } from "zod";
export async function GET(request:Request) {
 try {
  const actor=await requirePermissionForMutation("SALES_BILLING");
  if(!actor.companyId)return new Response(null,{status:403});
  const id=z.string().uuid().safeParse(new URL(request.url).searchParams.get("order"));
  if(!id.success)return new Response(null,{status:400});
  const pdf=await renderCashfreeReceipt(id.data,actor.companyId);
  if(!pdf)return new Response(null,{status:404});
  return new Response(new Uint8Array(pdf),{headers:{"content-type":"application/pdf","content-disposition":'attachment; filename="receipt-'+id.data+'.pdf"',"cache-control":"private, no-store","x-content-type-options":"nosniff"}});
 }catch{return new Response(null,{status:403});}
}

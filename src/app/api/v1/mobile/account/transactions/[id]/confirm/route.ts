import {authenticateMobileToken} from "@/lib/mobile/auth";
import {permit} from "@/lib/mobile/account-transactions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {confirmSalesOrderForActor} from "@/lib/account/commercial";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";

/** Route identity owns the order. Confirmation has no client-controlled company,
 * source quotation or posting metadata; the shared transaction rechecks all three. */
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_SALES_ENTRY");
  await assertOperationalWrite(actor.companyId);
  return mobileJson(await confirmSalesOrderForActor(actor,{documentId:(await context.params).id}));
 }catch(error){
  if(error instanceof Error&&error.message==="NOT_FOUND")return mobileJson({error:"NOT_FOUND"},404);
  if(error instanceof Error&&error.message==="DOCUMENT_NOT_FINALIZABLE")return mobileJson({error:"DOCUMENT_NOT_FINALIZABLE",message:"Only a draft Sale Order can be confirmed. Reload its latest details."},409);
  return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_SALES_ORDER_CONFIRM",error);}
}

import { authenticateMobileToken } from "@/lib/mobile/auth";
import { permit } from "@/lib/mobile/account-transactions";
import { mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected } from "@/lib/mobile/http";
import { assertOperationalWrite } from "@/lib/billing/entitlement";
import { salePriceProposalsForActor,confirmSalePriceForActor } from "@/lib/account/sale-price-updates";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){
 try{const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_STOCK");return mobileJson(await salePriceProposalsForActor(actor,(await context.params).id));}
 catch(error){return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_SALE_PRICE_PROPOSALS",error);}
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_STOCK");await assertOperationalWrite(actor.companyId);return mobileJson(await confirmSalePriceForActor(actor,{...await request.json(),documentId:(await context.params).id}));}
 catch(error){return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_SALE_PRICE_CONFIRMATION",error);}
}

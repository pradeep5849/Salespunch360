import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileConfirmPurchaseOrder} from "@/lib/mobile/account-purchases";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{return mobileJson(await mobileConfirmPurchaseOrder(await authenticateMobileToken(request.headers.get("authorization")),(await context.params).id))}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_PURCHASE_ORDER_CONFIRM",e)}}

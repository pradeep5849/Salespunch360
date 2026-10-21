import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import {orderSalePreparationForActor} from "@/lib/account/orders/preparation";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{return mobileJson(await orderSalePreparationForActor(mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization"))),(await context.params).id))}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_ORDER_PREPARATION",e)}}

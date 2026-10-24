import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import {orderSalePreparationForActor,orderPurchasePreparationForActor} from "@/lib/account/orders/preparation";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));const target=new URL(request.url).searchParams.get("targetType");if(target&&target!=="SALES_INVOICE"&&target!=="PURCHASE_BILL")return mobileJson({error:"INVALID_INPUT"},400);return mobileJson(await (target==="PURCHASE_BILL"?orderPurchasePreparationForActor:orderSalePreparationForActor)(actor,(await context.params).id))}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_ORDER_PREPARATION",e)}}

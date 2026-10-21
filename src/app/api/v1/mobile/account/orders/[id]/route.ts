import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import {orderStateForActor,closeRemainingOrderForActor} from "@/lib/account/orders/lifecycle";
export async function GET(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));return mobileJson(await orderStateForActor(actor,(await context.params).id))}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_ORDER_STATE",e)}}
export async function POST(request:Request,context:{params:Promise<{id:string}>}){try{const actor=mobileAccountActor(await authenticateMobileToken(request.headers.get("authorization")));const input=await request.json();return mobileJson(await closeRemainingOrderForActor(actor,{documentId:(await context.params).id,reason:input.reason}))}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??mobileUnexpected("MOBILE_ORDER_CLOSE",e)}}

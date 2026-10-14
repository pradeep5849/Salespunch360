import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileReverseOwnerTransaction } from "@/lib/mobile/account-money";
import { mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected } from "@/lib/mobile/http";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{return mobileJson(await mobileReverseOwnerTransaction(await authenticateMobileToken(request.headers.get("authorization")),(await params).id,await request.json()))}
 catch(error){return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_OWNER_CORRECTION",error)}
}

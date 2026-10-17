import {z} from "zod";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {quotationPartyBalanceForActor} from "@/lib/quotations/party-balance";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import type {ProjectActor} from "@/lib/account/projects";
export async function GET(request:Request){
 try{
  const user=await authenticateMobileToken(request.headers.get("authorization"));
  return mobileJson(await quotationPartyBalanceForActor(mobileAccountActor(user) as ProjectActor,Object.fromEntries(new URL(request.url).searchParams)));
 }catch(error){
  return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??(error instanceof z.ZodError?mobileJson({error:"INVALID_INPUT"},400):mobileUnexpected("MOBILE_QUOTATION_PARTY_BALANCE",error));
 }
}

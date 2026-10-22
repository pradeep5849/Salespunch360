import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileAccountActor} from "@/lib/mobile/account-transactions";
import {mobileCustomerQuotation} from "@/lib/mobile/account-quotations";
import {mobileAuthorizationFailure,mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
import {QUOTATION_THEMES,QUOTATION_THEME_COLORS} from "@/lib/quotations/theme-catalogue";
import {saveQuotationThemeForActor} from "@/lib/quotations/theme-settings";
import {z} from "zod";
export async function GET(request:Request,c:{params:Promise<{id:string}>}){try{
 const u=await authenticateMobileToken(request.headers.get("authorization")),r=await mobileCustomerQuotation(u,(await c.params).id);
 return mobileJson({themes:QUOTATION_THEMES.map(({id,name})=>({id,name})),colors:QUOTATION_THEME_COLORS,current:r.printPresentation,canSave:u.accountRole==="ACCOUNT_ADMIN"});
}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??(e instanceof Error&&e.message==="NOT_FOUND"?mobileJson({error:"NOT_FOUND"},404):mobileUnexpected("MOBILE_QUOTATION_THEME",e))}}
export async function POST(request:Request,c:{params:Promise<{id:string}>}){try{
 const u=await authenticateMobileToken(request.headers.get("authorization"));
 const result=await saveQuotationThemeForActor(mobileAccountActor(u),(await c.params).id,await request.json());return mobileJson(result);
}catch(e){return mobileUnauthorized(e)??mobileAuthorizationFailure(e)??(e instanceof z.ZodError?mobileJson({error:"INVALID_INPUT"},400):e instanceof Error&&e.message==="NOT_FOUND"?mobileJson({error:"NOT_FOUND"},404):e instanceof Error&&e.message==="SUBSCRIPTION_REQUIRED"?mobileJson({error:"SUBSCRIPTION_REQUIRED"},403):mobileUnexpected("MOBILE_QUOTATION_THEME_SAVE",e))}}

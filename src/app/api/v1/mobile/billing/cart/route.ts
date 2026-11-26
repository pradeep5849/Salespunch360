import {MobileCompanyError} from "@/lib/mobile/company";
import {z} from "zod";
import {authenticateMobileSalesToken,mobileCan} from "@/lib/mobile/auth";
import {mobileBillingQuote} from "@/lib/mobile/billing";
import {readBillingCart,writeBillingCart,cartMutationSchema,cartSelectionSchema} from "@/lib/billing/cart";
import {mobileJson,mobileUnauthorized,mobileUnexpected} from "@/lib/mobile/http";
async function principal(r:Request){
 const p=await authenticateMobileSalesToken(r.headers.get("authorization"));
 return p;
}
async function view(p:Awaited<ReturnType<typeof principal>>){
 const cart=await readBillingCart(p.companyId);
 const selection=cartSelectionSchema.safeParse(cart?.selection);
 return {revision:cart?.revision??0,selection:selection.success?selection.data:null,quote:selection.success?await mobileBillingQuote(p,selection.data):null};
}
function failure(e:unknown){
 if(e instanceof MobileCompanyError)return mobileJson({error:e.code},e.status);
 if(e instanceof z.ZodError)return mobileJson({error:"INVALID_INPUT"},400);
 if(e instanceof Error&&e.message==="CART_REVISION_CONFLICT")return mobileJson({error:"CART_REVISION_CONFLICT"},409);
 return mobileUnauthorized(e)??mobileUnexpected("MOBILE_BILLING_CART",e);
}
export async function GET(r:Request){try{
 const p=await principal(r);if(p.salesRole!=="PRIMARY_ADMIN"||!mobileCan(p,"SALES_BILLING"))return mobileJson({error:"FORBIDDEN"},403);
 return mobileJson(await view(p));
}catch(e){return failure(e)}}
export async function PUT(r:Request){try{
 const p=await principal(r);if(p.salesRole!=="PRIMARY_ADMIN"||!mobileCan(p,"SALES_BILLING"))return mobileJson({error:"FORBIDDEN"},403);
 const input=cartMutationSchema.parse(await r.json());
 if(input.selection)await mobileBillingQuote(p,input.selection);
 await writeBillingCart(p.companyId,input);
 return mobileJson(await view(p));
}catch(e){return failure(e)}}

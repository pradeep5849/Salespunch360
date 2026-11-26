import {billingQuoteForCompany} from "@/lib/mobile/billing";
import {z} from "zod";
import {requirePermissionForMutation} from "@/lib/auth/authorization";
import {readBillingCart,writeBillingCart,cartMutationSchema,cartSelectionSchema} from "@/lib/billing/cart";
const headers={"Cache-Control":"no-store"};
async function actor(){const user=await requirePermissionForMutation("SALES_BILLING");if(!user.companyId)throw new Error("FORBIDDEN");return user.companyId;}
async function view(companyId:string){const cart=await readBillingCart(companyId);const parsed=cartSelectionSchema.safeParse(cart?.selection);return {revision:cart?.revision??0,selection:parsed.success?parsed.data:null};}
function failure(e:unknown){const code=e instanceof Error?e.message:"";return Response.json({error:e instanceof z.ZodError?"INVALID_INPUT":code==="CART_REVISION_CONFLICT"?code:"CART_REQUEST_FAILED"},{status:e instanceof z.ZodError?400:code==="CART_REVISION_CONFLICT"?409:403,headers});}
export async function GET(){try{return Response.json(await view(await actor()),{headers});}catch(e){return failure(e);}}
export async function PUT(r:Request){if(r.headers.get("origin")!=="https://www.salespunch360.com")return Response.json({error:"INVALID_ORIGIN"},{status:403,headers});try{const companyId=await actor();const input=cartMutationSchema.parse(await r.json());if(input.selection)await billingQuoteForCompany(companyId,input.selection);await writeBillingCart(companyId,input);return Response.json(await view(companyId),{headers});}catch(e){return failure(e);}}

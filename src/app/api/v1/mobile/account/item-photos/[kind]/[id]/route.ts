import {itemPhotoForm} from "@/lib/account/item-photo-upload";
import {authenticateMobileToken} from "@/lib/mobile/auth";
import {permit} from "@/lib/mobile/account-transactions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {itemPhotoForActor,saveItemPhotoForActor} from "@/lib/account/item-photos";
import {mobileJson,mobileUnauthorized,mobileAuthorizationFailure,mobileUnexpected} from "@/lib/mobile/http";
const failure=(error:unknown)=>error instanceof Error&&error.message==="ITEMS_DISABLED"?mobileJson({error:"ITEMS_DISABLED"},403):error instanceof Error&&error.message==="INVALID_ITEM_PHOTO"?mobileJson({error:"INVALID_ITEM_PHOTO"},400):error instanceof Error&&error.message==="ITEM_PHOTO_NOT_FOUND"?mobileJson({error:"ITEM_PHOTO_NOT_FOUND"},404):mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_ITEM_PHOTO",error);
type Context={params:Promise<{kind:string;id:string}>};
export async function GET(request:Request,context:Context){try{const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_STOCK");return new Response(new Uint8Array(await itemPhotoForActor(actor,await context.params)),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})}catch(error){return failure(error)}}
export async function POST(request:Request,context:Context){try{const actor=permit(await authenticateMobileToken(request.headers.get("authorization")),"ACCOUNT_STOCK");await assertOperationalWrite(actor.companyId);if(Number(request.headers.get("content-length"))>5*1024*1024+65536)return mobileJson({error:"INVALID_ITEM_PHOTO"},413);const form=await itemPhotoForm(request),file=form.get("photo");if(!(file instanceof File))return mobileJson({error:"INVALID_ITEM_PHOTO"},400);return mobileJson(await saveItemPhotoForActor(actor,await context.params,file))}catch(error){return failure(error)}}

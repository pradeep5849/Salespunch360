import {requirePermission} from "@/lib/auth/authorization";
import {itemPhotoForActor} from "@/lib/account/item-photos";
export async function GET(_:Request,{params}:{params:Promise<{kind:string;id:string}>}){
 try{const actor=await requirePermission("ACCOUNT_STOCK");if(!actor.companyId)return new Response("Not found",{status:404});return new Response(new Uint8Array(await itemPhotoForActor({...actor,companyId:actor.companyId},await params)),{headers:{"Content-Type":"image/webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})}
 catch{return new Response("Item photo unavailable",{status:404})}
}

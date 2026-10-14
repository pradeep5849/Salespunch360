import {requirePermission,AuthorizationError} from "@/lib/auth/authorization";
import {isRedirectError} from "next/dist/client/components/redirect-error";
import {transferImageForActor} from "@/lib/account/money-transfer-image";
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const actor=await requirePermission("ACCOUNT_MONEY_VIEW");if(!actor.companyId)throw new AuthorizationError();
  const row=await transferImageForActor({...actor,companyId:actor.companyId},(await params).id);
  return new Response(new Uint8Array(row.data),{headers:{"Content-Type":row.mimeType,"Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});
 }catch(error){if(isRedirectError(error))throw error;const status=error instanceof AuthorizationError?403:error instanceof Error&&["TRANSFER_NOT_FOUND","TRANSFER_IMAGE_NOT_FOUND"].includes(error.message)?404:503;return Response.json({error:status===403?"Image access denied.":"Transfer image unavailable."},{status,headers:{"Cache-Control":"private, no-store"}});}
}

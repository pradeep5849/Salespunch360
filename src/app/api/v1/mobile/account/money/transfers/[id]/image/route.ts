import {authenticateMobileToken} from "@/lib/mobile/auth";
import {mobileMoneyTransferImage} from "@/lib/mobile/account-money";
import {mobileUnauthorized,mobileAuthorizationFailure,mobileUnexpected,mobileJson} from "@/lib/mobile/http";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const row=await mobileMoneyTransferImage(await authenticateMobileToken(request.headers.get("authorization")),(await params).id);return new Response(new Uint8Array(row.data),{headers:{"Content-Type":row.mimeType,"Content-Disposition":`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox"}});}
 catch(error){if(error instanceof Error&&["TRANSFER_NOT_FOUND","TRANSFER_IMAGE_NOT_FOUND"].includes(error.message))return mobileJson({error:"NOT_FOUND"},404);return mobileUnauthorized(error)??mobileAuthorizationFailure(error)??mobileUnexpected("MOBILE_TRANSFER_IMAGE",error);}
}

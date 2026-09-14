import { authenticateMobileToken } from "@/lib/mobile/auth";
import { mobileJson, mobileUnauthorized, mobileUnexpected } from "@/lib/mobile/http";
import { issueWebHandoff } from "@/lib/mobile/web-session";

export async function POST(request:Request){
 try{const principal=await authenticateMobileToken(request.headers.get("authorization"));const body:unknown=await request.json();if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some(key=>key!=="redirectPath"))return mobileJson({error:"INVALID_INPUT"},400);return mobileJson(await issueWebHandoff(principal,(body as {redirectPath?:unknown}).redirectPath));}
 catch(error){const auth=mobileUnauthorized(error);if(auth)return auth;if(error instanceof SyntaxError||error instanceof Error&&error.message==="INVALID_INPUT")return mobileJson({error:"INVALID_INPUT"},400);return mobileUnexpected("MOBILE_WEB_SESSION",error)}
}

import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ACCOUNT_ORIGIN, consumeWebHandoff } from "@/lib/mobile/web-session";

const safeHeaders={"Cache-Control":"no-store","Referrer-Policy":"no-referrer"};
export async function POST(request:Request){
 try{
  const contentType=request.headers.get("content-type")??"";if(!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded"))throw new Error("INVALID_HANDOFF");
  const form=await request.formData(),code=form.get("code");if(typeof code!=="string")throw new Error("INVALID_HANDOFF");
  const session=await consumeWebHandoff(code),response=NextResponse.redirect(new URL(session.redirectPath,ACCOUNT_ORIGIN),303);
  response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");
  response.cookies.set("sp360_session",session.webToken,{httpOnly:true,secure:env.NODE_ENV==="production",sameSite:"lax",path:"/",expires:session.expiresAt});return response;
 }catch{const response=NextResponse.redirect(new URL("/sign-in",ACCOUNT_ORIGIN),303);Object.entries(safeHeaders).forEach(([key,value])=>response.headers.set(key,value));return response;}
}

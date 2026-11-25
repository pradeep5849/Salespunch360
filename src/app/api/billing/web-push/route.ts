import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashSessionToken } from "@/lib/auth/crypto";
import { requirePermissionForMutation } from "@/lib/auth/authorization";
const schema=z.object({token:z.string().min(20).max(4096)});
export async function POST(request:Request){
 try{
  if(request.headers.get("origin")!=="https://www.salespunch360.com")return Response.json({error:"FORBIDDEN"},{status:403});
  const actor=await requirePermissionForMutation("SALES_BILLING");
  const cookie=(await cookies()).get("sp360_session")?.value;
  if(!actor.companyId||!cookie)return Response.json({error:"FORBIDDEN"},{status:403});
  const session=await db.session.findFirst({where:{tokenHash:hashSessionToken(cookie),userId:actor.id,expiresAt:{gt:new Date()},mobileSessionId:null},select:{id:true}});
  if(!session)return Response.json({error:"FORBIDDEN"},{status:403});
  const {token}=schema.parse(await request.json());
  const data={companyId:actor.companyId,userId:actor.id,sessionId:session.id};
  await db.webPushDevice.upsert({where:{fcmToken:token},create:{...data,fcmToken:token},update:data});
  return Response.json({ok:true},{headers:{"Cache-Control":"no-store"}});
 }catch{return Response.json({error:"REGISTRATION_FAILED"},{status:400});}
}

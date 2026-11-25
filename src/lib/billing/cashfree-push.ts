import {createHash} from "node:crypto";
import { db } from "@/lib/db";
import { sendFcm,isInvalidFcmToken } from "@/lib/push/firebase";
export async function notifyCashfreePush(companyId:string,orderId:string){
 const devices=await db.pushDevice.findMany({where:{companyId,mobileSession:{revokedAt:null,expiresAt:{gt:new Date()},user:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]}}}},select:{id:true,fcmToken:true}});
 const results=await Promise.allSettled(devices.map(async device=>{
  const key="BILLING_PUSH_SENT:"+orderId+":"+createHash("sha256").update(device.fcmToken).digest("hex");
  const prior=await db.fieldJob.findUnique({where:{key},select:{completedAt:true}});
  if(prior?.completedAt)return;
  try{const sent=await sendFcm({token:device.fcmToken,notification:{title:"SalesPunch360 test payment",body:"Payment confirmed. Open Billing to review your subscription."},data:{eventType:"BILLING_PAYMENT_CAPTURED",orderId},android:{notification:{tag:"billing-"+orderId}}});if(!sent)throw new Error("FCM_NOT_CONFIGURED");
  await db.fieldJob.upsert({where:{key},create:{key,companyId,kind:"BILLING_PUSH_SENT",payload:{orderId},completedAt:new Date()},update:{completedAt:new Date()}});}
  catch(error){if(isInvalidFcmToken(error))await db.pushDevice.deleteMany({where:{id:device.id,fcmToken:device.fcmToken}});else throw error;}
 }));
 if(results.some(result=>result.status==="rejected"))throw new Error("BILLING_PUSH_DELIVERY_FAILED");
}

import { db } from "@/lib/db";
import { sendFcm,isInvalidFcmToken } from "@/lib/push/firebase";
export async function notifyCashfreePush(companyId:string,orderId:string){
 const devices=await db.pushDevice.findMany({where:{companyId,mobileSession:{revokedAt:null,expiresAt:{gt:new Date()},user:{companyId,isActive:true,salesAccessActive:true,salesRole:{in:["PRIMARY_ADMIN","ADMIN"]}}}},select:{id:true,fcmToken:true}});
 await Promise.allSettled(devices.map(async device=>{
  try{await sendFcm({token:device.fcmToken,notification:{title:"SalesPunch360 test payment",body:"Payment confirmed. Open Billing to review your subscription."},data:{eventType:"BILLING_PAYMENT_CAPTURED",orderId},android:{notification:{tag:"billing-"+orderId}}});}
  catch(error){if(isInvalidFcmToken(error))await db.pushDevice.deleteMany({where:{id:device.id,fcmToken:device.fcmToken}});else throw error;}
 }));
}

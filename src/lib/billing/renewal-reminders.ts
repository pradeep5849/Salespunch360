import { db } from "@/lib/db";
import { notifySalesAdmins } from "@/lib/sales-notifications/service";
import { notifyCashfreePush } from "./cashfree-push";
import { sendTransactionalEmail } from "@/lib/email/mailer";
import { createHash } from "node:crypto";
const day=86400000;
const indiaDay=(date:Date)=>Math.floor((date.getTime()+330*60000)/day);
export async function generateBillingRenewalReminders(now=new Date()){
 const today=indiaDay(now);
 const subscriptions=await db.companySubscription.findMany({where:{status:"ACTIVE",startsAt:{lte:now},endsAt:{gt:now,lte:new Date(now.getTime()+31*day)}},select:{id:true,companyId:true,endsAt:true}});
 for(const sub of subscriptions){
  const remaining=indiaDay(sub.endsAt)-today;
  if(![30,7,1].includes(remaining))continue;
  const later=await db.companySubscription.findFirst({where:{companyId:sub.companyId,status:"ACTIVE",startsAt:{lte:sub.endsAt},endsAt:{gt:sub.endsAt}},select:{id:true}});
  if(later)continue;
  await notifySalesAdmins(db,{companyId:sub.companyId,eventType:"BILLING_RENEWAL_REMINDER",title:"Subscription renewal reminder",body:`A subscription expires in ${remaining} day(s). Review Billing to renew.`,relatedEntityType:"SUBSCRIPTION",relatedEntityId:sub.id,navigationTarget:"/workspace/billing",dedupeKey:`BILLING_RENEWAL:${sub.id}:${sub.endsAt.toISOString()}:${remaining}`});
  const reminderId=sub.id+":"+remaining+":"+indiaDay(sub.endsAt);
  const admins=await db.user.findMany({where:{companyId:sub.companyId,isActive:true,OR:[{role:"COMPANY_ADMIN"},{salesRole:"PRIMARY_ADMIN"},{accountRole:"ACCOUNT_ADMIN"}]},select:{email:true}});
  const recipients=[...new Set(admins.map(a=>a.email).filter(Boolean))];
  const results=await Promise.allSettled([
   notifyCashfreePush(sub.companyId,reminderId,{subscriptionId:sub.id,days:remaining}),
   ...recipients.map(async email=>{
    const key="RENEWAL_EMAIL:"+reminderId+":"+createHash("sha256").update(email.toLowerCase()).digest("hex");
    if((await db.fieldJob.findUnique({where:{key},select:{completedAt:true}}))?.completedAt)return;
    await sendTransactionalEmail(email,"SalesPunch360 subscription renewal reminder",`Your subscription expires in ${remaining} day(s). Expiry: ${sub.endsAt.toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"})}. Review https://www.salespunch360.com/workspace/billing to renew.`);
    await db.fieldJob.upsert({where:{key},create:{key,companyId:sub.companyId,kind:"RENEWAL_EMAIL_SENT",payload:{subscriptionId:sub.id},completedAt:new Date()},update:{completedAt:new Date()}});
   })
  ]);
  if(results.some(r=>r.status==="rejected"))throw new Error("RENEWAL_DELIVERY_FAILED");
 }
}

import { db } from "@/lib/db";
import { notifySalesAdmins } from "@/lib/sales-notifications/service";
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
 }
}

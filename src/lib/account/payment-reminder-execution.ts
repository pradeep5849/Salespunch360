import {db} from "@/lib/db";
import {documentOutstandingsBatch} from "./commercial";
import {indiaDateText,parseIndiaBusinessDate} from "@/lib/follow-up-tasks/date";
import {formatMoney,formatCalendarDate,resolveDisplayPreferences} from "./display-preferences";
import {prepareServiceMessage} from "./service-reminders";
/** Latest scheduled slot in Indian business time. Repeated sweeps share the same key. */
export function paymentReminderSlot(frequency:string,now:Date){
 const date=indiaDateText(now),today=parseIndiaBusinessDate(date);
 const hour=Number(new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kolkata",hour:"2-digit",hourCycle:"h23"}).format(now));
 if(frequency==="WEEKLY"){const monday=new Date(today);monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7);if(monday.getTime()===today.getTime()&&hour<9)monday.setUTCDate(monday.getUTCDate()-7);return new Date(monday.getTime()+3.5*3600000)}
 const hours=frequency==="THREE_DAILY"?[9,13,17]:frequency==="TWICE_DAILY"?[9,17]:[9];
 let slot=hours.filter(x=>x<=hour).at(-1);if(slot===undefined){today.setUTCDate(today.getUTCDate()-1);slot=hours.at(-1)!}
 return new Date(today.getTime()+(slot-5.5)*3600000);
}
/** Internal maintenance job only: creates reminders for the account user to send manually. */
export async function generateAccountPaymentReminders(now=new Date()){
 const settings=await db.accountSettings.findMany({where:{transactionDefaults:{path:["reminderSettings","payment","enabled"],equals:true}}});let created=0;
 for(const config of settings){
  const defaults=(config.transactionDefaults??{}) as Record<string,unknown>,reminders=(defaults.reminderSettings??{}) as Record<string,unknown>,p=(reminders.payment??{}) as Record<string,unknown>;
  const days=typeof p.overdueDays==="number"?p.overdueDays:0,slot=paymentReminderSlot(String(p.frequency??"ONCE_DAILY"),now),cutoff=parseIndiaBusinessDate(indiaDateText(slot));cutoff.setUTCDate(cutoff.getUTCDate()-days);
  const docs=await db.commercialDocument.findMany({where:{companyId:config.companyId,type:"SALES_INVOICE",status:"POSTED",customerId:{not:null},dueDate:{lte:cutoff}},select:{id:true,customerId:true,createdById:true,partyName:true,grandTotal:true,payableAmount:true,documentNumber:true,dueDate:true}});
  const outstanding=await documentOutstandingsBatch(config.companyId,docs),prefs=resolveDisplayPreferences(config);
  for(const doc of docs){const amount=outstanding.get(doc.id);if(!amount?.gt(0))continue;
   const template=typeof p.message==="string"?p.message:"Dear {party}, payment of {amount} is overdue. Please arrange payment at the earliest.";
   const message=prepareServiceMessage(template,{party:doc.partyName,amount:formatMoney(amount,prefs),document:doc.documentNumber,date:formatCalendarDate(doc.dueDate!,prefs)}).slice(0,1000);
   const added=await db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payment-reminder:${config.companyId}:${doc.id}:${slot.toISOString()}`}))`;
    const existing=await tx.paymentReminder.findFirst({where:{companyId:config.companyId,documentId:doc.id,remindAt:slot}});if(existing)return false;
    const current=await tx.commercialDocument.findFirst({where:{companyId:config.companyId,id:doc.id,status:"POSTED"},select:{id:true}});if(!current)return false;
    await tx.paymentReminder.create({data:{companyId:config.companyId,documentId:doc.id,customerId:doc.customerId!,createdById:doc.createdById,remindAt:slot,message,status:"PENDING"}});return true;
   });if(added)created++;
  }
 }
 return {companies:settings.length,created};
}
export async function duePaymentReminders(actor:{companyId:string|null;branchAccessScope?:string|null;branchIds?:string[]},now=new Date()){
 if(!actor.companyId)return [];
 const settings=await db.accountSettings.findUnique({where:{companyId:actor.companyId}});
 const defaults=(settings?.transactionDefaults??{}) as Record<string,unknown>,reminders=(defaults.reminderSettings??{}) as Record<string,unknown>,payment=(reminders.payment??{}) as Record<string,unknown>;
 if(payment.enabled!==true)return [];
 const cutoff=parseIndiaBusinessDate(indiaDateText(now));cutoff.setUTCDate(cutoff.getUTCDate()-(typeof payment.overdueDays==="number"?payment.overdueDays:0));
 const prefs=resolveDisplayPreferences(settings),template=typeof payment.message==="string"?payment.message:"Dear {party}, payment of {amount} is overdue. Please arrange payment at the earliest.";
 const rows=await db.paymentReminder.findMany({where:{companyId:actor.companyId,status:"PENDING",remindAt:{lte:now},document:{status:"POSTED",dueDate:{lte:cutoff},...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}},orderBy:{remindAt:"desc"},include:{customer:{select:{phone:true}},document:{select:{id:true,partyName:true,documentNumber:true,grandTotal:true,payableAmount:true,dueDate:true}}}});
 const amounts=await documentOutstandingsBatch(actor.companyId,rows.map(x=>x.document));
 const seen=new Set<string>();return rows.filter(x=>{if(seen.has(x.documentId)||!amounts.get(x.documentId)?.gt(0))return false;seen.add(x.documentId);return true}).map(x=>({id:x.id,type:"PAYMENT_REMINDER",documentId:x.documentId,documentNumber:x.document.documentNumber,partyName:x.document.partyName,dueDate:x.remindAt.toISOString(),message:prepareServiceMessage(template,{party:x.document.partyName,amount:formatMoney(amounts.get(x.documentId)!,prefs),document:x.document.documentNumber,date:formatCalendarDate(x.document.dueDate??x.remindAt,prefs)}),phone:x.customer.phone}));
}

import {completedServiceReminderLines} from "./service-reminder-lineage";
import {commercialBaseQuantity} from "./commercial-stock-quantity";
import {indiaDateText,parseIndiaBusinessDate} from "@/lib/follow-up-tasks/date";
import {db} from "@/lib/db";
import {Prisma} from "@prisma/client";
import {formatCalendarDate,resolveDisplayPreferences} from "./display-preferences";
const activeReminderSale={type:"SALES_INVOICE",status:"POSTED",OR:[{journalEntryId:null},{journalEntry:{is:{status:"POSTED"}}}],lifecycleSnapshot:{is:null}} satisfies Prisma.CommercialDocumentWhereInput;
type Actor={companyId:string|null;branchAccessScope?:string|null;branchIds?:string[]};
export function serviceReminderDate(issueDate:Date,periodDays:number){
 if(!Number.isInteger(periodDays)||periodDays<1||periodDays>3650)throw new Error("INVALID_SERVICE_PERIOD");
 const result=new Date(issueDate);result.setUTCDate(result.getUTCDate()+periodDays);return result;
}
export function prepareServiceMessage(template:string,values:Record<string,string>){return template.replace(/\{([^}]+)\}/g,(token,key:string)=>values[key]??token)}
export async function dueServiceReminders(actor:Actor,now=new Date()){
 if(!actor.companyId)return [];
 const settings=await db.accountSettings.findUnique({where:{companyId:actor.companyId}});
 const defaults=(settings?.transactionDefaults as Record<string,unknown>|null)??{};
 const reminders=(defaults.reminderSettings as Record<string,unknown>|undefined)??{};
 const service=(reminders.service as Record<string,unknown>|undefined)??{};
 const ids=Array.isArray(service.selectedItemIds)?service.selectedItemIds.filter((x):x is string=>typeof x==="string"):[];
 if(service.enabled!==true||!ids.length||typeof service.periodDays!=="number")return [];
 const period=service.periodDays;
 if(!Number.isInteger(period)||period<1||period>3650)return [];
 const today=parseIndiaBusinessDate(indiaDateText(now));
 const cutoff=new Date(today);cutoff.setUTCDate(cutoff.getUTCDate()-1);
 const [company,rows]=await Promise.all([
 db.company.findUnique({where:{id:actor.companyId},select:{name:true,primaryPhone:true,contactEmail:true}}),
 db.commercialDocument.findMany({where:{companyId:actor.companyId,...activeReminderSale,issueDate:{lte:cutoff},...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{}),lines:{some:{OR:[{productId:{in:ids}},{serviceId:{in:ids}}]}}},orderBy:{issueDate:"desc"},select:{id:true,documentNumber:true,issueDate:true,partyName:true,customer:{select:{phone:true}},returnRevisionTarget:{select:{credits:{where:{creditNote:{status:"POSTED",journalEntry:{is:{status:"POSTED"}}}},select:{lines:{select:{invoiceLineId:true,quantity:true}}}}}},adjustments:{where:{type:"CREDIT_NOTE",status:"POSTED",OR:[{journalEntryId:null},{journalEntry:{is:{status:"POSTED"}}}]},select:{lines:{select:{sourceCommercialLineId:true,quantity:true,baseQuantity:true}}}},lines:{where:{OR:[{productId:{in:ids}},{serviceId:{in:ids}}]},select:{id:true,itemName:true,quantity:true,baseQuantity:true,servicePeriodDays:true}}}})
 ]);
 const prefs=resolveDisplayPreferences(settings);
 const template=typeof service.message==="string"?service.message:"Hi {Party name}, your next service for {Item name} is due on {reminder date}. Please contact us to book an appointment. Regards, {Company name}.";
 const completed=await completedServiceReminderLines(actor.companyId,rows);
 return rows.flatMap(row=>row.lines.filter(line=>{
 const credited=row.adjustments.flatMap(adjustment=>adjustment.lines).filter(credit=>credit.sourceCommercialLineId===line.id).reduce((sum,credit)=>sum.add(commercialBaseQuantity(credit)),new Prisma.Decimal(0)).add((row.returnRevisionTarget?.credits??[]).flatMap(credit=>credit.lines).filter(binding=>binding.invoiceLineId===line.id).reduce((sum,binding)=>sum.add(binding.quantity),new Prisma.Decimal(0)));
 return commercialBaseQuantity(line).gt(credited)&&!completed.has(line.id)&&serviceReminderDate(row.issueDate,line.servicePeriodDays??period)<=today;
 }).map(line=>{const due=serviceReminderDate(row.issueDate,line.servicePeriodDays??period),date=formatCalendarDate(due,prefs);return {id:`SERVICE:${row.id}:${line.id}`,type:"SERVICE_REMINDER",documentId:row.id,lineId:line.id,documentNumber:row.documentNumber,partyName:row.partyName,itemName:line.itemName,dueDate:due.toISOString(),phone:row.customer?.phone??null,message:prepareServiceMessage(template,{"Party name":row.partyName,"Item name":line.itemName,"reminder date":date,"Company name":company?.name??"","Contact No.":company?.primaryPhone??"","Email ID":company?.contactEmail??""})}}));
}

export async function completeServiceReminder(actor:Actor&{id:string},lineId:string){
 if(!actor.companyId)throw new Error("INVALID_SERVICE_REMINDER");
 const reminder=(await dueServiceReminders(actor)).find(row=>row.lineId===lineId);
 if(!reminder)throw new Error("INVALID_SERVICE_REMINDER");
 return db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT "id" FROM "companies" WHERE "id"=${actor.companyId}::uuid FOR UPDATE`;
  const existing=await tx.serviceReminderCompletion.findUnique({where:{companyId_lineId:{companyId:actor.companyId!,lineId}}});
  if(existing)return existing;
  const source=await tx.commercialDocumentLine.findFirst({where:{companyId:actor.companyId!,id:lineId,document:{...activeReminderSale,...(actor.branchAccessScope==="SELECTED_BRANCHES"?{branchId:{in:actor.branchIds??[]}}:{})}},select:{id:true}});
  if(!source)throw new Error("INVALID_SERVICE_REMINDER");
  const result=await tx.serviceReminderCompletion.upsert({where:{companyId_lineId:{companyId:actor.companyId!,lineId}},create:{companyId:actor.companyId!,lineId,completedById:actor.id},update:{}});
  await tx.accountOperationalAudit.create({data:{companyId:actor.companyId!,actorUserId:actor.id,eventType:"SERVICE_REMINDER_COMPLETED",entityType:"COMMERCIAL_DOCUMENT_LINE",entityId:lineId,metadata:{documentId:reminder.documentId}}});
  return result;
 });
}

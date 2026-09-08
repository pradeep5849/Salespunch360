import type { LeadSource, LeadStage, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { leadValues } from "./metrics";
import { indiaDateBoundary, parseReportFilters, type SearchParams } from "./validation";
import { REPORT_TIME_ZONE } from "./config";
import { reportActor, reportEmployeeOptions, resolveEmployeeScope, type ReportActor } from "./scope";

const stages=["NEW","QUALIFIED","PROPOSAL","NEGOTIATION","WON","LOST"] as const;const sources=["MANUAL","CUSTOMER_VISIT","REFERRAL","PHONE","EMAIL","WEBSITE","OTHER"] as const;
export async function leadReport(raw:SearchParams,providedActor?:ReportActor,exportMode=false){
 const actor=providedActor??await reportActor(),filters=parseReportFilters(raw,undefined,exportMode?10000:undefined),ids=await resolveEmployeeScope(actor,filters.employeeId),stage=stages.includes(raw.stage as LeadStage)?raw.stage as LeadStage:undefined,source=sources.includes(raw.source as LeadSource)?raw.source as LeadSource:undefined,follow=typeof raw.followUp==="string"?raw.followUp:"ALL";
 const now=new Date(),todayText=new Intl.DateTimeFormat("en-CA",{timeZone:REPORT_TIME_ZONE}).format(now),todayStart=indiaDateBoundary(todayText),tomorrow=indiaDateBoundary(todayText,true);
 const followUpAt=follow==="OVERDUE"?{lt:todayStart}:follow==="TODAY"?{gte:todayStart,lt:tomorrow}:follow==="UPCOMING"?{gte:tomorrow}:follow==="NONE"?null:undefined;
 const where:Prisma.LeadWhereInput={companyId:actor.companyId,assignedUserId:{in:ids},createdAt:{gte:filters.start,lt:filters.endExclusive},stage,source,followUpAt,...(filters.q?{OR:[{title:{contains:filters.q,mode:"insensitive"}},{companyName:{contains:filters.q,mode:"insensitive"}},{contactName:{contains:filters.q,mode:"insensitive"}},{customer:{name:{contains:filters.q,mode:"insensitive"}}}]}:{})};
 const [total,all,rows,employees]=await Promise.all([db.lead.count({where}),db.lead.findMany({where,select:{stage:true,estimatedValue:true,sourceVisitId:true,followUpAt:true},take:10001}),db.lead.findMany({where,include:{assignedUser:{select:{name:true,salesRole:true}},customer:{select:{name:true}}},orderBy:[{createdAt:"desc"},{id:"desc"}],skip:(filters.page-1)*filters.pageSize,take:filters.pageSize}),reportEmployeeOptions(actor)]);if(all.length>10000)throw new Error(exportMode?"ROW_LIMIT":"Report summary exceeds the interactive record limit; narrow the filters.");
 const counts=Object.fromEntries(stages.map(s=>[s,all.filter(l=>l.stage===s).length])) as Record<LeadStage,number>,values=leadValues(all),overdue=all.filter(l=>l.followUpAt&&l.followUpAt<now&&!(["WON","LOST"] as LeadStage[]).includes(l.stage)).length;
 return {actor,filters,stage,source,follow,employees,rows,totalPages:Math.max(1,Math.ceil(total/filters.pageSize)),summary:{total,counts,pipelineValue:values.pipeline.toFixed(2),wonValue:values.won.toFixed(2),visitGenerated:all.filter(l=>l.sourceVisitId).length,overdue,won:counts.WON,conversionRate:total?counts.WON/total:null}};
}

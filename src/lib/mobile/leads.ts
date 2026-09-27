import type {Prisma} from '@prisma/client';
import {db} from '@/lib/db';
import {createLeadFromVisitForActor,editLeadForActor,getLeadForActor,listLeadsPageForActor} from '@/lib/leads/service';
import {transitionLeadWithProjectForActor} from '@/lib/leads/transition-with-project';
import {ensureWonLeadProjectForActor} from '@/lib/leads/won-project';
import {addPhoneToVisitForUser} from '@/lib/visits/service';
import {mobileFieldWorkEnabled,type MobilePrincipal} from './auth';
import {mobileLeadDetail} from './lead-detail';
import {mobilePendingLeadPage} from './pending-leads';
import{createFollowUpTaskForActor}from'@/lib/follow-up-tasks/service';
import{createLeadFromVisitSchema,transitionLeadSchema}from'@/lib/leads/validation';
import{z}from'zod';
const actor=(u:MobilePrincipal)=>u;
const withVisitCount=<T extends {visits?:unknown[];updatedAt?:Date;assignedUserId?:string;estimatedValue?:unknown}>(lead:T,u:MobilePrincipal)=>({...lead,visitCount:lead.visits?.length??0,updatedAt:lead.updatedAt??null,estimatedValue:lead.estimatedValue==null?null:String(lead.estimatedValue),canAddCheckIn:u.salesRole!=='PRIMARY_ADMIN'&&u.salesRole!=='ADMIN'&&lead.assignedUserId===u.id,canDelete:(u.salesRole==='PRIMARY_ADMIN'||u.salesRole==='ADMIN'||lead.assignedUserId===u.id)});
export async function mobileLeads(u:MobilePrincipal,raw:unknown,paginated=false){
 const page=await listLeadsPageForActor(actor(u),raw);
 const leads=page.items.map(lead=>{
  const {visits,sourceVisit,_count,...rest}=lead;
  const latest=[visits[0],sourceVisit].filter(v=>v!=null).sort((a,b)=>b.checkedInAt.getTime()-a.checkedInAt.getTime())[0];
  const latestVisit=latest?[{id:latest.id,userName:latest.user.name,checkedInAt:latest.checkedInAt,checkedOutAt:latest.checkedOutAt,checkInAddress:latest.checkInAddress??`${latest.checkInLatitude.toFixed(5)}, ${latest.checkInLongitude.toFixed(5)}`,visitNotes:latest.visitNotes}]:[];
  return{...withVisitCount({...rest,visits:latestVisit},u),visitCount:_count.visits+(sourceVisit&&sourceVisit.leadId!==lead.id?1:0)};
 });
 return paginated?{leads,page:page.page,pageSize:page.pageSize,hasMore:page.hasMore}:leads;
}
export async function mobileLeadScopeOptions(u:MobilePrincipal){const where:Prisma.UserWhereInput=u.salesRole==='PRIMARY_ADMIN'||u.salesRole==='ADMIN'?{companyId:u.companyId,isActive:true,salesAccessActive:true,salesRole:{in:['MANAGER','SALES']}}:u.salesRole==='MANAGER'?{companyId:u.companyId,isActive:true,salesAccessActive:true,...(u.managerType==='MANAGER_ONLY'?{salesRole:'SALES',managerId:u.id}:{OR:[{id:u.id,salesRole:'MANAGER'},{salesRole:'SALES',managerId:u.id}]})}:{companyId:u.companyId,id:u.id,isActive:true,salesAccessActive:true};return db.user.findMany({where,select:{id:true,name:true,salesRole:true,managerType:true},orderBy:{name:'asc'}})}
export async function mobilePendingLeads(u:MobilePrincipal,raw:Record<string,string|undefined>={}){return mobilePendingLeadPage(u,raw)}
export async function mobileAddPendingPhone(u:MobilePrincipal,raw:unknown){if(!mobileFieldWorkEnabled(u))throw new Error('NOT_FOUND');if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const d=raw as Record<string,unknown>;return addPhoneToVisitForUser(u,{visitId:d.visitId,phone:d.phone})}
export async function mobileLead(u:MobilePrincipal,id:string){const lead=await mobileLeadDetail(u,id);if(!lead)throw new Error('NOT_FOUND');if(lead.stage==='WON')await ensureWonLeadProjectForActor({id:u.id,companyId:u.companyId},lead.id);const {sourceVisit,_count,visitCount,...rest}=lead;void sourceVisit;void _count;const normalized={...rest,visits:lead.visits.map(v=>({id:v.id,userName:v.user.name,checkedInAt:v.checkedInAt,checkedOutAt:v.checkedOutAt,checkInAddress:v.checkInAddress,visitNotes:v.visitNotes})),activities:lead.activities.map(a=>({...a,actorUser:{name:a.actorUser.name}}))};return{...withVisitCount(normalized,u),visitCount}}
export async function mobileLeadFromVisit(u:MobilePrincipal,raw:unknown){if(!mobileFieldWorkEnabled(u))throw new Error('NOT_FOUND');if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const input=createLeadFromVisitSchema.parse({...(raw as Record<string,unknown>),assignedUserId:u.id});return createLeadFromVisitForActor(actor(u),input)}
export async function mobileTransitionLead(u:MobilePrincipal,raw:unknown){const input=transitionLeadSchema.parse(raw);const result=await transitionLeadWithProjectForActor(actor(u),input);return{ok:true,projectNumber:result.project?.projectNumber??null}}
export async function mobileFollowUp(u:MobilePrincipal,raw:unknown){if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const requested=raw as Record<string,unknown>,leadId=z.string().uuid().parse(requested.leadId);return createFollowUpTaskForActor(actor(u),{leadId,dueDate:String(requested.followUpAt??'').slice(0,10),notes:requested.notes})}
export async function mobileEditLead(u:MobilePrincipal,raw:unknown){if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const input=raw as Record<string,unknown>;if(input.version==null)throw new Error('CLIENT_UPGRADE_REQUIRED');const leadId=z.string().uuid().parse(input.leadId),current=await getLeadForActor(actor(u),leadId);if(!current)throw new Error('NOT_FOUND');await editLeadForActor(actor(u),{leadId,version:z.number().int().positive().parse(input.version),title:input.title??current.title,customerId:current.customerId??undefined,contactName:input.contactName??current.contactName??undefined,phone:input.phone??current.phone??undefined,email:input.email??current.email??undefined,companyName:input.companyName??current.companyName??undefined,source:current.source,estimatedValue:input.estimatedValue??(current.estimatedValue==null?undefined:String(current.estimatedValue)),currencyCode:input.currencyCode??current.currencyCode,followUpAt:current.followUpAt??undefined,notes:input.notes??current.notes??undefined,assignedUserId:input.assignedUserId??current.assignedUserId});return mobileLead(u,leadId)}

import {createLeadFromVisitForActor,getLeadForActor,listLeadsForActor,transitionLeadForActor} from '@/lib/leads/service';import type {MobilePrincipal} from './auth';import{createFollowUpTaskForActor}from'@/lib/follow-up-tasks/service';
const actor=(u:MobilePrincipal)=>({...u,companyId:u.companyId});
export async function mobileLeads(u:MobilePrincipal,raw:unknown){return listLeadsForActor(actor(u),raw)}
export async function mobileLead(u:MobilePrincipal,id:string){const lead=await getLeadForActor(actor(u),id);if(!lead)throw new Error('NOT_FOUND');return lead}
export async function mobileLeadFromVisit(u:MobilePrincipal,raw:unknown){if(u.role==='COMPANY_ADMIN')throw new Error('NOT_FOUND');if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const input={...(raw as Record<string,unknown>),assignedUserId:u.id};return createLeadFromVisitForActor(actor(u),input)}
export async function mobileTransitionLead(u:MobilePrincipal,raw:unknown){await transitionLeadForActor(actor(u),raw);return{ok:true}}
export async function mobileFollowUp(u:MobilePrincipal,raw:unknown){if(!raw||typeof raw!=='object')throw new Error('INVALID_INPUT');const requested=raw as Record<string,unknown>;return createFollowUpTaskForActor(actor(u),{leadId:requested.leadId,dueDate:String(requested.followUpAt??'').slice(0,10),notes:requested.notes})}

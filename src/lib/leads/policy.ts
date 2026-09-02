import type { LeadStage, Role } from "@prisma/client";
export class LeadError extends Error { constructor(public code:"NOT_FOUND"|"INVALID_ASSIGNMENT"|"STALE"|"TERMINAL"|"INVALID_REFERENCE"|"ACTIVE_FOLLOW_UP"){super(code)} }
type Actor={id:string;role:Role;managerType?:string|null}; type Assignee={id:string;role:Role;managerType?:string|null;isActive:boolean;managerId:string|null};
export function canAssign(actor:Actor,assignee:Assignee){if(!assignee.isActive||!(["MANAGER","SALES"] as Role[]).includes(assignee.role))return false;if(assignee.role==="MANAGER"&&assignee.managerType==="MANAGER_ONLY")return false;if(actor.role==="COMPANY_ADMIN")return true;if(actor.role==="SALES")return assignee.id===actor.id&&assignee.role==="SALES";return actor.role==="MANAGER"&&((actor.managerType!=="MANAGER_ONLY"&&assignee.id===actor.id&&assignee.role==="MANAGER")||(assignee.role==="SALES"&&assignee.managerId===actor.id));}
export function visibilityWhere(actor:Actor){if(actor.role==="COMPANY_ADMIN")return {};if(actor.role==="MANAGER")return actor.managerType==="MANAGER_ONLY"?{assignedUser:{role:"SALES" as const,managerId:actor.id}}:{OR:[{assignedUserId:actor.id},{assignedUser:{role:"SALES" as const,managerId:actor.id}}]};return {assignedUserId:actor.id};}
export const activeStages:LeadStage[]=["NEW","QUALIFIED","PROPOSAL","NEGOTIATION"];
export type PipelineActor={id:string;companyId:string;role:Role};
export function pendingVisitWhere(actor:PipelineActor){return {companyId:actor.companyId,visitType:"NEW" as const,leadId:null,OR:[{contactPhone:null},{contactPhone:""}],...(actor.role==="SALES"?{userId:actor.id}:actor.role==="MANAGER"?(actor.managerType==="MANAGER_ONLY"?{user:{role:"SALES" as const,managerId:actor.id}}:{AND:[{OR:[{userId:actor.id},{user:{role:"SALES" as const,managerId:actor.id}}]}]}):{})};}
export function leadVisitCount(lead:{sourceVisitId:string|null;visits:{id:string}[]}){const ids=new Set(lead.visits.map(v=>v.id));if(lead.sourceVisitId)ids.add(lead.sourceVisitId);return ids.size;}
export function transitionKind(_role:Role,from:LeadStage,to:LeadStage){
 const allowed:Record<LeadStage,LeadStage[]>={NEW:["QUALIFIED"],QUALIFIED:["PROPOSAL"],PROPOSAL:["NEGOTIATION"],NEGOTIATION:["WON","LOST"],WON:[],LOST:[]};
 if(!allowed[from].includes(to))throw new LeadError("TERMINAL");
 return to==="WON"?"WON":to==="LOST"?"LOST":"STAGE_CHANGED";
}

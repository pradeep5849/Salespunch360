import type { LeadStage, Role } from "@prisma/client";
export class LeadError extends Error { constructor(public code:"NOT_FOUND"|"INVALID_ASSIGNMENT"|"STALE"|"TERMINAL"|"INVALID_REFERENCE"){super(code)} }
type Actor={id:string;role:Role}; type Assignee={id:string;role:Role;isActive:boolean;managerId:string|null};
export function canAssign(actor:Actor,assignee:Assignee){if(!assignee.isActive||!(["MANAGER","SALES"] as Role[]).includes(assignee.role))return false;if(actor.role==="COMPANY_ADMIN")return true;if(actor.role==="SALES")return assignee.id===actor.id&&assignee.role==="SALES";return actor.role==="MANAGER"&&((assignee.id===actor.id&&assignee.role==="MANAGER")||(assignee.role==="SALES"&&assignee.managerId===actor.id));}
export function visibilityWhere(actor:Actor){if(actor.role==="COMPANY_ADMIN")return {};if(actor.role==="MANAGER")return {OR:[{assignedUserId:actor.id},{assignedUser:{role:"SALES" as const,managerId:actor.id}}]};return {assignedUserId:actor.id};}
export const activeStages:LeadStage[]=["NEW","QUALIFIED","PROPOSAL","NEGOTIATION"];
export function transitionKind(_role:Role,from:LeadStage,to:LeadStage){
 const allowed:Record<LeadStage,LeadStage[]>={NEW:["QUALIFIED"],QUALIFIED:["PROPOSAL"],PROPOSAL:["NEGOTIATION"],NEGOTIATION:["WON","LOST"],WON:[],LOST:[]};
 if(!allowed[from].includes(to))throw new LeadError("TERMINAL");
 return to==="WON"?"WON":to==="LOST"?"LOST":"STAGE_CHANGED";
}

import {pageWindow,pageResult} from "@/lib/pagination";
import {db} from "@/lib/db";
import {operationalBranchContext} from "@/lib/branches/operational-scope";
import {decodeFollowUpNotes} from "./type";
import {taskActor,taskScope,type TaskActor} from "./service";

export async function listLeadFollowUpTasksForActor(actor:TaskActor,leadId:string){
 const branches=await operationalBranchContext(actor);
 const tasks=await db.followUpTask.findMany({
  where:{AND:[taskScope(actor),{companyId:actor.companyId,branchId:branches.branchId,leadId}]},
  include:{assignedUser:{select:{id:true,name:true}},createdByUser:{select:{id:true,name:true}},completedVisit:{select:{id:true,checkedInAt:true,checkedOutAt:true,user:{select:{id:true,name:true}}}}},
  orderBy:[{dueDate:"desc"},{createdAt:"desc"},{id:"desc"}],
  take:100,
 });
 return tasks.map(task=>{const presentation=decodeFollowUpNotes(task.notes);return{...task,type:presentation.type,notes:presentation.notes};});
}

export async function listLeadFollowUpTasks(leadId:string){return listLeadFollowUpTasksForActor(await taskActor(),leadId);}

export async function listLeadFollowUpTasksPageForActor(actor:TaskActor,leadId:string,raw:unknown={}){
 const window=pageWindow(raw),branches=await operationalBranchContext(actor);
 const rows=await db.followUpTask.findMany({where:{AND:[taskScope(actor),{companyId:actor.companyId,branchId:branches.branchId,leadId}]},include:{assignedUser:{select:{id:true,name:true}},createdByUser:{select:{id:true,name:true}}},orderBy:[{dueDate:"desc"},{createdAt:"desc"},{id:"desc"}],skip:window.skip,take:window.take});
 return pageResult(rows.map(task=>({...task,...decodeFollowUpNotes(task.notes)})),raw);
}
export async function listLeadFollowUpTasksPage(leadId:string,raw:unknown={}){return listLeadFollowUpTasksPageForActor(await taskActor(),leadId,raw)}

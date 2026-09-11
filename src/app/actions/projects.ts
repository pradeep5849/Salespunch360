"use server";
import {revalidatePath}from"next/cache";
import {redirect}from"next/navigation";
import {addMilestone,addProjectMember,addProjectDocument,addTask,closeProject,createProject,linkBoq,replaceBudget,reopenProject}from"@/lib/account/projects";
const str=(f:FormData,k:string)=>String(f.get(k)||"")||undefined;
export async function createProjectAction(f:FormData){const p=await createProject({branchId:str(f,"branchId"),name:str(f,"name"),customerId:str(f,"customerId"),siteName:str(f,"siteName"),siteAddress:str(f,"siteAddress"),siteContactName:str(f,"siteContactName"),siteContactPhone:str(f,"siteContactPhone"),projectManagerId:str(f,"projectManagerId"),startDate:str(f,"startDate"),targetEndDate:str(f,"targetEndDate"),projectValue:str(f,"projectValue")||"0"});redirect(`/workspace/account/projects/${p.id}`)}
export async function addMilestoneAction(f:FormData){const projectId=str(f,"projectId")!;await addMilestone({projectId,title:str(f,"title"),dueDate:str(f,"dueDate"),status:"PENDING"});revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function addTaskAction(f:FormData){const projectId=str(f,"projectId")!;await addTask({projectId,title:str(f,"title"),assigneeUserId:str(f,"assigneeUserId"),dueDate:str(f,"dueDate"),priority:0,status:"TODO"});revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function replaceBudgetAction(f:FormData){const projectId=str(f,"projectId")!;await replaceBudget({projectId,lines:[{category:str(f,"category"),title:str(f,"title"),amount:str(f,"amount")} ]});revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function linkBoqAction(f:FormData){const projectId=str(f,"projectId")!;await linkBoq(projectId,str(f,"boqId")!);revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function closeProjectAction(f:FormData){const projectId=str(f,"projectId")!;await closeProject(projectId,{handoverDate:str(f,"handoverDate")?new Date(str(f,"handoverDate")!):undefined,handoverNote:str(f,"handoverNote"),closureNote:str(f,"closureNote")});revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function reopenProjectAction(f:FormData){const projectId=str(f,"projectId")!;await reopenProject(projectId);revalidatePath(`/workspace/account/projects/${projectId}`)}
export async function addProjectDocumentAction(f:FormData){const projectId=str(f,"projectId")!,file=f.get("file");if(!(file instanceof File))throw new Error("INVALID_PROJECT_DOCUMENT");await addProjectDocument(projectId,file,str(f,"category"),str(f,"notes"));revalidatePath(`/workspace/account/projects/${projectId}`)}

export async function addProjectMemberAction(f:FormData){const projectId=str(f,"projectId")!;await addProjectMember(projectId,str(f,"userId")!,str(f,"role"));revalidatePath(`/workspace/account/projects/${projectId}`)}

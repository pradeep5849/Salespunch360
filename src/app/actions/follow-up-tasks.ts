"use server";
import {revalidatePath} from "next/cache";
import {cancelFollowUpTask,createFollowUpTask} from "@/lib/follow-up-tasks/service";
import {completeCallFollowUpTask} from "@/lib/follow-up-tasks/call-completion";
export type FollowUpActionState={error?:string;success?:string};
const refresh=()=>{for(const p of["/workspace","/workspace/leads","/workspace/follow-up-tasks","/workspace/check-ins"])revalidatePath(p)};
export async function addFollowUpTask(_:FollowUpActionState,form:FormData):Promise<FollowUpActionState>{try{await createFollowUpTask({leadId:form.get("leadId"),dueDate:form.get("dueDate"),type:form.get("type"),notes:form.get("notes")});refresh();return{success:"Follow-up added."}}catch{return{error:"Unable to add this follow-up. Check the date and your access."}}}
export async function cancelFollowUpTaskAction(form:FormData){await cancelFollowUpTask(String(form.get("taskId")));refresh();}
export async function completeCallFollowUpTaskAction(form:FormData){await completeCallFollowUpTask(String(form.get("taskId")),form.get("outcomeNote"));refresh();}

export async function followUpTaskFeedback(_:FollowUpActionState,form:FormData):Promise<FollowUpActionState>{
 try{
  const {mutationGuard}=await import("@/lib/security/request");await mutationGuard("follow-up-task-update",30);
  const id=String(form.get("taskId")??""),operation=form.get("operation");
  if(operation==="CALL")await completeCallFollowUpTask(id,form.get("outcomeNote"));
  else if(operation==="CANCEL")await cancelFollowUpTask(id);
  else return{error:"Choose a valid follow-up action."};
  refresh();return{success:operation==="CALL"?"Call attended. Follow-up moved to Closed.":"Follow-up cancelled."};
 }catch{return{error:"Unable to update this follow-up. It may already be closed or your access may have changed. Refresh and try again."};}
}

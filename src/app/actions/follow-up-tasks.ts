"use server";
import {revalidatePath} from "next/cache";
import {cancelFollowUpTask,createFollowUpTask} from "@/lib/follow-up-tasks/service";
import {completeCallFollowUpTask} from "@/lib/follow-up-tasks/call-completion";
export type FollowUpActionState={error?:string;success?:string};
const refresh=()=>{for(const p of["/workspace","/workspace/leads","/workspace/follow-up-tasks","/workspace/check-ins"])revalidatePath(p)};
export async function addFollowUpTask(_:FollowUpActionState,form:FormData):Promise<FollowUpActionState>{try{await createFollowUpTask({leadId:form.get("leadId"),dueDate:form.get("dueDate"),type:form.get("type"),notes:form.get("notes")});refresh();return{success:"Follow-up added."}}catch{return{error:"Unable to add this follow-up. Check the date and your access."}}}
export async function cancelFollowUpTaskAction(form:FormData){await cancelFollowUpTask(String(form.get("taskId")));refresh();}
export async function completeCallFollowUpTaskAction(form:FormData){await completeCallFollowUpTask(String(form.get("taskId")),form.get("outcomeNote"));refresh();}

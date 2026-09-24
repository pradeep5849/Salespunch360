"use server";
import {revalidatePath} from "next/cache";
import {recordLeadCall,updateSalesAction} from "@/lib/telecalling/service";
import {completeAssignedTelecallerCallForActor} from "@/lib/follow-up-tasks/telecaller-assignment";
import {requirePermissionForMutation} from "@/lib/auth/authorization";

export type TelecallingActionState={error?:string;success?:string};

export async function saveLeadCall(_:TelecallingActionState,form:FormData):Promise<TelecallingActionState>{
 try{
  const leadId=String(form.get("leadId")||"");
  const followUpTaskId=String(form.get("followUpTaskId")||"");
  const result=String(form.get("result")||"");
  const rawNext=String(form.get("nextCallbackAt")||"").trim();
  await recordLeadCall({leadId,result,notes:String(form.get("notes")||""),nextCallbackAt:rawNext?new Date(rawNext):null});
  if(followUpTaskId){const actor=await requirePermissionForMutation("SALES_TELECALLING");if(actor.companyId)await completeAssignedTelecallerCallForActor({id:actor.id,companyId:actor.companyId},followUpTaskId,leadId);}
  revalidatePath("/workspace/telecalling");
  revalidatePath("/workspace/follow-up-tasks");
  revalidatePath(`/workspace/leads/${leadId}`);
  revalidatePath("/workspace/leads");
  return{success:"Call result saved."};
 }catch(error){
  const message=error instanceof Error?error.message:"";
  return{error:message==="CALLBACK_DATE_REQUIRED"?"Choose the next callback date and time.":message==="CALLBACK_DATE_MUST_BE_FUTURE"?"Callback must be scheduled in the future.":"Unable to save this call result."};
 }
}

export async function changeSalesAction(form:FormData){
 const id=String(form.get("actionId")||"");
 const status=String(form.get("status")||"");
 if(status!=="ACKNOWLEDGED"&&status!=="ACTION_TAKEN")throw new Error("INVALID_STATUS");
 await updateSalesAction(id,status);
 revalidatePath("/workspace/telecalling");
 revalidatePath("/workspace");
}

"use server";
import {revalidatePath} from "next/cache";
import {recordLeadCall,updateSalesAction} from "@/lib/telecalling/service";

export type TelecallingActionState={error?:string;success?:string};

export async function saveLeadCall(_:TelecallingActionState,form:FormData):Promise<TelecallingActionState>{
 try{
  const leadId=String(form.get("leadId")||"");
  const result=String(form.get("result")||"");
  const rawNext=String(form.get("nextCallbackAt")||"").trim();
  await recordLeadCall({leadId,result,notes:String(form.get("notes")||""),nextCallbackAt:rawNext?new Date(rawNext):null});
  revalidatePath("/workspace/telecalling");
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

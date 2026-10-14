import {saveReminderSettingsForActor} from "@/lib/account/reminder-settings";
import type {ProjectActor} from "@/lib/account/projects";
import {revalidatePath} from "next/cache";
import {AuthorizationError,requirePermission,requirePermissionForMutation} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {ServiceReminderPicker} from "@/components/account/service-reminder-picker";

export default async function Page(){
 const actor=await requirePermission("ACCOUNT_SETTINGS");
 const companyId=actor.companyId!;
 const [products,services,current]=await Promise.all([
  db.accountProduct.findMany({where:{companyId,isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}}),
  db.accountService.findMany({where:{companyId,isActive:true},orderBy:{name:"asc"},select:{id:true,name:true}}),
  db.accountSettings.findUnique({where:{companyId},select:{transactionDefaults:true}})
 ]);
 const transactionDefaults=(current?.transactionDefaults as Record<string,unknown>|null)??{};
 const reminders=(transactionDefaults.reminderSettings as Record<string,unknown>|undefined)??{};
 const service=(reminders.service as Record<string,unknown>|undefined)??{};
 const selectedIds=Array.isArray(service.selectedItemIds)?service.selectedItemIds.filter((x):x is string=>typeof x==="string"):[];
 const items=[...products.map(x=>({...x,type:"PRODUCT" as const})),...services.map(x=>({...x,type:"SERVICE" as const}))].sort((a,b)=>a.name.localeCompare(b.name));
 async function save(fd:FormData){
  "use server";
  const editor=await requirePermissionForMutation("ACCOUNT_SETTINGS");
  if(editor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
  const selected=[...new Set(fd.getAll("selectedIds").map(String).filter(Boolean))].slice(0,2000);
  await saveReminderSettingsForActor(editor as ProjectActor,{service:{enabled:fd.get("enabled")==="on",allowSalePeriodOverride:fd.get("allowSalePeriodOverride")==="on",selectedItemIds:selected,periodDays:Number(fd.get("periodDays")),message:String(fd.get("message")??"")}});
  revalidatePath("/workspace/account/settings/reminders/service");
 }
 return <ServiceReminderPicker enabled={service.enabled!==false} allowSalePeriodOverride={service.allowSalePeriodOverride===true} items={items} selectedIds={selectedIds} periodDays={typeof service.periodDays==="number"?service.periodDays:60} message={typeof service.message==="string"?service.message:"Hi {Party name}, your next service for {Item name} is due on {reminder date}. Please contact us to book an appointment. Regards, {Company name}."} action={save}/>;
}

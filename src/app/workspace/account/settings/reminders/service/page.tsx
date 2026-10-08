import {redirect} from "next/navigation";
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
  const existing=await db.accountSettings.findUnique({where:{companyId:editor.companyId!},select:{transactionDefaults:true}});
  const defaults=(existing?.transactionDefaults as Record<string,unknown>|null)??{};
  const reminderSettings=(defaults.reminderSettings as Record<string,unknown>|undefined)??{};
  const previous=(reminderSettings.service as Record<string,unknown>|undefined)??{};
  await db.accountSettings.upsert({where:{companyId:editor.companyId!},create:{companyId:editor.companyId!,transactionDefaults:{...defaults,reminderSettings:{...reminderSettings,service:{...previous,enabled:true,selectedItemIds:selected}}}},update:{transactionDefaults:{...defaults,reminderSettings:{...reminderSettings,service:{...previous,enabled:true,selectedItemIds:selected}}}}});
  redirect("/workspace/account/settings/reminders");
 }
 return <ServiceReminderPicker items={items} selectedIds={selectedIds} action={save}/>;
}

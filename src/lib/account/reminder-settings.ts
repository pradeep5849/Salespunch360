import {z} from "zod";
import {db} from "@/lib/db";
import {updateSettingsSectionForActor} from "./settings-persistence";
import type {ProjectActor} from "./projects";
export const reminderSettingsSchema=z.object({
 payment:z.object({enabled:z.boolean(),overdueDays:z.number().int().min(0).max(365),frequency:z.enum(["ONCE_DAILY","TWICE_DAILY","THREE_DAILY","WEEKLY"]),message:z.string().trim().min(1).max(2000)}).partial().optional(),
 service:z.object({allowSalePeriodOverride:z.boolean().optional(),enabled:z.boolean().optional(),selectedItemIds:z.array(z.string().uuid()).max(2000).optional(),periodDays:z.number().int().min(1).max(3650).optional(),message:z.string().trim().min(1).max(2000).optional()}).strict().optional(),
}).strict();
export async function saveReminderSettingsForActor(actor:ProjectActor,raw:unknown){
 const input=reminderSettingsSchema.parse(raw),ids=[...new Set(input.service?.selectedItemIds??[])];
 if(input.service?.selectedItemIds){
  const [products,services]=await Promise.all([
   db.accountProduct.findMany({where:{companyId:actor.companyId,isActive:true,id:{in:ids}},select:{id:true}}),
   db.accountService.findMany({where:{companyId:actor.companyId,isActive:true,id:{in:ids}},select:{id:true}}),
  ]);
  const allowed=new Set([...products,...services].map(x=>x.id));
  if(ids.some(id=>!allowed.has(id)))throw new Error("INVALID_REMINDER_ITEM");
  input.service.selectedItemIds=ids;
 }
 return updateSettingsSectionForActor(actor,"reminderSettings",input);
}

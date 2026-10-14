import {z} from "zod";
import {updateSettingsSectionForActor} from "./settings-persistence";
export const transactionDefaultsSchema=z.object({defaultDueDays:z.coerce.number().int().min(0).max(365),salesTerms:z.string().max(5000),purchaseTerms:z.string().max(5000),projectTerms:z.string().max(5000)}).strict();
export async function saveTransactionDefaults(actor:Parameters<typeof updateSettingsSectionForActor>[0],raw:unknown){return updateSettingsSectionForActor(actor,"",transactionDefaultsSchema.parse(raw))}
export function applyTransactionDefaults(input:{type:string;issueDate:Date;dueDate?:Date|null;notes?:string|null;projectId?:string|null},raw:unknown){
 const defaults=(raw??{}) as Record<string,unknown>;
 const days=typeof defaults.defaultDueDays==="number"?defaults.defaultDueDays:0;
 const dueDate=new Date(input.issueDate);dueDate.setUTCDate(dueDate.getUTCDate()+Math.max(0,Math.min(365,days)));
 const preferences=(defaults.transactionPreferences??{}) as Record<string,unknown>;
 const terms=preferences.termsEnabled===false?undefined:input.type==="SALES_INVOICE"?(input.projectId&&typeof defaults.projectTerms==="string"&&defaults.projectTerms?defaults.projectTerms:defaults.salesTerms):input.type==="PURCHASE_BILL"?defaults.purchaseTerms:undefined;
 return {dueDate:input.dueDate??(days>0&&["SALES_INVOICE","PURCHASE_BILL"].includes(input.type)?dueDate:null),notes:input.notes??(typeof terms==="string"?terms:null)};
}

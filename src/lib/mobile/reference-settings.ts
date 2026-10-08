import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {canUsePermission} from "@/lib/auth/permissions";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import {mobileAccountActor} from "./account-transactions";
import type {MobileAppPrincipal} from "./auth";

const admin=(u:MobileAppPrincipal)=>{const a=mobileAccountActor(u);if(!canUsePermission(a,u.productEdition,"ACCOUNT_SETTINGS")||a.accountRole!=="ACCOUNT_ADMIN")throw new Error("MOBILE_FORBIDDEN");return a};
const reminderSchema=z.object({payment:z.object({enabled:z.boolean(),overdueDays:z.number().int().min(0).max(365),frequency:z.enum(["ONCE_DAILY","TWICE_DAILY","THREE_DAILY","WEEKLY"]),message:z.string().max(2000).optional()}).partial().optional(),service:z.object({enabled:z.boolean().optional(),selectedItemIds:z.array(z.string().uuid()).max(2000).optional()}).optional()}).strict();
const taxSchema=z.object({gst:z.boolean(),hsnSac:z.boolean(),additionalCess:z.boolean(),reverseCharge:z.boolean(),stateOfSupply:z.boolean(),ewayBillNumber:z.boolean(),compositeScheme:z.boolean(),enableTcs:z.boolean(),enableTds:z.boolean()}).strict();

export async function mobileSaveReferenceSettings(u:MobileAppPrincipal,section:"reminders"|"tax-preferences",raw:unknown){
 const a=admin(u);await assertOperationalWrite(a.companyId);
 const current=await db.accountSettings.findUnique({where:{companyId:a.companyId},select:{transactionDefaults:true,itemSettings:true,gstRegistrationType:true,compositionEnabled:true}}),defaults=(current?.transactionDefaults as Record<string,unknown>|null)??{},items=(current?.itemSettings as Record<string,unknown>|null)??{};
 if(section==="reminders"){
  const value=reminderSchema.parse(raw),existing=(defaults.reminderSettings as Record<string,unknown>|undefined)??{},next={...existing,...value,payment:{...((existing.payment as Record<string,unknown>|undefined)??{}),...(value.payment??{})},service:{...((existing.service as Record<string,unknown>|undefined)??{}),...(value.service??{})}};
  const transactionDefaults={...defaults,reminderSettings:next} as Prisma.InputJsonValue;
  return db.accountSettings.upsert({where:{companyId:a.companyId},create:{companyId:a.companyId,transactionDefaults},update:{transactionDefaults}});
 }
 const p=taxSchema.parse(raw),txPrefs=(defaults.transactionPreferences as Record<string,unknown>|undefined)??{},transactionDefaults={...defaults,taxPreferences:p,transactionPreferences:{...txPrefs,transactionTax:p.gst,reverseCharge:p.reverseCharge,stateOfSupply:p.stateOfSupply,ewayBillNumber:p.ewayBillNumber}} as Prisma.InputJsonValue,itemSettings={...items,itemWiseTax:p.gst,hsnSac:p.hsnSac,additionalCess:p.additionalCess} as Prisma.InputJsonValue,gstRegistrationType=p.compositeScheme?"COMPOSITION":p.gst?(current?.gstRegistrationType==="SEZ"?"SEZ":"REGULAR"):"UNREGISTERED";
 return db.accountSettings.upsert({where:{companyId:a.companyId},create:{companyId:a.companyId,transactionDefaults,itemSettings,gstRegistrationType,compositionEnabled:p.compositeScheme},update:{transactionDefaults,itemSettings,gstRegistrationType,compositionEnabled:p.compositeScheme}});
}

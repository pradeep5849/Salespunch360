import {quotationThemeSchema} from "@/lib/quotations/theme-catalogue";
import {invoicePrintSettingsSchema} from "./invoice-print-settings";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/auth/authorization";
type SettingsActor = {id:string;companyId:string|null;accountRole?:string|null;branchAccessScope?:string;branchIds?:string[]};

/** Serialize JSON read/merge/write and its audit event for every Settings section. */
export async function updateSettingsSectionForActor(
  actor: SettingsActor,
  section: string,
  patch: Record<string, unknown>,
) {
  if (!actor.companyId || actor.accountRole !== "ACCOUNT_ADMIN")
    throw new AuthorizationError();
  if(section==="quotationPrintTheme")patch=quotationThemeSchema.parse(patch);
  if(section==="invoicePrintSettings")patch=invoicePrintSettingsSchema.parse(patch);
  return db.$transaction(async (tx) => {
    if(section==="invoicePrintSettings"&&patch.bankAccountId){const bank=await tx.moneyAccount.findFirst({where:{id:String(patch.bankAccountId),companyId:actor.companyId!,isActive:true,type:"BANK",...(actor.branchAccessScope==="SELECTED_BRANCHES"?{OR:[{branchId:null},{branchId:{in:actor.branchIds??[]}}]}:{})},select:{id:true}});if(!bank)throw new Error("BANK_ACCOUNT_NOT_AVAILABLE");}
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId! + ":account-settings"}))`;
    const current = await tx.accountSettings.findUnique({
      where: { companyId: actor.companyId! }, select: { transactionDefaults: true },
    });
    const defaults = (current?.transactionDefaults as Record<string, unknown> | null) ?? {};
    const previous = section?((defaults[section] as Record<string, unknown> | undefined) ?? {}):defaults;
    const next={...previous};
    for(const [key,value] of Object.entries(patch)) {
      const old=previous[key];
      next[key]=value&&typeof value==="object"&&!Array.isArray(value)&&old&&typeof old==="object"&&!Array.isArray(old)
        ?{...(old as Record<string,unknown>),...(value as Record<string,unknown>)}:value;
    }
    const transactionDefaults = (section?{...defaults,[section]:next}:next) as Prisma.InputJsonValue;
    const row = await tx.accountSettings.upsert({
      where: { companyId: actor.companyId! },
      create: { companyId: actor.companyId!, transactionDefaults },
      update: { transactionDefaults },
    });
    await tx.accountingAuditEvent.create({data: {
      companyId: actor.companyId!, actorUserId: actor.id,
      eventType: "SETTINGS_CHANGED", entityType: "ACCOUNT_SETTINGS",
      entityId: actor.companyId!, metadata: { sections: [section] },
    }});
    return row;
  });
}

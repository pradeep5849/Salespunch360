import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {assertOperationalWrite} from "@/lib/billing/entitlement";
import type {MobileAppPrincipal} from "./auth";

const value=z.union([z.string().max(10000),z.number().finite(),z.boolean()]);
const schema=z.record(z.string().min(1).max(80),value);

export async function mobileSaveInvoicePrintSettings(user:MobileAppPrincipal,raw:unknown){
 if(!user.authorizedWorkspaces.includes("ACCOUNT")||user.accountRole!=="ACCOUNT_ADMIN")throw new Error("MOBILE_FORBIDDEN");
 await assertOperationalWrite(user.companyId);
 const invoicePrintSettings=schema.parse(raw);
 const current=await db.accountSettings.findUnique({where:{companyId:user.companyId},select:{transactionDefaults:true}});
 const transactionDefaults={...((current?.transactionDefaults as Record<string,unknown>|null)??{}),invoicePrintSettings} as Prisma.InputJsonValue;
 const row=await db.accountSettings.upsert({where:{companyId:user.companyId},create:{companyId:user.companyId,transactionDefaults},update:{transactionDefaults}});
 await db.accountingAuditEvent.create({data:{companyId:user.companyId,actorUserId:user.id,eventType:"SETTINGS_CHANGED",entityType:"ACCOUNT_SETTINGS",entityId:user.companyId,metadata:{sections:["INVOICE_PRINT"],source:"ANDROID"}}});
 return row;
}

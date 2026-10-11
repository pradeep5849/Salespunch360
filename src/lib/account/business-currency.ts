import {z} from "zod";
import {db} from "@/lib/db";
import {AuthorizationError} from "@/lib/auth/authorization";
export const businessCurrencySchema=z.enum(["INR","USD","EUR","GBP","AED"]);
export async function saveBusinessCurrency(actor:{id:string;companyId:string|null;accountRole?:string|null},raw:unknown){
 if(!actor.companyId||actor.accountRole!=="ACCOUNT_ADMIN")throw new AuthorizationError();
 const baseCurrency=businessCurrencySchema.parse(raw);
 return db.$transaction(async tx=>{
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.companyId!+":account-settings"}))`;
 await tx.$executeRaw`SELECT 1 FROM "companies" WHERE "id"=${actor.companyId!}::uuid FOR UPDATE`;
 const current=await tx.accountSettings.findUnique({where:{companyId:actor.companyId!},select:{baseCurrency:true}});
 if(baseCurrency!==(current?.baseCurrency??"INR")&&await tx.journalEntry.count({where:{companyId:actor.companyId!,status:{in:["POSTED","REVERSED"]}}})>0)throw new Error("BUSINESS_CURRENCY_LOCKED");
 const row=await tx.accountSettings.upsert({where:{companyId:actor.companyId!},create:{companyId:actor.companyId!,baseCurrency},update:{baseCurrency}});
 await tx.accountingAuditEvent.create({data:{companyId:actor.companyId!,actorUserId:actor.id,eventType:"SETTINGS_CHANGED",entityType:"ACCOUNT_SETTINGS",entityId:actor.companyId!,metadata:{sections:["BUSINESS_CURRENCY"]}}});return row;
 });
}

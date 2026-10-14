import {Prisma} from "@prisma/client";
import {z} from "zod";
import {db} from "@/lib/db";
import {privateStorage} from "@/lib/storage";
import {updateSettingsSectionForActor} from "./settings-persistence";
import {createAccountBackupForActor} from "./utilities";
export const backupSettingsSchema=z.object({autoBackup:z.boolean(),intervalDays:z.number().int().min(1).max(365),manualReminderDays:z.number().int().min(1).max(365)}).strict();
export async function saveBackupSettings(actor:Parameters<typeof updateSettingsSectionForActor>[0],raw:unknown){const settings=backupSettingsSchema.parse(raw);if(settings.autoBackup)privateStorage();return updateSettingsSectionForActor(actor,"backupSettings",settings)}
export async function generateScheduledAccountBackups(now=new Date()){
 const configs=await db.accountSettings.findMany({where:{transactionDefaults:{path:["backupSettings","autoBackup"],equals:true}}});let generated=0;
 for(const config of configs){
  const root=(config.transactionDefaults??{}) as Record<string,unknown>,settings=backupSettingsSchema.safeParse(root.backupSettings);if(!settings.success)continue;
  const admin=await db.user.findFirst({where:{companyId:config.companyId,isActive:true,accountAccessActive:true,accountRole:"ACCOUNT_ADMIN"},orderBy:{createdAt:"asc"},select:{id:true,accountRole:true}});if(!admin)continue;
  const made=await db.$transaction(async tx=>{
   await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${config.companyId+":scheduled-backup"}))`;
   const current=await tx.accountSettings.findUnique({where:{companyId:config.companyId},select:{transactionDefaults:true}});
   const currentPreferences=backupSettingsSchema.safeParse((current?.transactionDefaults as Record<string,unknown>|null)?.backupSettings);
   if(!currentPreferences.success||!currentPreferences.data.autoBackup)return false;
   const latest=await tx.accountBackupRecord.findFirst({where:{companyId:config.companyId,manifest:{path:["objectKey"],not:Prisma.AnyNull}},orderBy:{generatedAt:"desc"},select:{generatedAt:true}});
   if(latest&&now.getTime()-latest.generatedAt.getTime()<currentPreferences.data.intervalDays*86400000)return false;
   await createAccountBackupForActor({...admin,companyId:config.companyId},true);return true;
  },{timeout:60000});if(made)generated++;
 }
 return {companies:configs.length,generated};
}
export async function backupReminderDue(companyId:string,now=new Date()){
 const [config,latest]=await Promise.all([db.accountSettings.findUnique({where:{companyId},select:{transactionDefaults:true,createdAt:true}}),db.accountBackupRecord.findFirst({where:{companyId},orderBy:{generatedAt:"desc"},select:{generatedAt:true}})]);
 const settings=((config?.transactionDefaults as Record<string,unknown>|null)?.backupSettings??{}) as Record<string,unknown>;
 if(typeof settings.manualReminderDays!=="number"||settings.autoBackup===true)return false;
 return now.getTime()-(latest?.generatedAt??config?.createdAt??now).getTime()>=settings.manualReminderDays*86400000;
}

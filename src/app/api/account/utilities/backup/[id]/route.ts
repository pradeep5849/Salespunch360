import {createHash} from "node:crypto";
import {requirePermission} from "@/lib/auth/authorization";
import {db} from "@/lib/db";
import {privateStorage} from "@/lib/storage";
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ACCOUNT_SETTINGS");if(actor.accountRole!=="ACCOUNT_ADMIN")return new Response("Forbidden",{status:403});
 const {id}=await params,record=await db.accountBackupRecord.findFirst({where:{id,companyId:actor.companyId!}}),key=(record?.manifest as {objectKey?:string}|null)?.objectKey;
 if(!record||!key||!key.startsWith(`companies/${actor.companyId}/account-backups/`))return new Response("Backup not found",{status:404});
 const bytes=await privateStorage().get(key);if(createHash("sha256").update(bytes).digest("hex")!==record.checksum)return new Response("Backup verification failed",{status:409});
 return new Response(new Uint8Array(bytes),{headers:{"content-type":"application/json","content-disposition":`attachment; filename="account-backup-${record.id}.json"`,"cache-control":"private, no-store","x-content-sha256":record.checksum}});
}

import {createHash} from "node:crypto";
import {assertSafeObjectKey,type PrivateStorage} from "@/lib/storage/types";

const keyFields=new Set(["objectKey","thumbnailObjectKey","photoObjectKey","logoObjectKey","storageKey"]);
const MAX_BYTES=64*1024*1024,MAX_FILES=2000;
export type BackupPrivateFile={objectKey:string;size:number;sha256:string;encoding:"base64";data:string};
/** Live typed record fields only: audit/recycle metadata can reference intentionally deleted files. */
export function backupPrivateFileKeys(companyId:string,snapshot:Record<string,unknown>){
 const keys=new Set<string>();
 function record(value:unknown){
  if(!value||typeof value!=="object"||Array.isArray(value))return;
  for(const [field,key] of Object.entries(value))if(keyFields.has(field)&&typeof key==="string"&&key){
   assertSafeObjectKey(key);
   if(!key.startsWith(`companies/${companyId}/`)||key.startsWith(`companies/${companyId}/account-backups/`))throw new Error("BACKUP_FILE_SCOPE_INVALID");
   keys.add(key);if(keys.size>MAX_FILES)throw new Error("BACKUP_FILES_TOO_LARGE");
  }
 }
 record(snapshot);
 for(const value of Object.values(snapshot))if(Array.isArray(value))for(const row of value)record(row);
 return [...keys].sort();
}
function expectedPrivateHashes(snapshot:Record<string,unknown>){
 const expected=new Map<string,string>();
 for(const row of Array.isArray(snapshot.partyTransferPhotos)?snapshot.partyTransferPhotos:[]){
  if(!row||typeof row!=="object")throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  const value=row as Record<string,unknown>,key=value.photoObjectKey,hash=value.expectedSha256;
  if(typeof key!=="string"||!key||typeof hash!=="string"||!/^[a-f0-9]{64}$/.test(hash)||expected.has(key)&&expected.get(key)!==hash)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  expected.set(key,hash);
 }
 return expected;
}
/** Fail closed: never certify a file-inclusive bundle after silently dropping missing bytes. */
export async function collectBackupPrivateFiles(companyId:string,snapshot:Record<string,unknown>,storage:Pick<PrivateStorage,"get">){
 const files:BackupPrivateFile[]=[],expected=expectedPrivateHashes(snapshot);let total=0;
 for(const objectKey of backupPrivateFileKeys(companyId,snapshot)){
  let bytes:Buffer;try{bytes=await storage.get(objectKey)}catch{throw new Error("BACKUP_FILE_UNAVAILABLE")}
  total+=bytes.length;if(total>MAX_BYTES)throw new Error("BACKUP_FILES_TOO_LARGE");
  const sha256=createHash("sha256").update(bytes).digest("hex");if(expected.has(objectKey)&&expected.get(objectKey)!==sha256)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  files.push({objectKey,size:bytes.length,sha256,encoding:"base64",data:bytes.toString("base64")});
 }
 return files;
}
/** Offline integrity rehearsal only; this function never writes storage or database rows. */
export function verifyBackupPrivateFiles(companyId:string,snapshot:Record<string,unknown>,files:BackupPrivateFile[]){
 const required=backupPrivateFileKeys(companyId,snapshot),expected=expectedPrivateHashes(snapshot),seen=new Set<string>();let total=0;
 if(files.length!==required.length)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
 for(const file of files){
  if(!required.includes(file.objectKey)||seen.has(file.objectKey)||file.encoding!=="base64"||typeof file.data!=="string"||!Number.isSafeInteger(file.size)||file.size<0)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  const bytes=Buffer.from(file.data,"base64");total+=bytes.length;
  if(total>MAX_BYTES||bytes.toString("base64")!==file.data||bytes.length!==file.size||createHash("sha256").update(bytes).digest("hex")!==file.sha256)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  if(expected.has(file.objectKey)&&expected.get(file.objectKey)!==file.sha256)throw new Error("BACKUP_FILE_INTEGRITY_INVALID");
  seen.add(file.objectKey);
 }
 return {files:seen.size,bytes:total};
}

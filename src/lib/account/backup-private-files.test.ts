import {createHash} from "node:crypto";
import {describe,it,expect,vi} from "vitest";
import {backupPrivateFileKeys,collectBackupPrivateFiles,verifyBackupPrivateFiles} from "./backup-private-files";
const key="companies/a/sale-attachments/invoice/photo",snapshot={id:"a",logoObjectKey:key,commercialAttachment:[{storageKey:key}],accountOperationalAudit:[{metadata:{storageKey:"companies/foreign/private"}}],recycleBinRecords:[{snapshot:{objectKey:"companies/a/deleted"}}]};
describe("A088 bounded private-file recovery bundles",()=>{
 it("deduplicates live references without following historical metadata or external URLs",()=>{
  expect(backupPrivateFileKeys("a",{...snapshot,accountProducts:[{photoObjectKey:"companies/a/items/photo",description:"https://external/private"}]})).toEqual(["companies/a/items/photo",key]);
 });
 it("round trips exact binary bytes and verifies hashes without writing anything",async()=>{
  const bytes=Buffer.from([0,255,128,13,10]),get=vi.fn().mockResolvedValue(bytes);
  const files=await collectBackupPrivateFiles("a",snapshot,{get});
  expect(get).toHaveBeenCalledExactlyOnceWith(key);expect(Buffer.from(files[0].data,"base64")).toEqual(bytes);
  expect(verifyBackupPrivateFiles("a",snapshot,files)).toEqual({files:1,bytes:5});
 });
 it("rejects foreign tenant, path traversal and recursive backup archives before storage reads",async()=>{
  for(const objectKey of ["companies/foreign/photo","companies/a/../foreign/photo","/etc/passwd","companies/a/account-backups/old.json"]){
   const get=vi.fn();await expect(collectBackupPrivateFiles("a",{objectKey},{get})).rejects.toThrow();expect(get).not.toHaveBeenCalled();
  }
 });
 it("refuses missing storage objects without exposing paths or provider errors",async()=>{
  await expect(collectBackupPrivateFiles("a",snapshot,{get:async()=>{throw new Error("secret-provider-error")}})).rejects.toThrow(/^BACKUP_FILE_UNAVAILABLE$/);
 });
 it("rejects omission, duplication, modification, malformed base64 and incorrect size",async()=>{
  const files=await collectBackupPrivateFiles("a",snapshot,{get:async()=>Buffer.from("original")});
  for(const invalid of [[],[...files,...files],[{...files[0],data:Buffer.from("changed").toString("base64")}],[{...files[0],size:999}],[{...files[0],data:files[0].data+"\n"}],[{...files[0],objectKey:"companies/foreign/photo"}]])expect(()=>verifyBackupPrivateFiles("a",snapshot,invalid)).toThrow("BACKUP_FILE_INTEGRITY_INVALID");
 });
 it("accepts a company with no private files",async()=>{const get=vi.fn();expect(await collectBackupPrivateFiles("a",{id:"a"},{get})).toEqual([]);expect(verifyBackupPrivateFiles("a",{id:"a"},[])).toEqual({files:0,bytes:0});expect(get).not.toHaveBeenCalled()});
 it("bounds file count before accessing storage",async()=>{const get=vi.fn();await expect(collectBackupPrivateFiles("a",{rows:Array.from({length:2001},(_,i)=>({objectKey:`companies/a/files/${i}`}))},{get})).rejects.toThrow("BACKUP_FILES_TOO_LARGE");expect(get).not.toHaveBeenCalled()});
 it("bounds cumulative binary payload",async()=>{const get=vi.fn().mockResolvedValue(Buffer.alloc(33*1024*1024));await expect(collectBackupPrivateFiles("a",{rows:[{objectKey:"companies/a/one"},{objectKey:"companies/a/two"}]},{get})).rejects.toThrow("BACKUP_FILES_TOO_LARGE")});
});

it("rejects private transfer evidence whose bytes no longer match its immutable source hash",async()=>{const key="companies/a/party-transfers/source/photo.webp",data={partyTransferPhotos:[{photoObjectKey:key,expectedSha256:createHash("sha256").update("original").digest("hex")}]};await expect(collectBackupPrivateFiles("a",data,{get:async()=>Buffer.from("changed")})).rejects.toThrow("BACKUP_FILE_INTEGRITY_INVALID");const correct=await collectBackupPrivateFiles("a",data,{get:async()=>Buffer.from("original")});expect(verifyBackupPrivateFiles("a",data,correct)).toEqual({files:1,bytes:8});const changedData={partyTransferPhotos:[{photoObjectKey:key,expectedSha256:"0".repeat(64)}]};expect(()=>verifyBackupPrivateFiles("a",changedData,correct)).toThrow("BACKUP_FILE_INTEGRITY_INVALID")});

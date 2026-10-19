import {randomUUID} from "node:crypto";
import {createHash} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {afterAll,beforeAll,describe,expect,it,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {createAccountBackupForActor} from "./utilities";
const companyId=randomUUID(),foreignId=randomUUID(),userId=randomUUID();
const actor={id:userId,companyId,accountRole:"ACCOUNT_ADMIN"};
describe.skipIf(!url)("A088 reusable expense item backup retention",()=>{
 beforeAll(async()=>{
  for(const id of [companyId,foreignId])await client.company.create({data:{id,name:"Backup fixture",slug:`backup-${id}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.user.create({data:{id:userId,companyId,name:"Backup admin",email:`${userId}@example.test`,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
 });
 afterAll(async()=>{
  for(const id of [companyId,foreignId])await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${id},true)`;
   await tx.accountingAuditEvent.deleteMany({where:{companyId:id}});await tx.accountBackupRecord.deleteMany({where:{companyId:id}});await tx.expenseItem.deleteMany({where:{companyId:id}});await tx.user.deleteMany({where:{companyId:id}});await tx.company.delete({where:{id}});
  });
  await client.$disconnect();
 });
 it("exports active and archived original items with private photo metadata and no other company records",async()=>{
  const item={companyId,name:"Archived reusable item",normalizedName:"archived reusable item",creationRequestKey:randomUUID(),creationRequestHash:"a".repeat(64),photoObjectKey:`companies/${companyId}/expense-items/photo`,photoMimeType:"image/png",isActive:false};
  const saved=await client.expenseItem.create({data:item});
  await client.expenseItem.create({data:{...item,name:"Active item",normalizedName:"active item",creationRequestKey:randomUUID(),photoObjectKey:null,isActive:true}});
  await client.expenseItem.create({data:{...item,companyId:foreignId,creationRequestKey:randomUUID(),photoObjectKey:`companies/${foreignId}/expense-items/private`}});
  const result=await createAccountBackupForActor(actor),bundle=JSON.parse(new TextDecoder().decode(result.bytes));
  expect(bundle.data.expenseItem).toHaveLength(2);expect(bundle.data.expenseItem.map((x:{name:string})=>x.name)).toEqual(["Active item","Archived reusable item"]);
  expect(bundle.data.expenseItem[1]).toMatchObject({...item,id:saved.id});expect(bundle.manifest.recordCounts.expenseItem).toBe(2);
  expect(new TextDecoder().decode(result.bytes)).not.toContain(foreignId);
  expect(result.checksum).toBe(createHash("sha256").update(result.bytes).digest("hex"));
  expect(await client.expenseItem.findUnique({where:{id:saved.id}})).toEqual(saved);
  expect(await client.journalEntry.count({where:{companyId}})).toBe(0);
  expect(await client.accountingAuditEvent.count({where:{companyId,eventType:"BACKUP_GENERATED"}})).toBe(1);
 });
 it("rejects non-admin export without creating an audit or backup record",async()=>{
  const before=await client.accountBackupRecord.count({where:{companyId}});
  await expect(createAccountBackupForActor({...actor,accountRole:"ACCOUNTANT"})).rejects.toThrow();
  expect(await client.accountBackupRecord.count({where:{companyId}})).toBe(before);
 });
});

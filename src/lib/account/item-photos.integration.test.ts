import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import sharp from "sharp";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {saveItemPhotoForActor,itemPhotoForActor} from "./item-photos";
import {setPrivateStorageForTests} from "@/lib/storage";
import type {ProjectActor} from "./projects";
const companyId=randomUUID(),userId=randomUUID(),id=randomUUID(),serviceId=randomUUID(),objects=new Map<string,Buffer>();
const actor={id:userId,companyId,accountRole:"ACCOUNT_ADMIN"} as ProjectActor;
const put=vi.fn(async(key:string,data:Buffer)=>{objects.set(key,data)}),remove=vi.fn(async(key:string)=>{objects.delete(key)});
let file:File;
describe.skipIf(!url)("A058 private item photos on isolated PostgreSQL",()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:"Photo fixture",slug:`photo-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.accountSettings.create({data:{companyId,enabledModules:["INVENTORY"]}});
  await client.user.create({data:{id:userId,companyId,name:"Photo admin",email:`${userId}@example.test`,passwordHash:"fixture",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN"}});
  await client.accountProduct.create({data:{id,companyId,name:"Photo product",salePrice:"100"}});await client.accountService.create({data:{id:serviceId,companyId,name:"Photo service"}});
  const bytes=await sharp({create:{width:1000,height:800,channels:3,background:"red"}}).jpeg().toBuffer();file=new File([new Uint8Array(bytes)],"photo.jpg",{type:"image/jpeg"});
  setPrivateStorageForTests({put,get:async key=>{const bytes=objects.get(key);if(!bytes)throw new Error("missing");return bytes},delete:remove});
 });
 afterAll(async()=>{setPrivateStorageForTests(undefined);await client.accountOperationalAudit.deleteMany({where:{companyId}});await client.accountProduct.deleteMany({where:{companyId}});await client.accountService.deleteMany({where:{companyId}});await client.accountSettings.deleteMany({where:{companyId}});await client.user.deleteMany({where:{companyId}});await client.company.deleteMany({where:{id:companyId}});await client.$disconnect()});
 it("stores a private normalized photo and concurrent identical retries keep one pointer and audit",async()=>{
  const raw={kind:"products",id};await Promise.all([saveItemPhotoForActor(actor,raw,file),saveItemPhotoForActor(actor,raw,file)]);
  const row=await client.accountProduct.findUniqueOrThrow({where:{id}});expect(row.salePrice?.toString()).toBe("100");expect(objects.size).toBe(1);expect(row.photoObjectKey).toMatch(new RegExp(`^companies/${companyId}/item-photos/products/${id}/`));
  expect(await client.accountOperationalAudit.count({where:{companyId,eventType:"ITEM_PHOTO_SAVED",entityId:id}})).toBe(1);
  const meta=await sharp(await itemPhotoForActor(actor,raw)).metadata();expect(meta.format).toBe("webp");expect(meta.width).toBe(720);expect(meta.exif).toBeUndefined();expect(await client.journalEntry.count({where:{companyId}})).toBe(0);
 });
 it("supports services and replacement removes only the superseded private object",async()=>{
  await saveItemPhotoForActor(actor,{kind:"services",id:serviceId},file);
  const old=(await client.accountService.findUniqueOrThrow({where:{id:serviceId}})).photoObjectKey!;
  const bytes=await sharp({create:{width:10,height:10,channels:3,background:"blue"}}).png().toBuffer();await saveItemPhotoForActor(actor,{kind:"services",id:serviceId},new File([new Uint8Array(bytes)],"blue.png",{type:"image/png"}));
  expect(objects.has(old)).toBe(false);expect((await sharp(await itemPhotoForActor(actor,{kind:"services",id:serviceId})).metadata()).width).toBe(10);
 });
 it("denies role, company, missing source and module OFF before storing",async()=>{
  const count=put.mock.calls.length;await expect(saveItemPhotoForActor({...actor,accountRole:"PROJECT_MANAGER"},{kind:"products",id},file)).rejects.toThrow();
  await expect(itemPhotoForActor({...actor,companyId:randomUUID()},{kind:"products",id})).rejects.toThrow();await expect(saveItemPhotoForActor(actor,{kind:"products",id:randomUUID()},file)).rejects.toThrow("ITEM_PHOTO_NOT_FOUND");
  await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:false}}});try{await expect(saveItemPhotoForActor(actor,{kind:"products",id},file)).rejects.toThrow("ITEMS_DISABLED")}finally{await client.accountSettings.update({where:{companyId},data:{itemSettings:{enabled:true}}})}expect(put.mock.calls.length).toBe(count);
 });
 it("rejects unsupported, corrupt, empty and oversized input without changing a saved photo",async()=>{
  const before=await client.accountProduct.findUniqueOrThrow({where:{id}}),count=put.mock.calls.length;
  for(const photo of [new File(["plain"],"bad.txt",{type:"text/plain"}),new File(["bad"],"bad.jpg",{type:"image/jpeg"}),new File([],"empty.png",{type:"image/png"}),new File([new Uint8Array(5*1024*1024+1)],"large.jpg",{type:"image/jpeg"})])await expect(saveItemPhotoForActor(actor,{kind:"products",id},photo)).rejects.toThrow("INVALID_ITEM_PHOTO");
  expect(put.mock.calls.length).toBe(count);expect((await client.accountProduct.findUniqueOrThrow({where:{id}})).photoObjectKey).toBe(before.photoObjectKey);
 });
 it("cleans partial storage writes without changing the database pointer",async()=>{
  const before=await client.accountProduct.findUniqueOrThrow({where:{id}}),keys=[...objects.keys()].sort();put.mockImplementationOnce(async(key,data)=>{objects.set(key,data);throw new Error("STORAGE_FAULT")});await expect(saveItemPhotoForActor(actor,{kind:"products",id},file)).rejects.toThrow("STORAGE_FAULT");expect([...objects.keys()].sort()).toEqual(keys);expect((await client.accountProduct.findUniqueOrThrow({where:{id}})).photoObjectKey).toBe(before.photoObjectKey);
 });
 it("cleans a newly staged blob when the transactional audit fails and preserves the previous pointer",async()=>{
  const before=await client.accountProduct.findUniqueOrThrow({where:{id}}),keys=[...objects.keys()].sort(),fn=`photo_fail_${companyId.replaceAll('-','')}`;
  await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"='ITEM_PHOTO_SAVED' THEN RAISE EXCEPTION 'PHOTO_AUDIT_FAULT'; END IF; RETURN NEW; END $$`);
  await client.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try{const bytes=await sharp({create:{width:5,height:5,channels:3,background:"green"}}).png().toBuffer();await expect(saveItemPhotoForActor(actor,{kind:"products",id},new File([new Uint8Array(bytes)],"green.png",{type:"image/png"}))).rejects.toThrow();expect((await client.accountProduct.findUniqueOrThrow({where:{id}})).photoObjectKey).toBe(before.photoObjectKey);expect([...objects.keys()].sort()).toEqual(keys)}finally{await client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${fn} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${fn}()`)}
 });
});

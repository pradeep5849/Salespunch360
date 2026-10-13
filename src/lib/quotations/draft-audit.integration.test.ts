import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {createQuotationForActor,updateQuotationDraftForActor,getQuotationForActor} from "./service";
const companyId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID();
let actor:Parameters<typeof createQuotationForActor>[0];
const input={branchId,customerId,documentType:"QUOTATION",issueDate:"2026-10-13",lines:[{lineType:"CUSTOM",itemName:"Original line",quantity:"1",rate:"100",internalUnitCost:"25"}],notes:"Original note"};
describe.skipIf(!url)("A079 draft audit real transaction",()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:"Draft audit fixture",slug:`draft-audit-${companyId}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  await client.branch.create({data:{id:branchId,companyId,name:"Fixture branch",code:"A",isPrimary:true}});
  await client.customer.create({data:{id:customerId,companyId,branchId,name:"Fixture customer",isAccountCustomer:true}});
  const user=await client.user.create({data:{id:userId,companyId,name:"Fixture admin",email:`${userId}@example.test`,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  actor={...user,companyId,branchAccessScope:"ALL_BRANCHES",branchIds:[]};
 });
 afterAll(async()=>{
  await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
   await tx.quotationAuditEvent.deleteMany({where:{companyId}});
   await tx.quotationPaymentSchedule.deleteMany({where:{companyId}});await tx.quotationAdjustment.deleteMany({where:{companyId}});await tx.quotationLine.deleteMany({where:{companyId}});await tx.quotationRevision.deleteMany({where:{companyId}});await tx.quotationDocument.deleteMany({where:{companyId}});
  });
  await client.numberingSeries.deleteMany({where:{companyId}});await client.customer.deleteMany({where:{companyId}});await client.user.deleteMany({where:{companyId}});await client.branch.deleteMany({where:{companyId}});await client.company.delete({where:{id:companyId}});await client.$disconnect();
 });
 it("appends a safe immutable event and atomically rolls back replacement when audit insertion fails",async()=>{
  const document=await createQuotationForActor(actor,input);
  await updateQuotationDraftForActor(actor,document.id,{...input,notes:"Edited note"});
  const audit=await client.quotationAuditEvent.findFirstOrThrow({where:{companyId,documentId:document.id,eventType:"DRAFT_UPDATED"}});
  expect(audit).toMatchObject({actorId:userId,revisionNumber:0});expect(audit.note).toBe("Draft saved: 1 lines; 0 adjustments; 0 payment schedule entries.");expect(audit.note).not.toContain("25");
  await expect(client.quotationAuditEvent.update({where:{id:audit.id},data:{note:"Forged history"}})).rejects.toThrow();
  const before=await getQuotationForActor(actor,document.id);
  const trigger=`draft_audit_fail_${randomUUID().replaceAll("-","")}`;
  await client.$executeRawUnsafe(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"::text='DRAFT_UPDATED' THEN RAISE EXCEPTION 'fixture audit failure'; END IF; RETURN NEW; END $$`);
  await client.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON quotation_audit_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
  try {await expect(updateQuotationDraftForActor(actor,document.id,{...input,notes:"Must roll back"})).rejects.toThrow();}
  finally {await client.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON quotation_audit_events`);await client.$executeRawUnsafe(`DROP FUNCTION ${trigger}()`);}
  const after=await getQuotationForActor(actor,document.id);
  expect(after.revisions[0].id).toBe(before.revisions[0].id);expect(after.revisions[0].notes).toBe("Edited note");expect(after.revisions[0].lines[0].itemName).toBe("Original line");
  expect(await client.quotationAuditEvent.count({where:{companyId,documentId:document.id,eventType:"DRAFT_UPDATED"}})).toBe(1);
 });
});

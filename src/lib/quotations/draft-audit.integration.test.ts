import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("Isolated local *_ci database required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {createQuotationForActor,updateQuotationDraftForActor,getQuotationForActor,listQuotationsForActor,transitionQuotationForActor,createQuotationRevisionForActor} from "./service";
import {quotationConversionPreviewForActor} from "./conversion-preview";
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
  await client.accountSettings.deleteMany({where:{companyId}});await client.numberingSeries.deleteMany({where:{companyId}});await client.customer.deleteMany({where:{companyId}});await client.user.deleteMany({where:{companyId}});await client.branch.deleteMany({where:{companyId}});await client.company.delete({where:{id:companyId}});await client.$disconnect();
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
 it("filters estimate groups/search before paging and preserves branch, company, costs and module isolation",async()=>{
  const second=randomUUID(),secondCustomer=randomUUID();await client.branch.create({data:{id:second,companyId,name:"Other branch",code:"B"}});await client.customer.create({data:{id:secondCustomer,companyId,branchId:second,name:"Other branch customer",isAccountCustomer:true}});
  const closed=await createQuotationForActor(actor,{...input,documentType:"ESTIMATE"});await transitionQuotationForActor(actor,closed.id,"CANCELLED");await createQuotationForActor(actor,{...input,branchId:second,customerId:secondCustomer});
  const scoped={...actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[branchId]};
  const open=await listQuotationsForActor(scoped,{q:"fixture CUSTOMER",status:"OPEN"});expect(open).toHaveLength(1);expect(open[0].status).toBe("DRAFT");
  const closedRows=await listQuotationsForActor(scoped,{status:"CLOSED"});expect(closedRows.map(row=>row.id)).toEqual([closed.id]);
  expect(await listQuotationsForActor(scoped,{q:"no matching party"})).toEqual([]);expect(await listQuotationsForActor({...scoped,branchIds:[]})).toEqual([]);await expect(listQuotationsForActor({...actor,companyId:randomUUID()})).rejects.toThrow("MODULE_DISABLED:QUOTATIONS_BOQ");
  const first=await listQuotationsForActor(scoped,{limit:1}),next=await listQuotationsForActor(scoped,{limit:1,offset:1});expect(first[0].id).not.toBe(next[0].id);
  expect(JSON.stringify(await listQuotationsForActor({...scoped,accountRole:"DATA_ENTRY"}))).not.toMatch(/internalCostTotal|expectedProfit|expectedMarginPercent/);
  await client.accountSettings.create({data:{companyId,enabledModules:[]}});expect(await listQuotationsForActor(actor)).toHaveLength(3);
  await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360"}});try{await expect(listQuotationsForActor(actor)).rejects.toThrow("MODULE_DISABLED:QUOTATIONS_BOQ");}finally{await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360_ACCOUNT"}});}
 });

 it("searches the full corpus while providing deterministic bounded pages",async()=>{
  const ids=Array.from({length:201},()=>randomUUID());await client.quotationDocument.createMany({data:ids.map((id,index)=>({id,companyId,branchId,documentType:"ESTIMATE" as const,documentNumber:`PAGE-${index}`,createdById:userId,customerId,updatedAt:new Date(1700000000000+index)}))});
  await client.quotationRevision.createMany({data:ids.map((id,index)=>({companyId,documentId:id,revisionNumber:0,issueDate:new Date("2026-10-13"),customerName:index===0?"Oldest unique party":"Paged party",grandTotal:"100"}))});
  expect((await listQuotationsForActor(actor,{q:"Oldest unique party"})).map(row=>row.id)).toEqual([ids[0]]);
  const page=await listQuotationsForActor(actor,{q:"Paged party",limit:51});expect(page).toHaveLength(51);expect((await listQuotationsForActor(actor,{q:"Paged party",limit:51,offset:50}))[0].id).toBe(page[50].id);
 });

 it("replays concurrent creation once, rejects changed intent, and rechecks branch access",async()=>{
  const creationRequestKey=randomUUID();
  const request={...input,documentType:"ESTIMATE",creationRequestKey};
  const [first,replay]=await Promise.all([createQuotationForActor(actor,request),createQuotationForActor(actor,request)]);
  expect(replay.id).toBe(first.id);
  expect(first).not.toHaveProperty("creationRequestKey");expect(first).not.toHaveProperty("creationRequestHash");
  expect(await client.quotationDocument.count({where:{companyId,creationRequestKey}})).toBe(1);
  expect(await client.quotationRevision.count({where:{documentId:first.id}})).toBe(1);
  expect(await client.quotationAuditEvent.count({where:{documentId:first.id,eventType:"CREATED"}})).toBe(1);
  await expect(createQuotationForActor(actor,{...request,notes:"Changed after uncertain response"})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
  await expect(createQuotationForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},request)).rejects.toThrow();
  const next=await createQuotationForActor(actor,{...request,creationRequestKey:randomUUID()});
  expect(next.id).not.toBe(first.id);expect(next.documentNumber).not.toBe(first.documentNumber);
  expect((await getQuotationForActor(actor,first.id)).status).toBe("DRAFT");
 });

 it("prepares exact conversion values without creating a target, customer, Project, receipt, journal or audit",async()=>{
  const document=await createQuotationForActor(actor,{...input,documentType:"ESTIMATE",lines:[{lineType:"CUSTOM",itemName:"Negotiated work",quantity:"3",rate:"100",taxRate:"18",internalUnitCost:"60"}],adjustments:[{label:"Agreed discount",type:"DISCOUNT",valueType:"FIXED",value:"30"},{label:"Transport",type:"ADDITIONAL_CHARGE",valueType:"FIXED",value:"10",taxable:true,taxRate:"5"}],paymentSchedule:[{label:"Completion",valueType:"PERCENTAGE",value:"100"}]});
  const counts=async()=>Promise.all([
   client.commercialDocument.count({where:{companyId}}),client.customer.count({where:{companyId}}),client.project.count({where:{companyId}}),
   client.accountSettlement.count({where:{companyId}}),client.journalEntry.count({where:{companyId}}),client.quotationAuditEvent.count({where:{companyId}}),
  ]);
  const before=await counts(),saved=await getQuotationForActor(actor,document.id);
  const preview=await quotationConversionPreviewForActor(actor,{documentId:document.id,revisionId:saved.revisions[0].id,targetType:"SALES_INVOICE"});
  expect(preview).toMatchObject({sourceDocumentId:document.id,sourceRevisionId:saved.revisions[0].id,partyId:customerId,branchId,grandTotal:"329.10",taxTotal:"49.10",lines:[{quantity:"3",rate:"100.00",discountValue:"30.00"},{itemName:"Transport",rate:"10.00",taxRate:"5"}],reference:{paymentSchedule:[{amount:"329.10"}]}});
  expect(JSON.stringify(preview)).not.toMatch(/internalCost|internalUnitCost|expectedProfit|creationRequest/);
  await quotationConversionPreviewForActor(actor,{documentId:document.id,targetType:"SALES_ORDER"});
  await expect(quotationConversionPreviewForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},{documentId:document.id,targetType:"SALES_INVOICE"})).rejects.toThrow("NOT_FOUND");
  await expect(quotationConversionPreviewForActor(actor,{documentId:document.id,revisionId:randomUUID(),targetType:"SALES_INVOICE"})).rejects.toThrow("QUOTATION_REVISION_CHANGED");
  const foreignCompany=randomUUID();await client.company.create({data:{id:foreignCompany,name:"Foreign conversion fixture",slug:`conversion-${foreignCompany}`,productEdition:"SALESPUNCH360_ACCOUNT"}});
  try{await expect(quotationConversionPreviewForActor({...actor,companyId:foreignCompany},{documentId:document.id,targetType:"SALES_INVOICE"})).rejects.toThrow("NOT_FOUND");}finally{await client.company.delete({where:{id:foreignCompany}})}
  expect(await counts()).toEqual(before);
  expect((await getQuotationForActor(actor,document.id)).status).toBe("DRAFT");
 });

 it("persists rounding on create/edit/revision, preserves legacy-client omission and protects issued history",async()=>{
  const roundedInput={...input,roundOffEnabled:true,lines:[{lineType:"CUSTOM",itemName:"Rounding fixture",quantity:"1",rate:"100.49",taxRate:"0"}],paymentSchedule:[{label:"Full",valueType:"PERCENTAGE",value:"100"}]};
  const document=await createQuotationForActor(actor,roundedInput);
  let saved=await getQuotationForActor(actor,document.id),revision=saved.revisions[0];
  expect(revision.roundOffEnabled).toBe(true);expect(revision.roundOffAmount.toFixed(2)).toBe("-0.49");expect(revision.grandTotal.toFixed(2)).toBe("100.00");expect(revision.paymentSchedule[0].amount.toFixed(2)).toBe("100.00");
  const {roundOffEnabled:_omitted,...oldClient}=roundedInput;void _omitted;
  await updateQuotationDraftForActor(actor,document.id,{...oldClient,notes:"Old client omission"});
  saved=await getQuotationForActor(actor,document.id);expect(saved.revisions[0].roundOffEnabled).toBe(true);
  await updateQuotationDraftForActor(actor,document.id,{...roundedInput,roundOffEnabled:false});
  saved=await getQuotationForActor(actor,document.id);expect(saved.revisions[0].grandTotal.toFixed(2)).toBe("100.49");expect(saved.revisions[0].roundOffAmount.toFixed(2)).toBe("0.00");
  await updateQuotationDraftForActor(actor,document.id,roundedInput);await transitionQuotationForActor(actor,document.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,document.id,"APPROVED");
  revision=(await getQuotationForActor(actor,document.id)).revisions[0];
  await expect(client.quotationRevision.update({where:{id:revision.id},data:{roundOffEnabled:false,roundOffAmount:0}})).rejects.toThrow("QUOTATION_REVISION_COMMERCIAL_IMMUTABLE");
  const next=await createQuotationRevisionForActor(actor,document.id,oldClient);expect(next.roundOffEnabled).toBe(true);expect(next.roundOffAmount.toFixed(2)).toBe("-0.49");
  const before=await client.journalEntry.count({where:{companyId}});expect(before).toBe(0);
 });

 it("snapshots supply context, preserves omission, accepts explicit clear and protects approved history",async()=>{
  const data={...input,stateOfSupplyCode:"29"};
  const doc=await createQuotationForActor(actor,data);let saved=await getQuotationForActor(actor,doc.id);expect(saved.revisions[0].stateOfSupplyCode).toBe("29");
  await updateQuotationDraftForActor(actor,doc.id,{...input,notes:"Legacy omitted field"});saved=await getQuotationForActor(actor,doc.id);expect(saved.revisions[0].stateOfSupplyCode).toBe("29");
  await updateQuotationDraftForActor(actor,doc.id,{...input,stateOfSupplyCode:null});expect((await getQuotationForActor(actor,doc.id)).revisions[0].stateOfSupplyCode).toBeNull();
  await updateQuotationDraftForActor(actor,doc.id,{...input,stateOfSupplyCode:"27"});await transitionQuotationForActor(actor,doc.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,doc.id,"APPROVED");
  saved=await getQuotationForActor(actor,doc.id);await expect(client.quotationRevision.update({where:{id:saved.revisions[0].id},data:{stateOfSupplyCode:"29"}})).rejects.toThrow("QUOTATION_REVISION_COMMERCIAL_IMMUTABLE");
  const next=await createQuotationRevisionForActor(actor,doc.id,input);expect(next.stateOfSupplyCode).toBe("27");
  await expect(createQuotationForActor(actor,{...input,stateOfSupplyCode:"99"})).rejects.toThrow();expect(await client.journalEntry.count({where:{companyId}})).toBe(0);
 });

 it("persists inclusive mode through approval and revisions while preserving entered rates",async()=>{
  const data={...input,taxMode:"INCLUSIVE",stateOfSupplyCode:"29",roundOffEnabled:true,lines:[{lineType:"CUSTOM",itemName:"Inclusive fixture",quantity:"5",rate:"82.60",taxRate:"18"}],paymentSchedule:[{label:"Full",valueType:"PERCENTAGE",value:"100"}]};
  const doc=await createQuotationForActor(actor,data);let saved=await getQuotationForActor(actor,doc.id);const revision=saved.revisions[0];
  expect(revision.taxMode).toBe("INCLUSIVE");expect(revision.grandTotal.toFixed(2)).toBe("413.00");expect(revision.taxTotal.toFixed(2)).toBe("63.00");expect(revision.lines[0].rate.toFixed(2)).toBe("82.60");expect(revision.paymentSchedule[0].amount.toFixed(2)).toBe("413.00");
  const {taxMode:_mode,...oldClient}=data;void _mode;await updateQuotationDraftForActor(actor,doc.id,oldClient);expect((await getQuotationForActor(actor,doc.id)).revisions[0].taxMode).toBe("INCLUSIVE");
  await updateQuotationDraftForActor(actor,doc.id,{...data,taxMode:"EXCLUSIVE",roundOffEnabled:false});expect((await getQuotationForActor(actor,doc.id)).revisions[0].grandTotal.toFixed(2)).toBe("487.34");
  await updateQuotationDraftForActor(actor,doc.id,data);await transitionQuotationForActor(actor,doc.id,"PENDING_APPROVAL");await transitionQuotationForActor(actor,doc.id,"APPROVED");
  saved=await getQuotationForActor(actor,doc.id);await expect(client.quotationRevision.update({where:{id:saved.revisions[0].id},data:{taxMode:"EXCLUSIVE"}})).rejects.toThrow("QUOTATION_REVISION_COMMERCIAL_IMMUTABLE");
  const next=await createQuotationRevisionForActor(actor,doc.id,oldClient);expect(next.taxMode).toBe("INCLUSIVE");expect(next.grandTotal.toFixed(2)).toBe("413.00");
  expect(await client.journalEntry.count({where:{companyId}})).toBe(0);
 });

});

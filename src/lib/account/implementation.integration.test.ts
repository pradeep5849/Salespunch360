import {randomUUID} from "node:crypto";
import {beforeAll,afterAll,describe,expect,it,vi} from "vitest";
import {PrismaClient} from "@prisma/client";
const url=process.env.ACCOUNT_INTEGRATION_DATABASE_URL;
if(url&&!['localhost','127.0.0.1'].includes(new URL(url).hostname))throw new Error('Integration tests require an isolated local database');
const client=new PrismaClient({datasources:{db:{url:url??'postgresql://test:test@127.0.0.1:55432/salespunch360_test'}}});
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_target,key)=>client[key as keyof PrismaClient]})}));
import {assignAssetForActor,createAssetForActor,returnAssetForActor,setAssetStatusForActor} from './assets';
import {reverseExpenseForActor} from './expenses';
import {postJournalInTx} from '@/lib/accounting/service';
import {saveCustomFieldValuesInTx} from './custom-field-values';
import type {ProjectActor} from './projects';
const companyId=randomUUID(),branchA=randomUUID(),branchB=randomUUID(),userId=randomUUID(),fyId=randomUUID(),cashId=randomUUID(),expenseId=randomUUID(),categoryId=randomUUID();
const actor={id:userId,companyId,accountRole:'ACCOUNT_ADMIN',branchAccessScope:'ALL_BRANCHES',branchIds:[branchA,branchB]} as ProjectActor;
const input=(branchId=branchA)=>({branchId,name:'Integration equipment',assetType:'EQUIPMENT',purchaseDate:'2026-10-09',purchaseValue:'100',requestKey:randomUUID()});
describe.skipIf(!url)('A042/A045/A046 real PostgreSQL integrity',()=>{
 beforeAll(async()=>{
  await client.company.create({data:{id:companyId,name:'Isolated implementation tests',slug:`integration-${companyId}`,productEdition:'SALESPUNCH360_ACCOUNT'}});
  await client.accountSettings.create({data:{companyId,enabledModules:['ASSETS']}});
  await client.branch.createMany({data:[{id:branchA,companyId,name:'A',code:'A',isPrimary:true},{id:branchB,companyId,name:'B',code:'B'}]});
  await client.financialYear.create({data:{id:fyId,companyId,name:'2026-27',startDate:new Date('2026-04-01'),endDate:new Date('2027-03-31')}});
  await client.ledgerAccount.createMany({data:[{id:cashId,companyId,code:'100',name:'Cash',accountClass:'ASSET',normalBalance:'DEBIT'},{id:expenseId,companyId,code:'500',name:'Expense',accountClass:'EXPENSE',normalBalance:'DEBIT'}]});
  await client.expenseCategory.create({data:{id:categoryId,companyId,name:'Test expense',scope:'EXPENSE',defaultLedgerAccountId:expenseId}});
  await client.user.create({data:{id:userId,companyId,name:'Test admin',email:`${userId}@example.test`,passwordHash:'test-only',role:'ACCOUNT_USER',accountRole:'ACCOUNT_ADMIN',accountAccessActive:true}});
 });
 afterAll(async()=>{
  await client.expenseTransaction.deleteMany({where:{companyId}});await client.expenseCategory.deleteMany({where:{companyId}});
  await client.$transaction(async tx=>{await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;await tx.accountingAuditEvent.deleteMany({where:{companyId}});await tx.journalLine.deleteMany({where:{companyId}});await tx.journalEntry.deleteMany({where:{companyId}})});
  await client.ledgerAccount.deleteMany({where:{companyId}});await client.financialYear.deleteMany({where:{companyId}});
  await client.assetAssignmentHistory.deleteMany({where:{companyId}});await client.asset.deleteMany({where:{companyId}});await client.accountOperationalAudit.deleteMany({where:{companyId}});
  await client.customFieldDefinition.deleteMany({where:{companyId}});await client.vendor.deleteMany({where:{companyId}});await client.numberingSeries.deleteMany({where:{companyId}});await client.accountSettings.deleteMany({where:{companyId}});await client.user.deleteMany({where:{companyId}});await client.branch.deleteMany({where:{companyId}});await client.company.deleteMany({where:{id:companyId}});await client.$disconnect();
 });
 it('allocates company-unique asset numbers across branches',async()=>{const first=await createAssetForActor(actor,input(branchA)),second=await createAssetForActor(actor,input(branchB));expect(first.assetNumber).not.toBe(second.assetNumber)});
 it('deduplicates concurrent create requests without duplicate numbers or audits',async()=>{const request=input();const rows=await Promise.all([createAssetForActor(actor,request),createAssetForActor(actor,request)]);expect(rows[0].id).toBe(rows[1].id);expect(await client.asset.count({where:{companyId,creationRequestKey:request.requestKey}})).toBe(1);expect(await client.accountOperationalAudit.count({where:{companyId,entityId:rows[0].id,eventType:'ASSET_CREATED'}})).toBe(1)});
 it('preserves assignment notes across return and writes one return audit',async()=>{const row=await createAssetForActor(actor,input());await assignAssetForActor(actor,row.id,userId,'Original assignment');await returnAssetForActor(actor,row.id,'Returned safely');const history=await client.assetAssignmentHistory.findFirstOrThrow({where:{companyId,assetId:row.id}});expect(history.notes).toBe('Original assignment');expect(history.returnedAt).not.toBeNull();expect((await client.asset.findUniqueOrThrow({where:{id:row.id}})).status).toBe('ACTIVE')});
 it('rejects conflicting assignment/status operations without invalid state',async()=>{const row=await createAssetForActor(actor,input());const outcomes=await Promise.allSettled([assignAssetForActor(actor,row.id,userId),setAssetStatusForActor(actor,row.id,'DISPOSED')]);expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);const final=await client.asset.findUniqueOrThrow({where:{id:row.id}});expect(final.status==='DISPOSED'?final.assignedUserId===null:final.status==='ASSIGNED'&&final.assignedUserId===userId).toBe(true)});
 it('rolls back a vendor when required custom fields fail',async()=>{await client.customFieldDefinition.create({data:{companyId,entityType:'VENDOR',fieldKey:'required_test',label:'Required',dataType:'TEXT',isRequired:true}});const name=randomUUID();await expect(client.$transaction(async tx=>{const row=await tx.vendor.create({data:{companyId,name}});await saveCustomFieldValuesInTx(tx,companyId,'VENDOR',row.id,{})})).rejects.toThrow('CUSTOM_FIELDS_REQUIRED');expect(await client.vendor.count({where:{companyId,name}})).toBe(0)});
 it('reverses expense and journal atomically and rejects repeated reversal',async()=>{
  const id=randomUUID(),journal=await client.$transaction(tx=>postJournalInTx(tx,actor,{financialYearId:fyId,branchId:branchA,entryDate:'2026-10-09',sourceType:'EXPENSE',sourceId:id,lines:[{ledgerAccountId:expenseId,debit:'100',credit:'0'},{ledgerAccountId:cashId,debit:'0',credit:'100'}]}));
  await client.expenseTransaction.create({data:{id,companyId,branchId:branchA,categoryId,type:'OFFICE_EXPENSE',status:'POSTED',transactionNumber:'EXP-test',transactionDate:new Date('2026-10-09'),taxableAmount:'100',totalAmount:'100',journalEntryId:journal.id,createdById:userId}});
  const reversed=await reverseExpenseForActor(actor,id,new Date('2026-10-10'),'Integration correction');
  expect((await client.expenseTransaction.findUniqueOrThrow({where:{id}})).reversalJournalId).toBe(reversed.id);
  expect((await client.journalEntry.findUniqueOrThrow({where:{id:journal.id}})).status).toBe('REVERSED');
  await expect(reverseExpenseForActor(actor,id,new Date('2026-10-10'),'Repeated correction')).rejects.toThrow();
  expect(await client.journalEntry.count({where:{companyId,reversalOfId:journal.id}})).toBe(1);
 });
 it('rolls back asset status when its audit insert fails in PostgreSQL',async()=>{
  const row=await createAssetForActor(actor,input());
  const suffix=randomUUID().replaceAll('-',''), fn=`integration_audit_${suffix}`;
  await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId" = '${companyId}'::uuid AND NEW."eventType" = 'ASSET_STATUS_CHANGED' THEN RAISE EXCEPTION 'integration audit failure'; END IF; RETURN NEW; END $$`);
  await client.$executeRawUnsafe(`CREATE TRIGGER ${fn} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try {
   await expect(setAssetStatusForActor(actor,row.id,'RETIRED')).rejects.toThrow('integration audit failure');
   expect((await client.asset.findUniqueOrThrow({where:{id:row.id}})).status).toBe('ACTIVE');
  } finally {await client.$executeRawUnsafe(`DROP TRIGGER ${fn} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION ${fn}()`)}
 });
 it('enforces module OFF without deleting historical assets',async()=>{const before=await client.asset.count({where:{companyId}});await client.accountSettings.update({where:{companyId},data:{enabledModules:[]}});await expect(createAssetForActor(actor,input())).rejects.toThrow('MODULE_DISABLED:ASSETS');expect(await client.asset.count({where:{companyId}})).toBe(before)});
});

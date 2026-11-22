import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_,key)=>{
 if(key==='$transaction')return (work:(tx:Prisma.TransactionClient)=>Promise<unknown>,options?:{isolationLevel?:Prisma.TransactionIsolationLevel})=>client.$transaction(tx=>work(new Proxy(tx,{get:(target,property)=>{
  if(property==='salesNotification')return new Proxy(target.salesNotification,{get:(delegate,method)=>{if(method==='upsert'&&rejectNotice)return async()=>{throw new Error('FIXTURE_NOTIFICATION_REJECTED')};const value=Reflect.get(delegate,method);return typeof value==='function'?value.bind(delegate):value}});
  const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
 }})),{maxWait:10000,timeout:10000,...options});
 const value=client[key as keyof PrismaClient];return typeof value==='function'?value.bind(client):value;
}})}));
import {verifyAccountDataForActor} from '@/lib/account/utilities';
import {createTelecallerEmployeeForActor} from '@/lib/telecalling/team';
import {callbackPageForActor} from '@/lib/telecalling/callback-page';
import {createCustomerForActor} from '@/lib/customers/service';
import {mobileCreateCustomer} from '@/lib/mobile/customers';
import {createFollowUpTaskForActor,cancelFollowUpTaskForActor} from '@/lib/follow-up-tasks/service';
import {createTelecallerCallFollowUpForActor} from '@/lib/follow-up-tasks/telecaller-assignment';
const databaseUrl=process.env.CREATION_REGRESSION_DATABASE_URL;
const url=new URL(databaseUrl??'postgresql://unused:unused@127.0.0.1:55433/unused_ci');
if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_ci'))throw new Error('Isolated local creation fixture required');
const client=new PrismaClient({datasources:{db:{url:url.href}}});
const companyId=randomUUID(),branchId=randomUUID(),ownerId=randomUUID(),salesId=randomUUID(),otherId=randomUUID(),teleId=randomUUID(),leadId=randomUUID(),secondAdminId=randomUUID(),foreignCompanyId=randomUUID(),foreignBranchId=randomUUID(),foreignOwnerId=randomUUID();
const owner={id:ownerId,name:'Fixture owner',companyId,salesRole:'PRIMARY_ADMIN' as const,branchAccessScope:'ALL_BRANCHES' as const,branchIds:[branchId]};
const sales={...owner,id:salesId,salesRole:'SALES' as const};
let rejectNotice=false;
beforeAll(async()=>{if(!databaseUrl)return;vi.stubEnv('NODE_ENV','development');await client.company.create({data:{id:companyId,name:'Creation replay fixture',slug:`creation-${companyId}`,productEdition:'SALESPUNCH360_PLUS',subscriptionStatus:'ACTIVE'}});await client.branch.create({data:{id:branchId,companyId,name:'Fixture',code:'FIXTURE',isPrimary:true}});await client.companySubscription.create({data:{companyId,status:'ACTIVE',billingPeriod:'YEARLY',adminSeats:1,managerSeats:0,salesSeats:2,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+86400000)}});for(const id of[ownerId,salesId,otherId])await client.user.create({data:{id,companyId,name:'Fixture user',email:`${id}@example.invalid`,passwordHash:'fixture-only',role:id===ownerId?'COMPANY_ADMIN':'SALES',salesRole:id===ownerId?'PRIMARY_ADMIN':'SALES',salesAccessActive:true}});const teleSub=randomUUID();await client.$executeRaw`INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt") VALUES (${teleSub}::uuid,${companyId}::uuid,'ACTIVE','YEARLY',1,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 day')`;await client.user.create({data:{id:teleId,companyId,name:'Fixture caller',email:`${teleId}@example.invalid`,passwordHash:'fixture-only',role:'SALES',salesRole:'SALES',designation:'Telecaller',salesAccessActive:false}});await client.lead.create({data:{id:leadId,companyId,branchId,assignedUserId:salesId,createdByUserId:ownerId,title:'Fixture lead'}});await client.user.create({data:{id:secondAdminId,companyId,name:'Fixture second admin',email:`${secondAdminId}@example.invalid`,passwordHash:'fixture-only',role:'FIELD_ADMIN',salesRole:'ADMIN',salesAccessActive:true}});await client.company.create({data:{id:foreignCompanyId,name:'Other fixture',slug:`other-${foreignCompanyId}`,productEdition:'SALESPUNCH360_PLUS'}});await client.branch.create({data:{id:foreignBranchId,companyId:foreignCompanyId,name:'Other branch',code:'FIXTURE',isPrimary:true}});await client.user.create({data:{id:foreignOwnerId,companyId:foreignCompanyId,name:'Other owner',email:`${foreignOwnerId}@example.invalid`,passwordHash:'fixture-only',role:'COMPANY_ADMIN',salesRole:'PRIMARY_ADMIN',salesAccessActive:true}})},30000);
beforeEach(async()=>{if(!databaseUrl)return;rejectNotice=false;await client.$transaction(async tx=>{await tx.$queryRaw`SELECT set_config('app.tenant_cleanup_company_id', ${companyId}, true)`;await tx.salesNotification.deleteMany({where:{companyId}});await tx.followUpTask.deleteMany({where:{companyId}});await tx.leadActivity.deleteMany({where:{companyId}});await tx.lead.deleteMany({where:{companyId,customerId:{not:null}}});await tx.customer.deleteMany({where:{companyId}});await tx.lead.update({where:{id:leadId},data:{followUpAt:null}})})});
afterAll(async()=>{vi.unstubAllEnvs();await client.$disconnect()});
const customer=(key=randomUUID())=>({creationRequestKey:key,name:'Replay lead',phone:'9000000000',branchId,assignedUserId:salesId});
const follow=(key=randomUUID())=>({creationRequestKey:key,leadId,dueDate:'2026-11-23',type:'VISIT',notes:'Fixture note'});
it.skipIf(!databaseUrl)('replays one customer and linked lead across sequential retries',async()=>{const input=customer(),first=await createCustomerForActor(owner,input),second=await createCustomerForActor(owner,input);expect(second.id).toBe(first.id);expect(await client.customer.count({where:{companyId}})).toBe(1);expect(await client.lead.count({where:{companyId,customerId:first.id}})).toBe(1);expect(first).not.toHaveProperty('creationRequestHash')});
it.skipIf(!databaseUrl)('web/native concurrent customer retries return one committed result',async()=>{const input=customer();const results=await Promise.all([createCustomerForActor(owner,input),mobileCreateCustomer(owner as unknown as Parameters<typeof mobileCreateCustomer>[0],input)]);expect(results[0].id).toBe(results[1].id);expect(await client.customer.count({where:{companyId}})).toBe(1);expect(await client.lead.count({where:{companyId,customerId:results[0].id}})).toBe(1)});
it.skipIf(!databaseUrl)('rejects changed customer intent under a reused key',async()=>{const input=customer();await createCustomerForActor(owner,input);await expect(createCustomerForActor(owner,{...input,name:'Different'})).rejects.toThrow('CREATION_REQUEST_CONFLICT');expect(await client.customer.count({where:{companyId}})).toBe(1)});
it.skipIf(!databaseUrl)('allows independent submissions sharing the same name and phone',async()=>{const first=await createCustomerForActor(owner,customer()),second=await createCustomerForActor(owner,customer());expect(second.id).not.toBe(first.id);expect(await client.customer.count({where:{companyId}})).toBe(2)});
it.skipIf(!databaseUrl)('replays a task without a second notification',async()=>{const input=follow(),first=await createFollowUpTaskForActor(sales,input),second=await createFollowUpTaskForActor(sales,input);expect(second.id).toBe(first.id);expect(await client.followUpTask.count({where:{companyId}})).toBe(1);expect(await client.salesNotification.count({where:{companyId,eventType:'FOLLOW_UP_ASSIGNED'}})).toBe(1)});
it.skipIf(!databaseUrl)('concurrent task retries keep one task and one notice',async()=>{const input=follow(),results=await Promise.all([createFollowUpTaskForActor(sales,input),createFollowUpTaskForActor(sales,input)]);expect(results[0].id).toBe(results[1].id);expect(await client.followUpTask.count({where:{companyId}})).toBe(1);expect(await client.salesNotification.count({where:{companyId,eventType:'FOLLOW_UP_ASSIGNED'}})).toBe(1)});
it.skipIf(!databaseUrl)('Telecaller-assigned Call retries also keep one task and notice',async()=>{const input={...follow(),assignedUserId:teleId},first=await createTelecallerCallFollowUpForActor(owner,input),second=await createTelecallerCallFollowUpForActor(owner,input);expect(first.id).toBe(second.id);expect(await client.followUpTask.count({where:{companyId}})).toBe(1);expect(await client.salesNotification.count({where:{companyId,recipientUserId:teleId}})).toBe(1)});
it.skipIf(!databaseUrl)('rejects a changed task date under the same key',async()=>{const input=follow();await createFollowUpTaskForActor(sales,input);await expect(createFollowUpTaskForActor(sales,{...input,dueDate:'2026-11-24'})).rejects.toThrow('CREATION_REQUEST_CONFLICT');expect(await client.followUpTask.count({where:{companyId}})).toBe(1)});
it.skipIf(!databaseUrl)('replay does not bypass current lead visibility',async()=>{const input=follow();await createFollowUpTaskForActor(sales,input);await expect(createFollowUpTaskForActor({...sales,id:otherId},input)).rejects.toThrow('NOT_FOUND');expect(await client.followUpTask.count({where:{companyId}})).toBe(1)});
it.skipIf(!databaseUrl)('failed notification rolls back the keyed task and permits a clean retry',async()=>{const input=follow();rejectNotice=true;await expect(createFollowUpTaskForActor(sales,input)).rejects.toThrow('FIXTURE_NOTIFICATION_REJECTED');expect(await client.followUpTask.count({where:{companyId}})).toBe(0);rejectNotice=false;await createFollowUpTaskForActor(sales,input);expect(await client.followUpTask.count({where:{companyId}})).toBe(1)});

it.skipIf(!databaseUrl)('does not replay another actor submission under a guessed key',async()=>{const input=customer();await createCustomerForActor(owner,input);await expect(createCustomerForActor({...owner,id:secondAdminId,salesRole:'ADMIN'},input)).rejects.toThrow('CREATION_REQUEST_CONFLICT');expect(await client.customer.count({where:{companyId}})).toBe(1)});
it.skipIf(!databaseUrl)('allows the same key in another authorized company without crossing results',async()=>{const input=customer();const first=await createCustomerForActor(owner,input);const second=await createCustomerForActor({id:foreignOwnerId,companyId:foreignCompanyId,salesRole:'PRIMARY_ADMIN'},{...input,branchId:foreignBranchId,assignedUserId:undefined});expect(second.id).not.toBe(first.id);expect(second.companyId).toBe(foreignCompanyId)});
it.skipIf(!databaseUrl)('replay preserves cancellation and does not reopen completed intent',async()=>{const input=follow(),first=await createFollowUpTaskForActor(sales,input);await cancelFollowUpTaskForActor(sales,first.id);const replay=await createFollowUpTaskForActor(sales,input);expect(replay.status).toBe('CANCELLED');expect((await client.lead.findUniqueOrThrow({where:{id:leadId}})).followUpAt).toBeNull();expect(await client.followUpTask.count({where:{companyId}})).toBe(1)});

it.skipIf(!databaseUrl)('pages mixed callbacks and assigned tasks beyond both former caps without gaps',async()=>{
 const leadIds=Array.from({length:602},()=>randomUUID()),due=new Date('2026-12-01T10:00:00Z');
 await client.lead.createMany({data:leadIds.map(id=>({id,companyId,branchId,assignedUserId:salesId,createdByUserId:ownerId,title:'Queue fixture'}))});
 await client.$executeRaw(Prisma.sql`INSERT INTO "lead_calls" (id,"companyId","leadId","callerUserId",result,"calledAt","nextCallbackAt","callbackAssigneeUserId","createdAt","updatedAt") VALUES ${Prisma.join(leadIds.slice(0,301).map(leadId=>Prisma.sql`(${randomUUID()}::uuid,${companyId}::uuid,${leadId}::uuid,${ownerId}::uuid,'CALL_BACK',NOW(),${due},${ownerId}::uuid,NOW(),NOW())`))}`);
 await client.followUpTask.createMany({data:leadIds.slice(301).map(leadId=>({companyId,branchId,leadId,assignedUserId:teleId,createdByUserId:ownerId,dueDate:due,notes:'[[SP360_FOLLOW_UP:CALL]]fixture'}))});
 const ids:string[]=[];for(let page=1;page<=7;page++){const result=await callbackPageForActor(owner,page);expect(result.page).toBe(page);expect(result.items.length).toBe(page===7?2:100);expect(result.hasMore).toBe(page<7);ids.push(...result.items.map(row=>row.id));}
 expect(new Set(ids).size).toBe(602);
 const ownCalls=await callbackPageForActor(sales);expect(ownCalls.items).toEqual([]);
 const teleCalls=await callbackPageForActor({...sales,id:teleId,designation:'Telecaller'});expect(teleCalls.items).toHaveLength(100);expect(teleCalls.items.every(row=>row.followUpTaskId&&row.notes==='fixture')).toBe(true);
},30000);

it.skipIf(!databaseUrl)('allows one concurrent paid Telecaller creation into the final seat without field access',async()=>{
 await expect(createTelecallerEmployeeForActor({...owner,salesRole:'ADMIN'},{})).rejects.toThrow('NOT_AUTHORIZED');
 await client.$executeRaw`UPDATE "telecaller_subscriptions" SET seats=2 WHERE "companyId"=${companyId}::uuid AND status='ACTIVE'`;
 const results=await Promise.allSettled([0,1].map(index=>createTelecallerEmployeeForActor(owner,{name:'New fixture caller',email:`caller-${randomUUID()}-${index}@example.invalid`,password:'FixtureSecure12345',confirmPassword:'FixtureSecure12345'})));
 expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
 const denied=results.find(result=>result.status==='rejected') as PromiseRejectedResult;expect(denied.reason.message).toBe('TELECALLER_SEAT_LIMIT');
 const created=(results.find(result=>result.status==='fulfilled') as PromiseFulfilledResult<{id:string}>).value;
 expect(await client.user.findUnique({where:{id:created.id},select:{companyId:true,salesRole:true,designation:true,salesAccessActive:true,accountRole:true,accountAccessActive:true}})).toEqual({companyId,salesRole:'SALES',designation:'Telecaller',salesAccessActive:false,accountRole:null,accountAccessActive:false});
},30000);

it.skipIf(!databaseUrl)('returns an explicit incomplete scan before loading an oversized real company collection',async()=>{
 await client.$executeRaw(Prisma.sql`INSERT INTO "customers" (id,"companyId","branchId",name,"createdAt","updatedAt") SELECT gen_random_uuid(),${companyId}::uuid,${branchId}::uuid,'Verification fixture '||n,NOW(),NOW() FROM generate_series(1,10001) n`);
 const checks=await client.$transaction(tx=>verifyAccountDataForActor({id:ownerId,companyId},tx),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
 expect(checks).toHaveLength(1);expect(checks[0]).toMatchObject({status:'ERROR',affected:0,incomplete:true});expect(checks[0].samples).toContain('Customers: 10001 (limit 10000)');
},30000);

it.skipIf(!databaseUrl)('verifies stored warehouse transfer precision and reports an unmatched source',async()=>{
 const unit=await client.accountUnit.create({data:{companyId,name:'Fixture unit',symbol:'FX'}});
 const product=await client.accountProduct.create({data:{companyId,name:'Fixture product',unitId:unit.id,trackInventory:true}});
 const source=await client.warehouse.create({data:{companyId,branchId,name:'Fixture source',code:`S-${randomUUID().slice(0,8)}`}}),destination=await client.warehouse.create({data:{companyId,branchId,name:'Fixture destination',code:`D-${randomUUID().slice(0,8)}`}});
 const sourceId=randomUUID(),base={companyId,branchId,productId:product.id,quantity:new Prisma.Decimal(2),unitCost:new Prisma.Decimal('1.2345'),totalCost:new Prisma.Decimal('2.47'),sourceType:'TRANSFER',sourceId,movementDate:new Date('2026-11-22T00:00:00Z'),createdById:ownerId};
 await client.stockMovement.createMany({data:[{...base,warehouseId:source.id,movementType:'TRANSFER_OUT'},{...base,warehouseId:destination.id,movementType:'TRANSFER_IN'}]});
 const scan=()=>client.$transaction(tx=>verifyAccountDataForActor({id:ownerId,companyId},tx),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:15000});
 expect((await scan()).find(row=>row.check==='Warehouse transfer legs reconcile')).toMatchObject({status:'PASS',affected:0});
 const broken=randomUUID();await client.stockMovement.create({data:{...base,sourceId:broken,warehouseId:source.id,movementType:'TRANSFER_OUT'}});
 expect((await scan()).find(row=>row.check==='Warehouse transfer legs reconcile')).toMatchObject({status:'ERROR',affected:1,samples:[broken]});
},30000);

import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_,key)=>key==='$transaction'?async(work:(tx:Prisma.TransactionClient)=>Promise<unknown>,options?:{isolationLevel?:Prisma.TransactionIsolationLevel})=>client.$transaction(tx=>work(new Proxy(tx,{get:(target,property)=>{
 if(property==='$executeRaw')return async(query:Prisma.Sql,...args:unknown[])=>{if(rejectCallWrite&&query.text?.includes('INSERT INTO "lead_calls"'))throw new Error('FIXTURE_CALL_WRITE_REJECTED');return Reflect.apply(target.$executeRaw,target,[query,...args])};
 const value=Reflect.get(target,property);return typeof value==='function'?value.bind(target):value;
}})),options):client[key as keyof PrismaClient]})}));
vi.mock('@/lib/auth/authorization',()=>({requireSalesWorkspace:async()=>actor,requireSalesWorkspaceForMutation:async()=>actor,requirePermission:async()=>actor,requirePermissionForMutation:async()=>actor,AuthorizationError:class extends Error{}}));
vi.mock('@/lib/billing/entitlement',()=>({assertOperationalWrite:vi.fn(),effectiveEntitlement:async()=>({operationalWritesAllowed:true})}));
import {recordLeadCall} from './service';
import {mobileRecordLeadCall} from '@/lib/mobile/telecalling';
import {createTelecallerCallFollowUpForActor} from '@/lib/follow-up-tasks/telecaller-assignment';
import {editLeadForActor} from '@/lib/leads/service';
const databaseUrl=process.env.FOLLOWUP_REGRESSION_DATABASE_URL;
const url=new URL(databaseUrl??'postgresql://unused:unused@127.0.0.1:55433/unused_ci');
if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_ci'))throw new Error('Isolated local follow-up fixture required');
const client=new PrismaClient({datasources:{db:{url:url.href}}});
const companyId=randomUUID(),branchId=randomUUID(),ownerId=randomUUID(),salesId=randomUUID(),otherId=randomUUID(),teleId=randomUUID(),leadId=randomUUID();
const actor={id:salesId,name:'Fixture Sales',email:`${salesId}@example.invalid`,role:'SALES' as const,salesRole:'SALES' as const,managerType:null,companyId,branchAccessScope:'SELECTED_BRANCHES' as const,branchIds:[branchId],designation:null};
let rejectCallWrite=false;
beforeAll(async()=>{if(!databaseUrl)return;await client.company.create({data:{id:companyId,name:'Atomic Call fixture',slug:`followup-${companyId}`,productEdition:'SALESPUNCH360_PLUS'}});await client.branch.create({data:{id:branchId,companyId,name:'Fixture',code:'FIXTURE',isPrimary:true}});for(const id of[ownerId,salesId,otherId])await client.user.create({data:{id,companyId,name:'Fixture user',email:`${id}@example.invalid`,passwordHash:'fixture-only',role:id===ownerId?'COMPANY_ADMIN':'SALES',salesRole:id===ownerId?'PRIMARY_ADMIN':'SALES',salesAccessActive:true}});await client.companySubscription.create({data:{companyId,status:'ACTIVE',billingPeriod:'YEARLY',managerSeats:0,salesSeats:2,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+86400000)}});const subId=randomUUID();await client.$executeRaw`INSERT INTO "telecaller_subscriptions" (id,"companyId",status,"billingPeriod",seats,"startsAt","endsAt") VALUES (${subId}::uuid,${companyId}::uuid,'ACTIVE','YEARLY',1,NOW()-INTERVAL '1 hour',NOW()+INTERVAL '1 day')`;await client.user.create({data:{id:teleId,companyId,name:'Fixture caller',email:`${teleId}@example.invalid`,passwordHash:'fixture-only',role:'SALES',salesRole:'SALES',designation:'Telecaller',salesAccessActive:false}});await client.lead.create({data:{id:leadId,companyId,branchId,assignedUserId:salesId,createdByUserId:ownerId,title:'Fixture lead'}})},30000);
beforeEach(async()=>{if(!databaseUrl)return;rejectCallWrite=false;await client.salesNotification.deleteMany({where:{companyId}});await client.$executeRaw`DELETE FROM "lead_calls" WHERE "companyId"=${companyId}::uuid`;await client.followUpTask.deleteMany({where:{companyId}});await client.lead.update({where:{id:leadId},data:{assignedUserId:salesId,version:1,followUpAt:null}})});
afterAll(async()=>client.$disconnect());
async function task(assignedUserId=salesId){const created=await client.followUpTask.create({data:{companyId,branchId,leadId,assignedUserId,createdByUserId:ownerId,dueDate:new Date('2026-11-22T00:00Z'),notes:'[[SP360_FOLLOW_UP:CALL]]\nFixture Call'}});await client.lead.update({where:{id:leadId},data:{followUpAt:created.dueDate}});return created}
async function countCalls(){return Number((await client.$queryRaw<{count:bigint}[]>`SELECT COUNT(*)::bigint AS count FROM "lead_calls" WHERE "companyId"=${companyId}::uuid`)[0].count)}
it.skipIf(!databaseUrl)('commits Web Call and linked task completion together',async()=>{const follow=await task();await recordLeadCall({leadId,result:'CONNECTED',followUpTaskId:follow.id});expect(await countCalls()).toBe(1);expect((await client.followUpTask.findUniqueOrThrow({where:{id:follow.id}})).status).toBe('COMPLETED');expect((await client.lead.findUniqueOrThrow({where:{id:leadId}})).followUpAt).toBeNull()});
it.skipIf(!databaseUrl)('rolls back task completion and cache when Call storage fails',async()=>{const follow=await task();rejectCallWrite=true;await expect(recordLeadCall({leadId,result:'CONNECTED',followUpTaskId:follow.id})).rejects.toThrow('FIXTURE_CALL_WRITE_REJECTED');expect(await countCalls()).toBe(0);expect((await client.followUpTask.findUniqueOrThrow({where:{id:follow.id}})).status).toBe('PENDING');expect((await client.lead.findUniqueOrThrow({where:{id:leadId}})).followUpAt).toEqual(follow.dueDate)});
it.skipIf(!databaseUrl)('does not save a Call for another assignee linked task',async()=>{const follow=await task(otherId);await expect(recordLeadCall({leadId,result:'CONNECTED',followUpTaskId:follow.id})).rejects.toThrow('NOT_FOUND');expect(await countCalls()).toBe(0)});
it.skipIf(!databaseUrl)('uses the same atomic completion for native Call recording',async()=>{const follow=await task();await mobileRecordLeadCall(actor,{leadId,result:'CONNECTED',followUpTaskId:follow.id});expect(await countCalls()).toBe(1);expect((await client.followUpTask.findUniqueOrThrow({where:{id:follow.id}})).status).toBe('COMPLETED')});
it.skipIf(!databaseUrl)('stores the Telecaller assignment notification with its task',async()=>{const follow=await createTelecallerCallFollowUpForActor(actor,{leadId,assignedUserId:teleId,dueDate:'2026-11-22',notes:'Call fixture'});expect(await client.salesNotification.count({where:{companyId,recipientUserId:teleId,eventType:'FOLLOW_UP_ASSIGNED',relatedEntityId:follow.id}})).toBe(1)});
it.skipIf(!databaseUrl)('notifies the new and former pending owners after lead handover',async()=>{const follow=await task();await editLeadForActor({...actor,id:ownerId,salesRole:'PRIMARY_ADMIN'},{leadId,version:1,title:'Fixture lead',source:'MANUAL',assignedUserId:otherId});expect((await client.followUpTask.findUniqueOrThrow({where:{id:follow.id}})).assignedUserId).toBe(otherId);expect(await client.salesNotification.count({where:{companyId,relatedEntityId:follow.id,recipientUserId:{in:[salesId,otherId]}}})).toBe(2)});
it.skipIf(!databaseUrl)('creates one shared timestamp Call task and a notification atomically with the callback',async()=>{
 const due=new Date(Date.now()+86400000),call=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:due,notes:'Call tomorrow'});
 const task=await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:call.id}});
 expect(task).toMatchObject({companyId,branchId,leadId,assignedUserId:salesId,status:'PENDING',notes:'[[SP360_FOLLOW_UP:CALL]]\nCall tomorrow'});expect(task.callbackAt).toEqual(due);
 expect(await client.salesNotification.count({where:{companyId,relatedEntityId:task.id,eventType:'FOLLOW_UP_ASSIGNED',recipientUserId:salesId}})).toBe(1);
 const {callbackPageForActor}=await import('./callback-page');const queue=await callbackPageForActor(actor);
 const {mobileCallbackQueue}=await import('@/lib/mobile/telecalling');const {listAssignedTelecallerCallsForActor}=await import('@/lib/follow-up-tasks/telecaller-assignment');expect(await mobileCallbackQueue(actor)).toEqual([]);expect(await listAssignedTelecallerCallsForActor(actor)).toHaveLength(1);
 expect(queue.items).toHaveLength(1);expect(queue.items[0]).toMatchObject({id:task.id,followUpTaskId:task.id,callbackCallId:call.id,nextCallbackAt:due,notes:'Call tomorrow'});
});
it.skipIf(!databaseUrl)('a later call closes only its own source callback and queues the next callback once',async()=>{
 const due=new Date(Date.now()+86400000),first=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:due});
 const second=await mobileRecordLeadCall(actor,{leadId,result:'CALL_BACK',nextCallbackAt:new Date(due.getTime()+3600000).toISOString()});
 expect((await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:first.id}})).status).toBe('COMPLETED');
 expect((await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:second.id}})).status).toBe('PENDING');
 expect(await client.followUpTask.count({where:{companyId,status:'PENDING'}})).toBe(1);
});
it.skipIf(!databaseUrl)('completion and cancellation disappear from callbacks without returning the old raw row',async()=>{
 const {callbackPageForActor}=await import('./callback-page');const {completeCallFollowUpTaskForActor}=await import('@/lib/follow-up-tasks/call-completion');const {cancelFollowUpTaskForActor}=await import('@/lib/follow-up-tasks/service');
 let call=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:new Date(Date.now()+86400000)});
 let task=await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:call.id}});
 await completeCallFollowUpTaskForActor(actor,task.id,'Spoke with lead');expect((await callbackPageForActor(actor)).items).toEqual([]);
 call=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:new Date(Date.now()+86400000)});task=await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:call.id}});
 await cancelFollowUpTaskForActor(actor,task.id);expect((await callbackPageForActor(actor)).items).toEqual([]);
});
it.skipIf(!databaseUrl)('another caller cannot finish the callback and an unrelated outcome does not close it',async()=>{
 const call=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:new Date(Date.now()+86400000)}),task=await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:call.id}});
 const {completeCallFollowUpTaskForActor}=await import('@/lib/follow-up-tasks/call-completion');
 await expect(completeCallFollowUpTaskForActor({...actor,id:otherId},task.id,'Not mine')).rejects.toThrow('NOT_FOUND');
 await mobileRecordLeadCall({...actor,id:ownerId,salesRole:'PRIMARY_ADMIN'},{leadId,result:'CONNECTED'});
 expect((await client.followUpTask.findUniqueOrThrow({where:{id:task.id}})).status).toBe('PENDING');
});
it.skipIf(!databaseUrl)('failed Call storage leaves the prior pending source task unchanged',async()=>{
 const call=await recordLeadCall({leadId,result:'CALL_BACK',nextCallbackAt:new Date(Date.now()+86400000)});rejectCallWrite=true;
 await expect(recordLeadCall({leadId,result:'CONNECTED'})).rejects.toThrow('FIXTURE_CALL_WRITE_REJECTED');
 expect((await client.followUpTask.findUniqueOrThrow({where:{callbackCallId:call.id}})).status).toBe('PENDING');expect(await countCalls()).toBe(1);
});
it.skipIf(!databaseUrl)('shared filters distinguish elapsed timestamp callbacks from date-only work today',async()=>{
 const now=new Date('2026-11-23T06:00:00Z');const {followUpStatusWhere}=await import('@/lib/follow-up-tasks/list-status');
 const calls=[];for(const [hour,result] of [[5,'past'],[7,'future']] as const){const id=randomUUID();await client.$executeRaw`INSERT INTO lead_calls (id,"companyId","leadId","callerUserId",result,"nextCallbackAt","callbackAssigneeUserId","updatedAt") VALUES (${id}::uuid,${companyId}::uuid,${leadId}::uuid,${salesId}::uuid,'CALL_BACK',${new Date(`2026-11-23T0${hour}:00Z`)},${salesId}::uuid,NOW())`;calls.push(await client.followUpTask.create({data:{companyId,branchId,leadId,assignedUserId:salesId,createdByUserId:salesId,dueDate:new Date('2026-11-23'),callbackAt:new Date(`2026-11-23T0${hour}:00Z`),callbackCallId:id,notes:`[[SP360_FOLLOW_UP:CALL]]\n${result}`}}));}
 const plain=await task();await client.followUpTask.update({where:{id:plain.id},data:{dueDate:new Date('2026-11-23')}});
 const overdue=await client.followUpTask.findMany({where:{companyId,...followUpStatusWhere('OVERDUE',now)}}),today=await client.followUpTask.findMany({where:{companyId,...followUpStatusWhere('TODAY',now)}});
 expect(overdue.map(x=>x.id)).toEqual([calls[0].id]);expect(new Set(today.map(x=>x.id))).toEqual(new Set([calls[1].id,plain.id]));
});
it.skipIf(!databaseUrl)('backfills only unsuperseded raw callbacks and keeps the original India date/time without duplicates',async()=>{
 const {readFileSync}=await import('node:fs');const sql=readFileSync('prisma/migrations/20261123060000_callbacks_shared_tasks/migration.sql','utf8');
 const statement=sql.slice(sql.indexOf('INSERT INTO "follow_up_tasks"'),sql.indexOf('\nUPDATE leads'));
 const old=randomUUID(),latest=randomUUID();
 for(const [id,time,due] of [[old,'2026-11-22T10:00:00Z','2026-11-23T19:00:00Z'],[latest,'2026-11-22T11:00:00Z','2026-11-24T19:00:00Z']] as const)await client.$executeRaw`INSERT INTO lead_calls (id,"companyId","leadId","callerUserId",result,notes,"calledAt","nextCallbackAt","callbackAssigneeUserId","updatedAt") VALUES (${id}::uuid,${companyId}::uuid,${leadId}::uuid,${salesId}::uuid,'CALL_BACK','Legacy',${new Date(time)},${new Date(due)},${salesId}::uuid,NOW())`;
 await client.$executeRawUnsafe(statement);await client.$executeRawUnsafe(statement);
 const tasks=await client.followUpTask.findMany({where:{companyId}});expect(tasks).toHaveLength(1);expect(tasks[0].callbackCallId).toBe(latest);expect(tasks[0].dueDate.toISOString().slice(0,10)).toBe('2026-11-25');expect(tasks[0].callbackAt?.toISOString()).toBe('2026-11-24T19:00:00.000Z');expect(tasks[0].notes).toBe('[[SP360_FOLLOW_UP:CALL]]\nLegacy');
});

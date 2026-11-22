import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_,key)=>{const value=client[key as keyof PrismaClient];return typeof value==='function'?value.bind(client):value}})}));
vi.mock('@/lib/billing/entitlement',()=>({assertOperationalWrite:vi.fn()}));
vi.mock('@/lib/branches/operational-scope',()=>({resolveOperationalWriteBranch:async()=>branchId}));
import {saveMonthlyTargetsForActor} from './service';
import {monthlyRevision} from './monthly-revision';
const databaseUrl=process.env.TARGETS_REGRESSION_DATABASE_URL;
const url=new URL(databaseUrl??'postgresql://unused:unused@127.0.0.1:55433/unused_ci');
if(!['localhost','127.0.0.1'].includes(url.hostname)||!url.pathname.endsWith('_ci'))throw new Error('Isolated local fixture required');
const client=new PrismaClient({datasources:{db:{url:url.href}}});
const companyId=randomUUID(),branchId=randomUUID(),ownerId=randomUUID(),salesId=randomUUID();
const actor={id:ownerId,name:'Fixture owner',companyId,salesRole:'PRIMARY_ADMIN' as const};
const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit'}).formatToParts(new Date());
const month=`${parts.find(p=>p.type==='year')?.value}-${parts.find(p=>p.type==='month')?.value}-01`;
beforeAll(async()=>{if(!databaseUrl)return;await client.company.create({data:{id:companyId,name:'Target race fixture',slug:`targets-${companyId}`}});await client.branch.create({data:{id:branchId,companyId,name:'Fixture',code:'FIX',isPrimary:true}});await client.companySubscription.create({data:{companyId,status:'ACTIVE',billingPeriod:'YEARLY',managerSeats:0,salesSeats:1,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+86400000)}});for(const id of[ownerId,salesId])await client.user.create({data:{id,companyId,name:'Fixture user',email:`${id}@example.invalid`,passwordHash:'fixture-only',role:id===ownerId?'COMPANY_ADMIN':'SALES',salesRole:id===ownerId?'PRIMARY_ADMIN':'SALES',salesAccessActive:true}})},30000);
beforeEach(async()=>{if(databaseUrl)await client.salesTarget.deleteMany({where:{companyId}})});
afterAll(async()=>client.$disconnect());
async function revision(){return monthlyRevision(month,await client.salesTarget.findMany({where:{companyId,assignedUserId:salesId}}))}
function save(revision:string,leadTarget:number,wonTarget:number){return saveMonthlyTargetsForActor(actor,{assignedUserId:salesId,revision,leadTarget,wonTarget})}
it.skipIf(!databaseUrl)('allows only one competing first save and keeps the two metrics paired',async()=>{const initial=await revision();const results=await Promise.allSettled([save(initial,10,2),save(initial,20,4)]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);const failed=results.find(r=>r.status==='rejected') as PromiseRejectedResult;expect(failed.reason.message).toBe('STALE');const rows=await client.salesTarget.findMany({where:{companyId}});expect(rows).toHaveLength(2);const values=Object.fromEntries(rows.map(row=>[row.metric,Number(row.targetValue)]));expect([[10,2],[20,4]]).toContainEqual([values.LEADS_CREATED_COUNT,values.WON_LEADS_COUNT])});
it.skipIf(!databaseUrl)('rejects a stale editor without changing either saved metric',async()=>{await save(await revision(),10,2);const old=await revision();await save(old,20,4);await expect(save(old,30,6)).rejects.toThrow('STALE');const rows=await client.salesTarget.findMany({where:{companyId}});expect(Object.fromEntries(rows.map(row=>[row.metric,Number(row.targetValue)]))).toEqual({LEADS_CREATED_COUNT:20,WON_LEADS_COUNT:4})});

import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
vi.mock('@/lib/db',()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {editAccountUserForActor} from './product-user-management';
const databaseUrl=process.env.SECURITY_REGRESSION_DATABASE_URL;
const url=new URL(databaseUrl??'postgresql://unused:unused@127.0.0.1:55433/unused_ci');
if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.endsWith('_ci'))throw new Error('Isolated local security fixture required');
const client=new PrismaClient({datasources:{db:{url:url.href}}});
const companyId=randomUUID(),owner=randomUUID(),occupied=randomUUID(),candidate=randomUUID(),other=randomUUID();
let actor:Awaited<ReturnType<typeof client.user.findUniqueOrThrow>>;
beforeAll(async()=>{if(!databaseUrl)return;await client.company.create({data:{id:companyId,name:'Account capacity fixture',slug:`capacity-${companyId}`,productEdition:'SALESPUNCH360_PLUS',subscriptionStatus:'ACTIVE'}});for(const id of[owner,occupied,candidate,other])await client.user.create({data:{id,companyId,name:'Fixture user',email:`${id}@example.invalid`,passwordHash:'fixture-only',role:id===owner?'COMPANY_ADMIN':'ACCOUNT_USER',salesRole:id===owner?'PRIMARY_ADMIN':null,accountRole:id===owner?'ACCOUNT_ADMIN':id===occupied?'ACCOUNTANT':'DATA_ENTRY',salesAccessActive:id===owner,accountAccessActive:id===owner||id===occupied}});actor=await client.user.findUniqueOrThrow({where:{id:owner}})},30000);
beforeEach(async()=>{if(!databaseUrl)return;await client.companySubscription.deleteMany({where:{companyId}});await client.user.updateMany({where:{id:{in:[candidate,other]}},data:{accountRole:'DATA_ENTRY',accountAccessActive:false}});});
afterAll(async()=>client.$disconnect());
async function paid(packages:number){await client.companySubscription.create({data:{companyId,status:'ACTIVE',billingPeriod:'YEARLY',adminSeats:0,managerSeats:0,salesSeats:0,accountPackages:packages,startsAt:new Date(Date.now()-3600000),endsAt:new Date(Date.now()+86400000)}})}
const edit=(id:string)=>editAccountUserForActor(actor as never,{userId:id,accountRole:'ACCOUNTANT',accountAccessActive:true,branchAccessScope:'ALL_BRANCHES',branchIds:[]});
it.skipIf(!databaseUrl)('rejects the second Accountant on one paid package, without a permanent bonus package',async()=>{await paid(1);await expect(edit(candidate)).rejects.toThrow('ACCOUNT_SEAT_LIMIT');expect((await client.user.findUniqueOrThrow({where:{id:candidate}})).accountRole).toBe('DATA_ENTRY')});
it.skipIf(!databaseUrl)('includes combined Plus capacity when allowing an available seat',async()=>{await paid(2);await edit(candidate);expect((await client.user.findUniqueOrThrow({where:{id:candidate}})).accountRole).toBe('ACCOUNTANT')});
it.skipIf(!databaseUrl)('does not over-allocate the last seat under competing edits',async()=>{await paid(2);const results=await Promise.allSettled([edit(candidate),edit(other)]);expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);expect(await client.user.count({where:{companyId,accountRole:'ACCOUNTANT',accountAccessActive:true,isActive:true}})).toBe(2)});

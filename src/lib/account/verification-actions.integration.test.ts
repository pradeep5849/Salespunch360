import {beforeAll,afterAll,expect,it,vi} from "vitest";
import {PrismaClient,Prisma} from "@prisma/client";
import {randomUUID} from "node:crypto";
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>{const value=client[key as keyof PrismaClient];return typeof value==="function"?value.bind(client):value;}})}));
import {verifyAccountDataForActor} from "./utilities";
const address=process.env.VERIFICATION_ACTION_TEST_DATABASE_URL,url=new URL(address??"postgresql://unused:unused@127.0.0.1/unused_ci");
if(address&&(!["127.0.0.1","localhost"].includes(url.hostname)||!url.pathname.endsWith("_ci")))throw new Error("ISOLATED_LOCAL_CI_DATABASE_REQUIRED");
const client=new PrismaClient({datasourceUrl:address??url.toString()});
const companies=[randomUUID(),randomUUID()],owners=[randomUUID(),randomUUID()],journals:string[]=[];
beforeAll(async()=>{if(!address)return;for(let i=0;i<2;i++){
 const companyId=companies[i],ownerId=owners[i];await client.company.create({data:{id:companyId,name:"Verification review fixture",slug:`verify-review-${companyId}`,productEdition:"SALESPUNCH360_PLUS"}});
 await client.user.create({data:{id:ownerId,companyId,name:"Owner",email:`${ownerId}@example.invalid`,passwordHash:"PRIVATE",role:"COMPANY_ADMIN",salesRole:"PRIMARY_ADMIN",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
 const branch=await client.branch.create({data:{companyId,name:"Head office",code:"HO",isPrimary:true}}),year=await client.financialYear.create({data:{companyId,name:"Fixture",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}}),ledger=await client.ledgerAccount.create({data:{companyId,code:"FIXTURE",name:"Fixture asset",accountClass:"ASSET",normalBalance:"DEBIT"}});
 const journal=await client.journalEntry.create({data:{companyId,branchId:branch.id,financialYearId:year.id,journalNumber:`UNBALANCED-${i}`,entryDate:new Date("2026-11-23"),sourceType:"FIXTURE",sourceId:randomUUID(),createdById:ownerId}});journals.push(journal.id);
 await client.journalLine.create({data:{companyId,journalEntryId:journal.id,ledgerAccountId:ledger.id,lineNumber:1,debit:"10",credit:"0"}});
}});
afterAll(async()=>client.$disconnect());
it.skipIf(!address)("returns actionable affected journal records only from the scanned company",async()=>{
 const checks=await client.$transaction(tx=>verifyAccountDataForActor({id:owners[0],companyId:companies[0]},tx),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 const check=checks.find(row=>row.check==="Journal entries balance");expect(check).toMatchObject({status:"ERROR",affected:1,samples:["UNBALANCED-0"],records:[{label:"UNBALANCED-0",href:`/workspace/account/accounting/journals/${journals[0]}`}],reviewHref:"/workspace/account/accounting/journals"});
 expect(JSON.stringify(checks)).not.toContain(journals[1]);expect(await client.journalLine.count({where:{companyId:companies[0]}})).toBe(1);expect((await client.journalEntry.findUniqueOrThrow({where:{id:journals[0]}})).status).toBe("DRAFT");
});

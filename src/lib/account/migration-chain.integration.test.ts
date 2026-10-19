import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {cpSync,mkdtempSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {PrismaClient} from "@prisma/client";
import {it,expect} from "vitest";

const url=process.env.ACCOUNT_MIGRATION_REHEARSAL_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("An isolated local *_ci migration database is required");

/** Refuse existing databases; never reset, drop or resolve migration history. */
it.skipIf(!url)("deploys the complete migration chain and preserves pre-shipping documents on upgrade",async()=>{
 const db=new PrismaClient({datasources:{db:{url:url!}}});
 const scratch=mkdtempSync(join(tmpdir(),"salespunch-migration-rehearsal-"));
 const target="20261019060000_commercial_shipping_snapshot";
 const deploy=()=>execFileSync(process.execPath,[resolve("node_modules/prisma/build/index.js"),"migrate","deploy","--schema",join(scratch,"schema.prisma")],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},encoding:"utf8",timeout:120000});
 try{
  const tables=await db.$queryRaw<Array<{tablename:string}>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
  if(tables.length)throw new Error("Migration rehearsal requires an EMPTY database;existing data was not changed");
  cpSync(resolve("prisma/schema.prisma"),join(scratch,"schema.prisma"));
  for(const name of readdirSync(resolve("prisma/migrations"))){if(name==="migration_lock.toml"||name<target)cpSync(resolve("prisma/migrations",name),join(scratch,"migrations",name),{recursive:true});}
  deploy();
  const companyId=randomUUID(),branchId=randomUUID(),userId=randomUUID(),customerId=randomUUID(),id=randomUUID();
  await db.$executeRaw`INSERT INTO companies (id,name,slug,"productEdition","updatedAt") VALUES (${companyId}::uuid,'Migration fixture',${`migration-${companyId}`},'SALESPUNCH360_ACCOUNT',NOW())`;
  await db.$executeRaw`INSERT INTO branches (id,"companyId",name,code,"isPrimary","updatedAt") VALUES (${branchId}::uuid,${companyId}::uuid,'Fixture branch','PRIMARY',true,NOW())`;
  await db.$executeRaw`INSERT INTO users (id,"companyId",name,email,"passwordHash",role,"accountRole","accountAccessActive","updatedAt") VALUES (${userId}::uuid,${companyId}::uuid,'Fixture user',${`${userId}@example.test`},'not-login-test','ACCOUNT_USER','ACCOUNT_ADMIN',true,NOW())`;
  await db.$executeRaw`INSERT INTO customers (id,"companyId","branchId",name,"shippingAddress","isAccountCustomer","updatedAt") VALUES (${customerId}::uuid,${companyId}::uuid,${branchId}::uuid,'Existing customer','Current customer site',true,NOW())`;
  // Use the pre-upgrade columns: the generated client already knows the new field.
  await db.$executeRaw`INSERT INTO commercial_documents ("id","companyId","branchId","type","status","documentNumber","partyId","partyName","customerId","issueDate","subtotal","taxableTotal","taxTotal","grandTotal","balanceDue","createdById","updatedAt") VALUES (${id}::uuid,${companyId}::uuid,${branchId}::uuid,'SALES_INVOICE','DRAFT','PRE-MIGRATION',${customerId}::uuid,'Existing customer',${customerId}::uuid,'2026-10-11',100,100,0,100,100,${userId}::uuid,NOW())`;
  const [before]=await db.$queryRaw<Array<{record:Record<string,unknown>}>>`SELECT to_jsonb(d) AS record FROM commercial_documents d WHERE id=${id}::uuid`;
  for(const name of readdirSync(resolve("prisma/migrations"))){if(name!=="migration_lock.toml"&&name>=target)cpSync(resolve("prisma/migrations",name),join(scratch,"migrations",name),{recursive:true});}
  deploy();
  const [after]=await db.$queryRaw<Array<{record:Record<string,unknown>}>>`SELECT to_jsonb(d) AS record FROM commercial_documents d WHERE id=${id}::uuid`;
  expect(after.record.shippingAddress).toBeNull();
  const {shippingAddress:_newField,...retained}=after.record;void _newField;
  expect(retained).toEqual(before.record);
  expect(await db.customer.count({where:{companyId,shippingAddress:"Current customer site"}})).toBe(1);
  expect(await db.commercialDocument.count({where:{companyId}})).toBe(1);
  const columns=await db.$queryRaw<Array<{table_name:string;column_name:string}>>`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND ((table_name='commercial_documents' AND column_name='shippingAddress') OR (table_name='expense_transactions' AND column_name='creationRequestKey'))`;
  expect(columns).toHaveLength(2);
  const ownerKey=await db.$queryRaw<Array<{indexdef:string}>>`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='owner_financial_accounts_companyId_id_key'`;
  const lineKey=await db.$queryRaw<Array<{indexdef:string}>>`SELECT indexdef FROM pg_indexes WHERE schemaname='public' AND indexname='commercial_document_lines_companyId_id_key'`;
  expect(ownerKey).toHaveLength(1);expect(ownerKey[0].indexdef).toContain("UNIQUE");expect(lineKey).toHaveLength(1);expect(lineKey[0].indexdef).toContain("UNIQUE");
  expect(deploy()).toContain("No pending migrations");
 }finally{await db.$disconnect();rmSync(scratch,{recursive:true,force:true});}
},180000);

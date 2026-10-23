import sharp from "sharp";
import {setPrivateStorageForTests} from "@/lib/storage";
import {randomUUID} from "node:crypto";
import {Prisma,PrismaClient} from "@prisma/client";
import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
const url=process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if(url&&(!["localhost","127.0.0.1"].includes(new URL(url).hostname)||!new URL(url).pathname.endsWith("_ci")))throw new Error("An isolated local *_ci database is required");
const client=new PrismaClient({datasources:{db:{url:url??"postgresql://test:test@127.0.0.1:55432/checkpoint_ci"}}});
vi.mock("@/lib/db",()=>({db:new Proxy({},{get:(_,key)=>client[key as keyof PrismaClient]})}));
import {DEFAULT_LEDGER_ACCOUNTS} from "@/lib/accounting/default-accounts";
import {reverseJournalInTx} from "@/lib/accounting/service";
import {reverseExpenseForActor} from "./expenses";
import {homeNonCommercialRows} from "./home-noncommercial";
import * as expenseService from "./expenses";
import {savePartyTransferForActor,partyTransferForActor,partyTransferPhotoForActor,reversePartyTransferForActor} from "./party-transfers";
import type {ProjectActor} from "./projects";
const companyId=randomUUID(),otherCompany=randomUUID(),branchId=randomUUID(),otherBranch=randomUUID(),userId=randomUUID(),customerId=randomUUID(),vendorId=randomUUID(),foreignCustomer=randomUUID();
const actor={id:userId,companyId,name:"Transfer admin",email:`${userId}@example.test`,role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",isActive:true,accountAccessActive:true,salesAccessActive:false,salesRole:null,managerType:null,branchAccessScope:"ALL_BRANCHES",branchIds:[]} as ProjectActor;
let firstRequest:ReturnType<typeof input>;
let foreignMoneyId:string;
const objects=new Map<string,Buffer>();let failPhotoPut=false;const photoGet=vi.fn(async(key:string)=>{const found=objects.get(key);if(!found)throw new Error("missing");return found});
let moneyAccountId:string,cashId:string,first:Awaited<ReturnType<typeof savePartyTransferForActor>>;
const input=()=>({requestKey:randomUUID(),branchId,moneyAccountId,transactionDate:"2026-10-23",receivedParty:{kind:"CUSTOMER",id:customerId},paidParty:{kind:"VENDOR",id:vendorId},receivedAmount:"600",paidAmount:"500",notes:"Pass-through fixture"});
async function cashFor(journals:string[]){const sums=await client.journalLine.aggregate({where:{companyId,ledgerAccountId:cashId,journalEntryId:{in:journals}},_sum:{debit:true,credit:true}});return new Prisma.Decimal(sums._sum.debit??0).sub(sums._sum.credit??0).toString()}
async function counts(){return Promise.all([client.journalEntry.count({where:{companyId}}),client.expenseTransaction.count({where:{companyId}}),client.accountOperationalAudit.count({where:{companyId}})])}
describe.skipIf(!url)("A071 party pass-through and Other Income atomic posting",()=>{
 beforeAll(async()=>{
  setPrivateStorageForTests({put:async(key,bytes)=>{objects.set(key,Buffer.from(bytes));if(failPhotoPut)throw new Error("simulated storage failure")},get:photoGet,delete:async key=>{objects.delete(key)}});
  await client.company.createMany({data:[companyId,otherCompany].map(id=>({id,name:"Party transfer fixture",slug:`party-transfer-${id}`,productEdition:"SALESPUNCH360_ACCOUNT",subscriptionStatus:"TRIAL",trialStartedAt:new Date(),trialEndsAt:new Date(Date.now()+86400000)}))});
  await client.branch.createMany({data:[{id:branchId,companyId,name:"Main",code:"MAIN",isPrimary:true},{id:otherBranch,companyId:otherCompany,name:"Foreign",code:"MAIN",isPrimary:true}]});
  await client.user.create({data:{id:userId,companyId,name:actor.name,email:actor.email,passwordHash:"fixture-only",role:"ACCOUNT_USER",accountRole:"ACCOUNT_ADMIN",accountAccessActive:true}});
  await client.customer.createMany({data:[{id:customerId,companyId,branchId,name:"Received party",isAccountCustomer:true},{id:foreignCustomer,companyId:otherCompany,branchId:otherBranch,name:"Foreign party",isAccountCustomer:true}]});
  await client.vendor.create({data:{id:vendorId,companyId,name:"Paid party"}});
  await client.accountSettings.create({data:{companyId,enabledModules:[],defaultStateCode:"29"}});
  await client.financialYear.create({data:{companyId,name:"2026-27",startDate:new Date("2026-04-01"),endDate:new Date("2027-03-31")}});
  await client.ledgerAccount.createMany({data:DEFAULT_LEDGER_ACCOUNTS.map(row=>({...row,companyId}))});
  cashId=(await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"CASH"}})).id;
  const otherCash=await client.ledgerAccount.create({data:{companyId:otherCompany,code:"1000",name:"Other cash",accountClass:"ASSET",normalBalance:"DEBIT"}});foreignMoneyId=(await client.moneyAccount.create({data:{companyId:otherCompany,branchId:otherBranch,type:"CASH",name:"Foreign cash",ledgerAccountId:otherCash.id}})).id;
  moneyAccountId=(await client.moneyAccount.create({data:{companyId,branchId,type:"CASH",name:"Transfer cash",ledgerAccountId:cashId}})).id;
 });
 afterAll(async()=>{
  for(const id of [companyId,otherCompany])await client.$transaction(async tx=>{
   await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${id},true)`;
   await tx.accountOperationalAudit.deleteMany({where:{companyId:id}});await tx.accountingAuditEvent.deleteMany({where:{companyId:id}});await tx.expenseTransaction.deleteMany({where:{companyId:id}});await tx.expenseCategory.deleteMany({where:{companyId:id}});
   await tx.journalLine.deleteMany({where:{companyId:id}});await tx.journalEntry.deleteMany({where:{companyId:id}});await tx.accountingPeriodLock.deleteMany({where:{companyId:id}});await tx.financialYear.deleteMany({where:{companyId:id}});await tx.moneyAccount.deleteMany({where:{companyId:id}});await tx.ledgerAccount.deleteMany({where:{companyId:id}});await tx.customer.deleteMany({where:{companyId:id}});await tx.vendor.deleteMany({where:{companyId:id}});await tx.user.deleteMany({where:{companyId:id}});await tx.numberingSeries.deleteMany({where:{companyId:id}});await tx.branch.deleteMany({where:{companyId:id}});await tx.accountSettings.deleteMany({where:{companyId:id}});await tx.company.delete({where:{id}});
  });setPrivateStorageForTests(undefined);await client.$disconnect();
 });
 it("posts received600 paid500 as cash100 and OtherIncome100, never expense500",async()=>{
  firstRequest=input();first=await savePartyTransferForActor(actor,firstRequest);expect(first).toMatchObject({receivedAmount:"600.00",paidAmount:"500.00",commissionAmount:"100.00",commissionHead:"OTHER_INCOME",expenseAmount:"0.00"});
  const commission=await client.expenseTransaction.findUniqueOrThrow({where:{id:first.commissionIncomeId!}});expect(commission.type).toBe("OTHER_INCOME");expect(commission.status).toBe("POSTED");expect(commission.totalAmount.toString()).toBe("100");
  const journals=[first.passReceiptJournalId!,first.passPaymentJournalId!,commission.journalEntryId!];expect(await cashFor(journals)).toBe("100");
  const income=(await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"OTHER_INCOME"}})).id;const credit=await client.journalLine.aggregate({where:{companyId,ledgerAccountId:income,journalEntryId:{in:journals}},_sum:{credit:true}});expect(credit._sum.credit?.toString()).toBe("100");
  expect(await client.expenseTransaction.count({where:{companyId,type:{not:"OTHER_INCOME"}}})).toBe(0);expect(await partyTransferForActor(actor,first.id)).toMatchObject({number:first.number,receivedPartyName:"Received party",paidPartyName:"Paid party"});
  for(const id of journals){const lines=await client.journalLine.findMany({where:{journalEntryId:id}});expect(lines.reduce((sum,line)=>sum.add(line.debit).sub(line.credit),new Prisma.Decimal(0)).toString()).toBe("0")}
 });
 it("posts equal600/600 with no Other Income entry and zero net cash",async()=>{
  const before=await client.expenseTransaction.count({where:{companyId}}),row=await savePartyTransferForActor(actor,{...input(),paidAmount:"600"});expect(row.commissionIncomeId).toBeNull();expect(row.commissionAmount).toBe("0.00");expect(await cashFor([row.passReceiptJournalId!,row.passPaymentJournalId!])).toBe("0");expect(await client.expenseTransaction.count({where:{companyId}})).toBe(before);
 });
 it("commits concurrent retries once and rejects changed intent",async()=>{
  const raw={...input(),receivedAmount:"800",paidAmount:"800"};const rows=await Promise.all(Array.from({length:4},()=>savePartyTransferForActor(actor,raw)));expect(new Set(rows.map(row=>row.number)).size).toBe(1);expect(await client.accountOperationalAudit.count({where:{companyId,entityId:raw.requestKey,eventType:"PARTY_TRANSFER_POSTED"}})).toBe(1);expect(await client.journalEntry.count({where:{companyId,sourceId:raw.requestKey}})).toBe(2);await expect(savePartyTransferForActor(actor,{...raw,paidAmount:"700"})).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");
 });
 it("rolls back both pass-through journals when commission creation cannot complete",async()=>{
  const category=await client.expenseCategory.findUniqueOrThrow({where:{companyId_name:{companyId,name:"Party Transfer Commission"}}});await client.expenseCategory.update({where:{id:category.id},data:{isActive:false}});const before=await counts();
  try{await expect(savePartyTransferForActor(actor,input())).rejects.toThrow("INVALID_TRANSFER_COMMISSION_CATEGORY");expect(await counts()).toEqual(before)}finally{await client.expenseCategory.update({where:{id:category.id},data:{isActive:true}})}
 });
 it("denies wrong roles, company parties, branch scope and foreign source reads",async()=>{
  const before=await counts();await expect(savePartyTransferForActor({...actor,accountRole:"PROJECT_MANAGER"},input())).rejects.toThrow();await expect(savePartyTransferForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},input())).rejects.toThrow();await expect(savePartyTransferForActor(actor,{...input(),receivedParty:{kind:"CUSTOMER",id:foreignCustomer}})).rejects.toThrow("INVALID_PARTY_TRANSFER_PARTY");await expect(savePartyTransferForActor(actor,{...input(),moneyAccountId:foreignMoneyId})).rejects.toThrow("INVALID_MONEY_ACCOUNT");await expect(partyTransferForActor({...actor,companyId:otherCompany},first.id)).rejects.toThrow("PARTY_TRANSFER_NOT_FOUND");await expect(partyTransferForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},first.id)).rejects.toThrow();expect(await counts()).toEqual(before);
 });
 it("honors restricted subscriptions before any financial write",async()=>{
  await client.company.update({where:{id:companyId},data:{subscriptionStatus:"SUSPENDED"}});const before=await counts();try{await expect(savePartyTransferForActor(actor,input())).rejects.toThrow("SUBSCRIPTION_REQUIRED");expect(await counts()).toEqual(before)}finally{await client.company.update({where:{id:companyId},data:{subscriptionStatus:"TRIAL"}})}
 });
 it("preserves immutable snapshots and blocks independent reversal of a transfer component",async()=>{
  await expect(client.accountOperationalAudit.updateMany({where:{companyId,entityId:first.id,eventType:"PARTY_TRANSFER_POSTED"},data:{metadata:{commissionAmount:"600"}}})).rejects.toThrow("PARTY_TRANSFER_HISTORY_IMMUTABLE");
  await expect(client.$transaction(tx=>reverseJournalInTx(tx,actor,{journalEntryId:first.passReceiptJournalId!,entryDate:"2026-10-23",reason:"Source reversal is required"}))).rejects.toThrow("PARTY_TRANSFER_SOURCE_REQUIRED");await expect(reverseExpenseForActor(actor,first.commissionIncomeId!,new Date("2026-10-23"),"Source reversal is required")).rejects.toThrow("PARTY_TRANSFER_SOURCE_REQUIRED");
  expect((await client.journalEntry.findUniqueOrThrow({where:{id:first.passReceiptJournalId!}})).status).toBe("POSTED");expect((await client.expenseTransaction.findUniqueOrThrow({where:{id:first.commissionIncomeId!}})).status).toBe("POSTED");
 });
 it("supports company-wide vendors as received parties and branch customers as paid parties",async()=>{
  const row=await savePartyTransferForActor(actor,{...input(),receivedParty:{kind:"VENDOR",id:vendorId},paidParty:{kind:"CUSTOMER",id:customerId},receivedAmount:"800",paidAmount:"800"});expect(row).toMatchObject({receivedPartyName:"Paid party",paidPartyName:"Received party",commissionAmount:"0.00",commissionIncomeId:null});
 });
 it("retains party snapshots and retry results after a master is renamed or archived",async()=>{
  await client.customer.update({where:{id:customerId},data:{name:"Changed name",isActive:false}});try{const replay=await savePartyTransferForActor(actor,firstRequest);expect(replay.number).toBe(first.number);expect(replay.receivedPartyName).toBe("Received party");await expect(savePartyTransferForActor(actor,input())).rejects.toThrow("INVALID_PARTY_TRANSFER_PARTY")}finally{await client.customer.update({where:{id:customerId},data:{name:"Received party",isActive:true}})}
 });
 it("rejects inconsistent commission arithmetic at the database snapshot boundary",async()=>{
  const row=await client.accountOperationalAudit.findFirstOrThrow({where:{companyId,entityId:first.id,eventType:"PARTY_TRANSFER_POSTED"}});await expect(client.accountOperationalAudit.create({data:{companyId,actorUserId:userId,entityType:"PARTY_TRANSFER",entityId:randomUUID(),eventType:"PARTY_TRANSFER_POSTED",metadata:{...(row.metadata as Prisma.JsonObject),commissionAmount:"600.00"}}})).rejects.toThrow();
 });
 it("honors company Account edition availability",async()=>{
  await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360"}});const before=await counts();try{await expect(savePartyTransferForActor(actor,input())).rejects.toThrow();await expect(partyTransferForActor(actor,first.id)).rejects.toThrow();expect(await counts()).toEqual(before)}finally{await client.company.update({where:{id:companyId},data:{productEdition:"SALESPUNCH360_ACCOUNT"}})}
 });
 it("saves one private image with the financial source and retains it on replay",async()=>{
  const raw=input(),bytes=await sharp({create:{width:8,height:8,channels:3,background:"#123456"}}).png().toBuffer(),file=new File([bytes],"transfer.png",{type:"image/png"});const source=await savePartyTransferForActor(actor,raw,file),replay=await savePartyTransferForActor(actor,raw,file);expect(replay.id).toBe(source.id);expect(source.photoObjectKey).toMatch(new RegExp(`^companies/${companyId}/party-transfers/${raw.requestKey}/`));const photo=await partyTransferPhotoForActor(actor,source.id);expect(photo.mimeType).toBe("image/webp");expect(photo.bytes.subarray(0,4).toString()).toBe("RIFF");const reads=photoGet.mock.calls.length;await expect(partyTransferPhotoForActor({...actor,companyId:otherCompany},source.id)).rejects.toThrow();expect(photoGet.mock.calls).toHaveLength(reads);await expect(savePartyTransferForActor(actor,raw)).rejects.toThrow("IDEMPOTENCY_KEY_REUSED");expect(objects.size).toBe(1);const original=objects.get(source.photoObjectKey!)!;objects.set(source.photoObjectKey!,Buffer.from("tampered"));try{await expect(partyTransferPhotoForActor(actor,source.id)).rejects.toThrow("PARTY_TRANSFER_PHOTO_INTEGRITY_FAILED")}finally{objects.set(source.photoObjectKey!,original)}
 });
 it("rolls back both cash legs and commission if image storage fails after writing bytes",async()=>{
  const bytes=await sharp({create:{width:8,height:8,channels:3,background:"#654321"}}).png().toBuffer(),file=new File([bytes],"transfer.png",{type:"image/png"}),before=await counts(),files=objects.size;failPhotoPut=true;try{await expect(savePartyTransferForActor(actor,input(),file)).rejects.toThrow("simulated storage failure");expect(await counts()).toEqual(before);expect(objects.size).toBe(files)}finally{failPhotoPut=false}
 });
 it("checks period locks with complete rollback",async()=>{
  const fy=await client.financialYear.findFirstOrThrow({where:{companyId}});const lock=await client.accountingPeriodLock.create({data:{companyId,financialYearId:fy.id,lockedThrough:new Date("2026-10-23"),updatedById:userId}});const before=await counts();try{await expect(savePartyTransferForActor(actor,input())).rejects.toThrow("PERIOD_LOCKED");expect(await counts()).toEqual(before)}finally{await client.accountingPeriodLock.delete({where:{id:lock.id}})}
 });
 it("reverses all cash and commission legs atomically and replays the same reversal once",async()=>{
  const saved=await savePartyTransferForActor(actor,input()),request={requestKey:randomUUID(),entryDate:"2026-10-24",reason:"Cancel complete agency transfer"};
  const original=await client.accountOperationalAudit.findFirstOrThrow({where:{companyId,entityId:saved.id,eventType:"PARTY_TRANSFER_POSTED"}});
  const results=await Promise.all(Array.from({length:3},()=>reversePartyTransferForActor(actor,saved.id,request)));expect(results.every(row=>row.status==="REVERSED")).toBe(true);expect((await partyTransferForActor(actor,saved.id)).status).toBe("REVERSED");
  const reversals=await client.accountOperationalAudit.findMany({where:{companyId,entityId:saved.id,eventType:"PARTY_TRANSFER_REVERSED"}});expect(reversals).toHaveLength(1);
  const metadata=reversals[0].metadata as {reversalJournalIds:string[]};expect(metadata.reversalJournalIds).toHaveLength(3);expect(await cashFor(metadata.reversalJournalIds)).toBe("-100");
  const income=await client.expenseTransaction.findUniqueOrThrow({where:{id:saved.commissionIncomeId!}});expect(income.status).toBe("REVERSED");expect(income.reversalJournalId).not.toBeNull();
  expect((await client.accountOperationalAudit.findUniqueOrThrow({where:{id:original.id}})).metadata).toEqual(original.metadata);
  await expect(reversePartyTransferForActor(actor,saved.id,{...request,requestKey:randomUUID()})).rejects.toThrow("PARTY_TRANSFER_ALREADY_REVERSED");
 });
 it("rolls back both reversed pass-through legs if the commission reversal fails",async()=>{
  const saved=await savePartyTransferForActor(actor,input());const fault=vi.spyOn(expenseService,"reverseExpenseForActor").mockRejectedValueOnce(new Error("COMMISSION_REVERSAL_FAILURE"));
  try{await expect(reversePartyTransferForActor(actor,saved.id,{requestKey:randomUUID(),entryDate:"2026-10-24",reason:"Whole transfer cancellation"})).rejects.toThrow("COMMISSION_REVERSAL_FAILURE")}finally{fault.mockRestore()}
  expect(await client.accountOperationalAudit.count({where:{companyId,entityId:saved.id,eventType:"PARTY_TRANSFER_REVERSED"}})).toBe(0);
  for(const id of [saved.passReceiptJournalId!,saved.passPaymentJournalId!])expect((await client.journalEntry.findUniqueOrThrow({where:{id}})).status).toBe("POSTED");
  expect((await client.expenseTransaction.findUniqueOrThrow({where:{id:saved.commissionIncomeId!}})).status).toBe("POSTED");
 });
 it("denies non-admin and foreign-company source reversals without financial writes",async()=>{
  const saved=await savePartyTransferForActor(actor,input()),request={requestKey:randomUUID(),entryDate:"2026-10-24",reason:"Denied cancellation"};
  await expect(reversePartyTransferForActor({...actor,accountRole:"ACCOUNTANT"},saved.id,request)).rejects.toThrow();
  await expect(reversePartyTransferForActor({...actor,companyId:otherCompany,branchIds:[]},saved.id,request)).rejects.toThrow();
  expect(await client.accountOperationalAudit.count({where:{companyId,entityId:saved.id,eventType:"PARTY_TRANSFER_REVERSED"}})).toBe(0);
 });

 it("Home shows distinct scoped cash legs and suppresses duplicate commission only when transfer rows are included",async()=>{
  const saved=await savePartyTransferForActor(actor,input()),context={mode:"BRANCH" as const,branchId,branchName:"Own"},modules=new Set(["EXPENSES"] as const),permissions=new Set(["ACCOUNT_MONEY_VIEW","ACCOUNT_EXPENSE_VIEW"] as const);
  const received=await homeNonCommercialRows(actor,context,{q:saved.number,types:["P2P_RECEIVED"]},modules,permissions);expect(received).toHaveLength(1);expect(received[0]).toMatchObject({id:`${saved.id}:received`,filterType:"P2P_RECEIVED",grandTotal:"600.00",printType:null,showBalance:false,detailHref:`/workspace/account/money/party-transfers/${saved.id}`});
  const paid=await homeNonCommercialRows(actor,context,{q:saved.number,types:["P2P_PAID"]},modules,permissions);expect(paid).toHaveLength(1);expect(paid[0].grandTotal).toBe("500.00");expect(paid[0].id).not.toBe(received[0].id);
  const all=await homeNonCommercialRows(actor,context,{q:"",types:[]},modules,permissions);expect(all.some(row=>row.id===saved.commissionIncomeId)).toBe(false);
  const onlyExpenses=await homeNonCommercialRows(actor,context,{q:"",types:["EXPENSE"]},modules,permissions);expect(onlyExpenses.some(row=>row.id===saved.commissionIncomeId&&row.type==="OTHER_INCOME")).toBe(true);
  expect(await homeNonCommercialRows({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},context,{q:saved.number,types:["P2P_RECEIVED"]},modules,permissions)).toEqual([]);
  expect(await homeNonCommercialRows(actor,context,{q:saved.number,types:["P2P_RECEIVED"]},modules,new Set())).toEqual([]);
  const reversed=await reversePartyTransferForActor(actor,saved.id,{requestKey:randomUUID(),entryDate:"2026-10-24",reason:"Home source reversal status"});expect(reversed.status).toBe("REVERSED");expect((await homeNonCommercialRows(actor,context,{q:saved.number,types:["P2P_RECEIVED"]},modules,permissions))[0].status).toBe("REVERSED");
 });

});

import { moneyReadContext } from "./money-context";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const url = process.env.ACCOUNT_CHECKPOINT_DATABASE_URL;
if (
  url &&
  (!["localhost", "127.0.0.1"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("_ci"))
)
  throw new Error("Isolated local *_ci database required");
const client = new PrismaClient({
  datasources: {
    db: { url: url ?? "postgresql://test:test@127.0.0.1:55432/checkpoint_ci" },
  },


});
vi.mock("@/lib/db", () => ({
  db: new Proxy({}, { get: (_, key) => client[key as keyof PrismaClient] }),
}));
import {
  createAndReceiveLoanForActor,
  postLoanPaymentForActor,
  createMoneyTransferForActor,
  moneyDashboardForActor,
  createMoneyAccountForActor,
  updateMoneyAccountForActor,
  deactivateMoneyAccountForActor,
} from "./money";
import type { ProjectActor } from "./projects";
const companyId = randomUUID(),
  otherCompany = randomUUID(),
  userId = randomUUID();
const actor = {
  id: userId,
  name: "Unit administrator",
  email: `${userId}@example.test`,
  companyId,
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: [],
} as ProjectActor;
let accountId: string, ledgerId: string;
const branchId = randomUUID();
describe.skipIf(!url)(
  "A064 audited money-account edits on isolated PostgreSQL",
  () => {
    beforeAll(async () => {
      await client.company.create({
        data: {
          id: companyId,
          name: "Money edit fixture",
          slug: `money-edit-${companyId}`,
          productEdition: "SALESPUNCH360_ACCOUNT",
        },
      });
      await client.user.create({
        data: {
          id: userId,
          companyId,
          name: "Admin",
          email: actor.email,
          passwordHash: "isolated-fixture",
          role: "ACCOUNT_USER",
          accountRole: "ACCOUNT_ADMIN",
          accountAccessActive: true,
        },
      });
      await client.branch.create({
        data: { id: branchId, companyId, name: "Money branch", code: "MONEY" },
      });
      await client.ledgerAccount.create({
        data: {
          companyId,
          code: "MA-000123",
          name: "Legacy retained money code",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      });
      const ledger = await client.ledgerAccount.create({
        data: {
          companyId,
          code: "EDIT-BANK",
          name: "Original bank",
          accountClass: "ASSET",
          normalBalance: "DEBIT",
        },
      });
      ledgerId = ledger.id;
      accountId = (
        await client.moneyAccount.create({
          data: {
            companyId,
            branchId,
            type: "BANK",
            name: "Original bank",
            ledgerAccountId: ledgerId,
            bankName: "Bank",
            accountNumberMasked: "****1234",
          },
        })
      ).id;
    });
    afterAll(async () => {
      await client.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.account_cleanup_company_id',${companyId},true)`;
        await tx.accountOperationalAudit.deleteMany({ where: { companyId } });
        await tx.moneyTransfer.deleteMany({ where: { companyId } });
        await tx.loanOperation.deleteMany({where:{companyId}});
        await tx.loanPayment.deleteMany({where:{companyId}});
        await tx.loan.deleteMany({where:{companyId}});
        await tx.journalLine.deleteMany({ where: { companyId } });
        await tx.journalEntry.deleteMany({ where: { companyId } });
        await tx.accountingAuditEvent.deleteMany({ where: { companyId } });
        await tx.financialYear.deleteMany({ where: { companyId } });
        await tx.moneyAccount.deleteMany({ where: { companyId } });
        await tx.ledgerAccount.deleteMany({ where: { companyId } });
        await tx.user.deleteMany({ where: { companyId } });
        await tx.numberingSeries.deleteMany({ where: { companyId } });
        await tx.branch.deleteMany({ where: { companyId } });
        await tx.accountSettings.deleteMany({where:{companyId}});
        await tx.company.deleteMany({ where: { id: companyId } });
      });
      await client.$disconnect();
    });
    it("reads posted loan outstanding and includes fee-only payments in its scoped statement", async () => {
      const {loanHistoryForActor}=await import("./loan-history");
      const {loanOverviewForActor}=await import("./loan-overview");
      await client.financialYear.create({data:{companyId,name:"Loan statement year",startDate:new Date("2032-01-01"),endDate:new Date("2032-12-31")}});
      const account=await createMoneyAccountForActor(actor,{type:"BANK",name:"Loan bank",branchId,creationRequestKey:randomUUID()});
      await client.ledgerAccount.create({data:{companyId,code:"LOAN-INTEREST",name:"Interest expense",accountClass:"EXPENSE",normalBalance:"DEBIT",systemKey:"GENERAL_EXPENSES"}});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Statement lender",loanType:"TERM",principal:"100000",startDate:"2032-01-01",moneyAccountId:account.id,idempotencyKey:randomUUID()});
      await postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:account.id,paymentDate:"2032-01-02",principal:"2000",interest:"550",charges:"0",description:"October EMI",idempotencyKey:randomUUID()});
      await postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:account.id,paymentDate:"2032-01-03",principal:"0",interest:"0",charges:"100",idempotencyKey:randomUUID()});
      const overview=await loanOverviewForActor(actor,{branchId,q:"Statement lender"});
      expect(overview.rows[0].outstanding).toBe("98000");expect(overview.outstanding).toBe("98000");
      const history=await loanHistoryForActor(actor,loan.id,{branchId,limit:2});
      expect(history.total).toBe(3);expect(history.outstanding).toBe("98000");expect(history.rows[1].payment).toBe("2550");expect(history.rows[1].narration).toBe("October EMI");expect(history.nextOffset).toBe(2);
      const payment=await client.loanPayment.findFirstOrThrow({where:{companyId,loanId:loan.id,description:"October EMI"}});expect(payment.description).toBe("October EMI");
      await expect(postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:account.id,paymentDate:"2032-01-02",principal:"2000",interest:"550",charges:"0",description:"Changed EMI",idempotencyKey:payment.idempotencyKey})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      const next=await loanHistoryForActor(actor,loan.id,{branchId,offset:2});expect(next.rows[0].payment).toBe("100");expect(next.rows[0].balance).toBe("98000");
      await expect(loanHistoryForActor({...actor,companyId:otherCompany},loan.id,{branchId})).rejects.toThrow();
      await expect(loanHistoryForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},loan.id,{branchId})).rejects.toThrow();
    });
    it("rejects principal above the corrected posted liability without writing a payment",async()=>{
      const {postJournalForActor}=await import("@/lib/accounting/service");
      const source=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      const account=await client.moneyAccount.findUniqueOrThrow({where:{id:source.moneyAccountId}});
      const fy=await client.financialYear.findFirstOrThrow({where:{companyId,name:"Loan statement year"}});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Corrected liability",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:account.id,idempotencyKey:randomUUID()});
      await postJournalForActor(actor,{financialYearId:fy.id,branchId,entryDate:"2032-01-02",sourceType:"MANUAL_JOURNAL",sourceId:randomUUID(),lines:[{ledgerAccountId:loan.liabilityLedgerId,debit:"40",credit:"0"},{ledgerAccountId:account.ledgerAccountId,debit:"0",credit:"40"}]});
      const before=await client.journalEntry.count({where:{companyId}});
      await expect(postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:account.id,paymentDate:"2032-01-03",principal:"61",interest:"0",charges:"0",idempotencyKey:randomUUID()})).rejects.toThrow("PRINCIPAL_EXCEEDS_OUTSTANDING");
      expect(await client.loanPayment.count({where:{companyId,loanId:loan.id}})).toBe(0);
      expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
    });
    it("posts one top-up under concurrent retries, preserves original principal, and increases the repayment ceiling",async()=>{
      const {topUpLoanForActor}=await import("./loan-operations");
      const source=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Top-up test",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:source.moneyAccountId,idempotencyKey:randomUUID()});
      const request={requestKey:randomUUID(),expectedVersion:loan.version,amount:"50",operationDate:"2032-01-02",moneyAccountId:source.moneyAccountId,description:"Additional borrowing"};
      const [first,second]=await Promise.all([topUpLoanForActor(actor,loan.id,request),topUpLoanForActor(actor,loan.id,request)]);
      expect(first.id).toBe(second.id);expect(await client.journalEntry.count({where:{companyId,sourceType:"LOAN_TOP_UP",sourceId:first.id}})).toBe(1);
      const saved=await client.loan.findUniqueOrThrow({where:{id:loan.id}});expect(saved.principal.toString()).toBe("100");expect(saved.version).toBe(1);expect(saved.receivedJournalId).toBe(loan.receivedJournalId);
      await expect(topUpLoanForActor(actor,loan.id,{...request,amount:"51"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      await expect(topUpLoanForActor(actor,loan.id,{...request,requestKey:randomUUID()})).rejects.toThrow("LOAN_CHANGED");
      for(const principal of [{...actor,accountRole:"ACCOUNTANT" as const},{...actor,companyId:otherCompany},{...actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[]}])await expect(topUpLoanForActor(principal,loan.id,request)).rejects.toThrow();
      await postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:source.moneyAccountId,paymentDate:"2032-01-03",principal:"150",interest:"0",charges:"0",idempotencyKey:randomUUID()});
      expect((await client.loan.findUniqueOrThrow({where:{id:loan.id}})).status).toBe("PAID_OFF");
    });
    it("cancels only untouched receipts, retains history, and archives/restores zero-balance loans",async()=>{
      const {changeLoanLifecycleForActor}=await import("./loan-operations");
      const source=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Cancellation test",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:source.moneyAccountId,idempotencyKey:randomUUID()});
      const request={requestKey:randomUUID(),expectedVersion:loan.version,action:"CANCEL",operationDate:"2032-01-02",reason:"Created in error"};
      for(const denied of [{...actor,accountRole:"ACCOUNTANT" as const},{...actor,companyId:otherCompany},{...actor,branchAccessScope:"SELECTED_BRANCHES" as const,branchIds:[]},{...actor,accountAccessActive:false}])await expect(changeLoanLifecycleForActor(denied,loan.id,request)).rejects.toThrow();
      const [first,second]=await Promise.all([changeLoanLifecycleForActor(actor,loan.id,request),changeLoanLifecycleForActor(actor,loan.id,request)]);expect(first.id).toBe(second.id);
      const saved=await client.loan.findUniqueOrThrow({where:{id:loan.id}});expect(saved.status).toBe("CANCELLED");expect(saved.receivedJournalId).toBe(loan.receivedJournalId);expect((await client.journalEntry.findUniqueOrThrow({where:{id:loan.receivedJournalId!}})).status).toBe("REVERSED");
      const {loanHistoryForActor}=await import("./loan-history");expect((await loanHistoryForActor(actor,loan.id,{branchId})).outstanding).toBe("0");
      await changeLoanLifecycleForActor(actor,loan.id,{...request,requestKey:randomUUID(),expectedVersion:saved.version,action:"ARCHIVE"});const archived=await client.loan.findUniqueOrThrow({where:{id:loan.id}});expect(archived.archivedAt).not.toBeNull();
      await changeLoanLifecycleForActor(actor,loan.id,{...request,requestKey:randomUUID(),expectedVersion:archived.version,action:"RESTORE"});expect((await client.loan.findUniqueOrThrow({where:{id:loan.id}})).archivedAt).toBeNull();
      const busy=await client.loan.findUniqueOrThrow({where:{id:source.id}});
      await expect(changeLoanLifecycleForActor(actor,busy.id,{...request,requestKey:randomUUID(),expectedVersion:busy.version})).rejects.toThrow("LOAN_HAS_FINANCIAL_ACTIVITY");
      await expect(changeLoanLifecycleForActor(actor,busy.id,{...request,requestKey:randomUUID(),expectedVersion:busy.version,action:"ARCHIVE"})).rejects.toThrow("LOAN_ARCHIVE_REQUIRES_ZERO_BALANCE");
    });
    it("rejects invalid/locked top-ups and rolls back receipts when operational audit fails",async()=>{
      const {topUpLoanForActor}=await import("./loan-operations");const loan=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      const request={requestKey:randomUUID(),expectedVersion:loan.version,amount:"50",operationDate:"2032-01-04",moneyAccountId:loan.moneyAccountId};
      const before=await client.journalEntry.count({where:{companyId}});
      await expect(topUpLoanForActor(actor,loan.id,{...request,operationDate:"2031-12-31"})).rejects.toThrow("INVALID_LOAN_DATE");
      await expect(topUpLoanForActor(actor,loan.id,{...request,moneyAccountId:randomUUID()})).rejects.toThrow("INVALID_MONEY_ACCOUNT");
      await expect(topUpLoanForActor({...actor,accountAccessActive:false},loan.id,request)).rejects.toThrow();
      const fy=await client.financialYear.findFirstOrThrow({where:{companyId,name:"Loan statement year"}});
      await client.financialYear.update({where:{id:fy.id},data:{status:"CLOSED"}});try{await expect(topUpLoanForActor(actor,loan.id,request)).rejects.toThrow("INVALID_FINANCIAL_YEAR");}finally{await client.financialYear.update({where:{id:fy.id},data:{status:"OPEN"}});}
      const suffix=randomUUID().replaceAll("-","");const fn=`topup_audit_${suffix}`,trigger=`topup_audit_trigger_${suffix}`;
      await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"='LOAN_TOP_UP_POSTED' THEN RAISE EXCEPTION 'test topup audit failure'; END IF; RETURN NEW; END $$`);
      await client.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      try{await expect(topUpLoanForActor(actor,loan.id,request)).rejects.toThrow();expect((await client.loan.findUniqueOrThrow({where:{id:loan.id}})).version).toBe(loan.version);expect(await client.loanOperation.count({where:{companyId,requestKey:request.requestKey}})).toBe(0);expect(await client.journalEntry.count({where:{companyId}})).toBe(before);}finally{await client.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);}
    });
    it("prevents receipt cancellation after its account funds have been spent",async()=>{
      const {changeLoanLifecycleForActor}=await import("./loan-operations");const {postJournalForActor}=await import("@/lib/accounting/service");
      const account=await createMoneyAccountForActor(actor,{branchId,type:"BANK",name:"Spent loan receipt",creationRequestKey:randomUUID()});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Spent receipt",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:account.id,idempotencyKey:randomUUID()});
      const fy=await client.financialYear.findFirstOrThrow({where:{companyId,name:"Loan statement year"}});const expense=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"GENERAL_EXPENSES"}});
      await postJournalForActor(actor,{financialYearId:fy.id,branchId,entryDate:"2032-01-02",sourceType:"MANUAL_JOURNAL",sourceId:randomUUID(),lines:[{ledgerAccountId:expense.id,debit:"90",credit:"0"},{ledgerAccountId:account.ledgerAccountId,debit:"0",credit:"90"}]});
      const before=await client.journalEntry.count({where:{companyId}});await expect(changeLoanLifecycleForActor(actor,loan.id,{requestKey:randomUUID(),expectedVersion:loan.version,action:"CANCEL",operationDate:"2032-01-03",reason:"Correction requested"})).rejects.toThrow("INSUFFICIENT_FUNDS");expect((await client.loan.findUniqueOrThrow({where:{id:loan.id}})).status).toBe("ACTIVE");expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
    });
    it("does not double-count or mutate a shared legacy loan liability ledger",async()=>{
      const {loanOverviewForActor}=await import("./loan-overview");const {loanHistoryForActor}=await import("./loan-history");const {topUpLoanForActor,changeLoanLifecycleForActor}=await import("./loan-operations");
      const source=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"Ambiguous legacy loan",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:source.moneyAccountId,idempotencyKey:randomUUID()});
      const duplicate=await client.loan.create({data:{companyId,branchId,lender:"Ambiguous legacy loan duplicate",loanType:"TERM",principal:"100",startDate:loan.startDate,moneyAccountId:loan.moneyAccountId,liabilityLedgerId:loan.liabilityLedgerId}});
      try{
       const overview=await loanOverviewForActor(actor,{branchId,q:"Ambiguous legacy loan"});expect(overview.total).toBe(2);expect(overview.outstanding).toBe("0");expect(overview.unpostedBalanceCount).toBe(2);expect(overview.rows.every(x=>x.outstanding===null)).toBe(true);
       expect(await loanHistoryForActor(actor,loan.id,{branchId})).toMatchObject({outstanding:null,ambiguousBalance:true,rows:[]});
       await expect(postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:loan.moneyAccountId,paymentDate:"2032-01-02",principal:"10",interest:"0",charges:"0",idempotencyKey:randomUUID()})).rejects.toThrow("LOAN_BALANCE_AMBIGUOUS");
       await expect(topUpLoanForActor(actor,loan.id,{requestKey:randomUUID(),expectedVersion:loan.version,amount:"10",operationDate:"2032-01-02",moneyAccountId:loan.moneyAccountId})).rejects.toThrow("LOAN_BALANCE_AMBIGUOUS");
       await expect(changeLoanLifecycleForActor(actor,loan.id,{requestKey:randomUUID(),expectedVersion:loan.version,action:"CANCEL",operationDate:"2032-01-02",reason:"Correct record"})).rejects.toThrow("LOAN_BALANCE_AMBIGUOUS");
      }finally{await client.loan.delete({where:{id:duplicate.id}});}
    });
    it("persists independent loan identity and rejects changed metadata on retry",async()=>{
      const source=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      expect(source.displayName).toBeNull();expect(source.loanAccountNumber).toBeNull();expect(source.durationMonths).toBeNull();
      const request={branchId,lender:"Same lender",loanType:"TERM",principal:"100",startDate:"2032-01-01",moneyAccountId:source.moneyAccountId,idempotencyKey:randomUUID(),displayName:"Project loan A",loanAccountNumber:"ACCOUNT-A",description:"Working capital",durationMonths:"60"};
      const first=await createAndReceiveLoanForActor(actor,request);
      const second=await createAndReceiveLoanForActor(actor,{...request,idempotencyKey:randomUUID(),displayName:"Project loan B",loanAccountNumber:"ACCOUNT-B"});
      expect(first.id).not.toBe(second.id);expect(first).toMatchObject({displayName:"Project loan A",loanAccountNumber:"ACCOUNT-A",description:"Working capital",durationMonths:60});
      expect((await createAndReceiveLoanForActor(actor,request)).id).toBe(first.id);
      for(const change of [{displayName:"Changed"},{loanAccountNumber:"Changed"},{description:"Changed"},{durationMonths:"61"}])await expect(createAndReceiveLoanForActor(actor,{...request,...change})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      const {loanOverviewForActor}=await import("./loan-overview");expect((await loanOverviewForActor(actor,{branchId,q:"ACCOUNT-B"})).rows.map(row=>row.id)).toEqual([second.id]);
    });
    it("keeps real posted running balances beyond 200 statement entries",async()=>{
      const {loanHistoryForActor}=await import("./loan-history");
      const loan=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});
      for(let n=0;n<201;n++)await postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:loan.moneyAccountId,paymentDate:"2032-01-04",principal:"0",interest:"0",charges:"1",idempotencyKey:randomUUID()});
      const history=await loanHistoryForActor(actor,loan.id,{branchId,offset:200,limit:2});
      expect(history.total).toBe(204);expect(history.rows).toHaveLength(2);expect(history.rows.every(row=>row.balance==="98000")).toBe(true);expect(history.outstanding).toBe("98000");expect(history.nextOffset).toBe(202);
    },30000);
    it("persists independent bank print preferences, validates identifiers and clears optional metadata",async()=>{
      const request={type:"BANK",name:"Metadata bank",branchId,creationRequestKey:randomUUID(),accountHolderName:"Holder",bankBranchName:"Bank branch",bankName:"Bank",accountNumberMasked:"****1234",ifsc:"SBIN0001234",upiId:"holder@bank",printBankDetails:true,printUpiQr:true};
      const row=await createMoneyAccountForActor(actor,request);expect(row).toMatchObject({accountHolderName:"Holder",bankBranchName:"Bank branch",upiId:"holder@bank",printBankDetails:true,printUpiQr:true});expect((await createMoneyAccountForActor(actor,request)).id).toBe(row.id);
      await expect(createMoneyAccountForActor(actor,{...request,printUpiQr:false})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      await expect(updateMoneyAccountForActor(actor,row.id,{ifsc:"BAD"})).rejects.toThrow();await expect(updateMoneyAccountForActor(actor,row.id,{upiId:"invalid"})).rejects.toThrow();
      for(const [bank,qr] of [[false,false],[true,false],[false,true],[true,true]]){await updateMoneyAccountForActor(actor,row.id,{printBankDetails:bank,printUpiQr:qr});expect(await client.moneyAccount.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({printBankDetails:bank,printUpiQr:qr});}
      await expect(updateMoneyAccountForActor(actor,row.id,{upiId:""})).rejects.toThrow("BANK_UPI_REQUIRED");
      await updateMoneyAccountForActor(actor,row.id,{printBankDetails:false,printUpiQr:false,upiId:"",accountHolderName:"",bankBranchName:""});expect(await client.moneyAccount.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({upiId:null,accountHolderName:null,bankBranchName:null,printBankDetails:false,printUpiQr:false});
      await expect(createMoneyAccountForActor(actor,{type:"CASH",name:"Invalid cash metadata",branchId,creationRequestKey:randomUUID(),printBankDetails:true})).rejects.toThrow("BANK_METADATA_NOT_APPLICABLE");
    });
    it("authorizes invoice bank selection and keeps print changes outside the financial ledger",async()=>{
      const {updateSettingsSectionForActor}=await import("./settings-persistence");const {invoiceBankProfile}=await import("./invoice-bank-profile");
      const bank=await client.moneyAccount.findFirstOrThrow({where:{companyId,name:"Metadata bank"}});const journalsBefore=await client.journalEntry.count({where:{companyId}});
      await updateSettingsSectionForActor(actor,"invoicePrintSettings",{bankAccountId:bank.id,theme:"REGULAR"});expect((await client.accountSettings.findUniqueOrThrow({where:{companyId}})).transactionDefaults).toMatchObject({invoicePrintSettings:{bankAccountId:bank.id}});
      for(const principal of [{...actor,accountRole:"ACCOUNTANT"},{...actor,companyId:otherCompany},{...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[randomUUID()]}])await expect(updateSettingsSectionForActor(principal,"invoicePrintSettings",{bankAccountId:bank.id})).rejects.toThrow();
      await expect(updateSettingsSectionForActor(actor,"invoicePrintSettings",{bankAccountId:randomUUID()})).rejects.toThrow("BANK_ACCOUNT_NOT_AVAILABLE");
      await client.moneyAccount.update({where:{id:bank.id},data:{isActive:false}});await expect(updateSettingsSectionForActor(actor,"invoicePrintSettings",{bankAccountId:bank.id})).rejects.toThrow("BANK_ACCOUNT_NOT_AVAILABLE");expect(await invoiceBankProfile(companyId,branchId,bank.id)).toEqual({bankDetails:null,showQr:false});await client.moneyAccount.update({where:{id:bank.id},data:{isActive:true}});
      expect(await client.journalEntry.count({where:{companyId}})).toBe(journalsBefore);
    });
    it("edits loan metadata once under concurrent retries and preserves the original financial request",async()=>{
      const {editLoanMetadataForActor}=await import("./loan-operations");
      const loan=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});const journalsBefore=await client.journalEntry.count({where:{companyId}});
      const request={requestKey:randomUUID(),expectedVersion:loan.version,displayName:"Edited statement loan",loanAccountNumber:"EDITED-ACCOUNT",description:"Edited details",durationMonths:"24"};
      const [first,second]=await Promise.all([editLoanMetadataForActor(actor,loan.id,request),editLoanMetadataForActor(actor,loan.id,request)]);expect(first.version).toBe(loan.version+1);expect(second.version).toBe(first.version);expect(await client.loanOperation.count({where:{companyId,requestKey:request.requestKey}})).toBe(1);
      expect(first).toMatchObject({displayName:"Edited statement loan",loanAccountNumber:"EDITED-ACCOUNT",durationMonths:24,receivedJournalId:loan.receivedJournalId,creationRequestHash:loan.creationRequestHash});expect(first.principal.eq(loan.principal)).toBe(true);expect(await client.journalEntry.count({where:{companyId}})).toBe(journalsBefore);
      await expect(editLoanMetadataForActor(actor,loan.id,{...request,description:"Changed same key"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");await expect(editLoanMetadataForActor(actor,loan.id,{...request,requestKey:randomUUID()})).rejects.toThrow("LOAN_CHANGED");await expect(editLoanMetadataForActor({...actor,accountRole:"ACCOUNTANT"},loan.id,request)).rejects.toThrow();await expect(editLoanMetadataForActor({...actor,companyId:otherCompany},loan.id,request)).rejects.toThrow();await expect(editLoanMetadataForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},loan.id,request)).rejects.toThrow();
      const original={branchId:loan.branchId,lender:loan.lender,loanType:loan.loanType,principal:loan.principal.toString(),startDate:loan.startDate,moneyAccountId:loan.moneyAccountId,idempotencyKey:loan.idempotencyKey!};expect((await createAndReceiveLoanForActor(actor,original)).id).toBe(loan.id);expect(await client.journalEntry.count({where:{companyId}})).toBe(journalsBefore);
      const operation=await client.loanOperation.findFirstOrThrow({where:{companyId,requestKey:request.requestKey}});await expect(client.loanOperation.update({where:{id:operation.id},data:{metadata:{forged:true}}})).rejects.toThrow("LOAN_OPERATION_IMMUTABLE");await expect(client.loan.update({where:{id:loan.id},data:{principal:"1"}})).rejects.toThrow("LOAN_RECEIPT_IMMUTABLE");await expect(client.loan.delete({where:{id:loan.id}})).rejects.toThrow("LOAN_HISTORY_IMMUTABLE");
    });
    it("rolls back loan metadata and its retry record when audit insertion fails",async()=>{
      const {editLoanMetadataForActor}=await import("./loan-operations");const before=await client.loan.findFirstOrThrow({where:{companyId,lender:"Statement lender"}});const request={requestKey:randomUUID(),expectedVersion:before.version,description:"Must roll back"};const suffix=randomUUID().replaceAll("-","");const fn=`loan_audit_${suffix}`,trigger=`loan_audit_trigger_${suffix}`;
      await client.$executeRawUnsafe(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."companyId"='${companyId}'::uuid AND NEW."eventType"='LOAN_METADATA_EDITED' THEN RAISE EXCEPTION 'test loan audit failure'; END IF; RETURN NEW; END $$`);
      await client.$executeRawUnsafe(`CREATE TRIGGER ${trigger} BEFORE INSERT ON account_operational_audits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      try{await expect(editLoanMetadataForActor(actor,before.id,request)).rejects.toThrow();expect(await client.loan.findUniqueOrThrow({where:{id:before.id}})).toMatchObject({version:before.version,description:before.description});expect(await client.loanOperation.count({where:{companyId,requestKey:request.requestKey}})).toBe(0);}finally{await client.$executeRawUnsafe(`DROP TRIGGER ${trigger} ON account_operational_audits`);await client.$executeRawUnsafe(`DROP FUNCTION ${fn}()`);}
    });
    it("replays concurrent creation without a second account, ledger or audit", async () => {
      const input = {
        type: "BANK",
        name: "Retry-safe bank",
        branchId,
        creationRequestKey: randomUUID(),
      };
      const [first, second] = await Promise.all([
        createMoneyAccountForActor(actor, input),
        createMoneyAccountForActor(actor, input),
      ]);
      expect(second.id).toBe(first.id);
      const createdLedger = await client.ledgerAccount.findUniqueOrThrow({
        where: { id: first.ledgerAccountId },
      });
      expect(BigInt(createdLedger.code.slice(3))).toBeGreaterThan(BigInt(123));
      expect(
        await client.numberingSeries.count({
          where: {
            companyId,
            branchId: null,
            seriesKey: "MONEY_LEDGER_GLOBAL",
          },
        }),
      ).toBe(1);
      expect(
        await client.moneyAccount.count({
          where: { companyId, creationRequestKey: input.creationRequestKey },
        }),
      ).toBe(1);
      expect(
        await client.ledgerAccount.count({
          where: { companyId, name: input.name },
        }),
      ).toBe(1);
      expect(
        await client.accountOperationalAudit.count({
          where: {
            companyId,
            entityId: first.id,
            eventType: "MONEY_ACCOUNT_CREATED",
          },
        }),
      ).toBe(1);
      await expect(
        createMoneyAccountForActor(actor, { ...input, name: "Changed intent" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      await expect(
        createMoneyAccountForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          input,
        ),
      ).rejects.toThrow();
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: first.id },
          })
        ).name,
      ).toBe(input.name);
    });
    it("retains legacy account rows without inventing creation identities", async () => {
      expect(
        await client.moneyAccount.findUniqueOrThrow({
          where: { id: accountId },
        }),
      ).toMatchObject({ creationRequestKey: null, creationRequestHash: null });
    });
    it("renames the linked ledger atomically and records before/after without posting", async () => {
      const journalsBefore=await client.journalEntry.count({where:{companyId}});
      await updateMoneyAccountForActor(actor, accountId, {
        name: "Renamed bank",
        bankName: "Updated bank",
      });
      expect(
        (
          await client.ledgerAccount.findUniqueOrThrow({
            where: { id: ledgerId },
          })
        ).name,
      ).toBe("Renamed bank");
      const audit = await client.accountOperationalAudit.findFirstOrThrow({
        where: { companyId, entityId:accountId,eventType: "MONEY_ACCOUNT_UPDATED" },
      });
      expect(audit.metadata).toMatchObject({
        before: { name: "Original bank", isActive: true },
        after: { name: "Renamed bank", isActive: true },
      });
      expect(await client.journalEntry.count({ where: { companyId } })).toBe(journalsBefore);
    });
    it("rolls back account and ledger when the audit write fails", async () => {
      await expect(
        updateMoneyAccountForActor({ ...actor, id: randomUUID() }, accountId, {
          name: "Rolled back bank",
        }),
      ).rejects.toThrow();
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).name,
      ).toBe("Renamed bank");
      expect(
        (
          await client.ledgerAccount.findUniqueOrThrow({
            where: { id: ledgerId },
          })
        ).name,
      ).toBe("Renamed bank");
    });
    it("rejects foreign-company, excluded-branch and non-entry-role direct mutations", async () => {
      for (const denied of [
        { ...actor, companyId: otherCompany },
        {
          ...actor,
          branchAccessScope: "SELECTED_BRANCHES" as const,
          branchIds: [],
        },
        { ...actor, accountRole: "PROJECT_MANAGER" as const },
      ]) {
        await expect(
          updateMoneyAccountForActor(denied, accountId, { name: "Denied" }),
        ).rejects.toThrow();
        await expect(
          deactivateMoneyAccountForActor(denied, accountId),
        ).rejects.toThrow();
      }
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).isActive,
      ).toBe(true);
    });
    it("audits deactivation once on repeat, preserving ledger posting identity", async () => {
      await deactivateMoneyAccountForActor(actor, accountId);
      await deactivateMoneyAccountForActor(actor, accountId);
      expect(
        await client.accountOperationalAudit.count({
          where: { companyId, eventType: "MONEY_ACCOUNT_DEACTIVATED" },
        }),
      ).toBe(1);
      expect(
        (
          await client.moneyAccount.findUniqueOrThrow({
            where: { id: accountId },
          })
        ).isActive,
      ).toBe(false);
      expect(
        await client.ledgerAccount.findUniqueOrThrow({
          where: { id: ledgerId },
        }),
      ).toMatchObject({
        code: "EDIT-BANK",
        name: "Renamed bank",
        isActive: true,
        allowPosting: true,
      });
    });
    it("posts opening equity atomically, replays safely, and allows an immutable manual clearing journal", async () => {
      const { postJournalForActor } = await import("@/lib/accounting/service");
      const fy = await client.financialYear.create({
        data: {
          companyId,
          name: "Opening year",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2025-12-31"),
        },
      });
      const input = {
        type: "CASH",
        name: "Opening cash",
        branchId,
        creationRequestKey: randomUUID(),
        openingBalance: "5000.00",
        openingDate: "2025-10-13",
      };
      const created = await Promise.all([
        createMoneyAccountForActor(actor, input),
        createMoneyAccountForActor(actor, input),
      ]);
      expect(created[0].id).toBe(created[1].id);
      const account = created[0];
      expect((await createMoneyAccountForActor(actor, input)).id).toBe(
        account.id,
      );
      await expect(
        createMoneyAccountForActor(actor, { ...input, openingBalance: "5001" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      const opening = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: account.id },
        include: { lines: true },
      });
      const equity = await client.ledgerAccount.findFirstOrThrow({
        where: { companyId, systemKey: "OPENING_BALANCE_EQUITY" },
      });
      expect(equity.accountClass).toBe("EQUITY");
      expect(equity.allowPosting).toBe(true);
      expect(
        opening.lines
          .find((x) => x.ledgerAccountId === account.ledgerAccountId)
          ?.debit.toFixed(2),
      ).toBe("5000.00");
      expect(
        opening.lines
          .find((x) => x.ledgerAccountId === equity.id)
          ?.credit.toFixed(2),
      ).toBe("5000.00");
      expect(
        await client.journalEntry.count({
          where: { companyId, sourceId: account.id },
        }),
      ).toBe(1);
      await expect(
        createMoneyAccountForActor(
          { ...actor, accountRole: "PROJECT_MANAGER" },
          { ...input, creationRequestKey: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        createMoneyAccountForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          { ...input, creationRequestKey: randomUUID() },
        ),
      ).rejects.toThrow();
      await expect(
        createMoneyAccountForActor(actor, {
          ...input,
          creationRequestKey: randomUUID(),
          openingDate: "2025-02-30",
        }),
      ).rejects.toThrow();
      const lock = await client.accountingPeriodLock.create({
        data: {
          companyId,
          financialYearId: fy.id,
          lockedThrough: new Date("2025-10-13"),
          updatedById: userId,
        },
      });
      try {
        await expect(
          createMoneyAccountForActor(actor, {
            ...input,
            name: "Locked opening cash",
            creationRequestKey: randomUUID(),
          }),
        ).rejects.toThrow("PERIOD_LOCKED");
        expect(
          await client.moneyAccount.count({
            where: { companyId, name: "Locked opening cash" },
          }),
        ).toBe(0);
        expect(
          await client.ledgerAccount.count({
            where: { companyId, name: "Locked opening cash" },
          }),
        ).toBe(0);
      } finally {
        await client.accountingPeriodLock.delete({ where: { id: lock.id } });
      }
      const overdraftInput = {
        ...input,
        type: "BANK",
        name: "Opening overdraft",
        creationRequestKey: randomUUID(),
        openingBalance: "-100.50",
      };
      const overdraft = await createMoneyAccountForActor(actor, overdraftInput);
      const negative = await client.journalEntry.findFirstOrThrow({
        where: { companyId, sourceId: overdraft.id },
        include: { lines: true },
      });
      expect(
        negative.lines
          .find((x) => x.ledgerAccountId === overdraft.ledgerAccountId)
          ?.credit.toFixed(2),
      ).toBe("100.50");
      expect(
        negative.lines
          .find((x) => x.ledgerAccountId === equity.id)
          ?.debit.toFixed(2),
      ).toBe("100.50");
      const retained = await client.ledgerAccount.create({
        data: {
          companyId,
          code: "3200",
          name: "Retained Earnings",
          accountClass: "EQUITY",
          normalBalance: "CREDIT",
          systemKey: "RETAINED_EARNINGS",
        },
      });
      await postJournalForActor(actor, {
        financialYearId: fy.id,
        branchId,
        entryDate: "2025-10-14",
        sourceType: "MANUAL_JOURNAL",
        sourceId: randomUUID(),
        lines: [
          { ledgerAccountId: equity.id, debit: "4899.50", credit: "0" },
          { ledgerAccountId: retained.id, debit: "0", credit: "4899.50" },
        ],
      });
      const total = await client.journalLine.aggregate({
        where: { companyId, ledgerAccountId: equity.id },
        _sum: { debit: true, credit: true },
      });
      expect(total._sum.debit?.equals(total._sum.credit!)).toBe(true);
      expect(
        (
          await client.journalEntry.findUniqueOrThrow({
            where: { id: opening.id },
          })
        ).status,
      ).toBe("POSTED");
      await expect(
        createMoneyAccountForActor(actor, {
          ...input,
          name: "Invalid date cash",
          creationRequestKey: randomUUID(),
          openingDate: "2024-01-01",
        }),
      ).rejects.toThrow("INVALID_FINANCIAL_YEAR");
      expect(
        await client.moneyAccount.count({
          where: { companyId, name: "Invalid date cash" },
        }),
      ).toBe(0);
      expect(
        await client.ledgerAccount.count({
          where: { companyId, name: "Invalid date cash" },
        }),
      ).toBe(0);
    });
    it("reads exact opening and running balances with date filters and branch isolation", async () => {
      const { moneyAccountHistoryForActor } =
        await import("./money-account-history");
      const account = await client.moneyAccount.findFirstOrThrow({
        where: { companyId, name: "Opening cash" },
      });
      const all = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
      });
      expect(all.opening).toBe("0.00");
      expect(all.closing).toBe("5000.00");
      expect(all.rows[0].balance).toBe("5000.00");
      expect(all.total).toBe(1);
      const after = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
        from: "2025-10-14",
      });
      expect(after.opening).toBe("5000.00");
      expect(after.closing).toBe("5000.00");
      expect(after.rows).toEqual([]);
      const before = await moneyAccountHistoryForActor(actor, account.id, {
        branchId,
        to: "2025-10-12",
      });
      expect(before.closing).toBe("0.00");
      await client.moneyAccount.update({
        where: { id: account.id },
        data: { isActive: false },
      });
      expect(
        (await moneyAccountHistoryForActor(actor, account.id, { branchId }))
          .closing,
      ).toBe("5000.00");
      await expect(
        moneyAccountHistoryForActor(actor, account.id, {
          branchId,
          from: "2025-02-30",
        }),
      ).rejects.toThrow();
      await expect(
        moneyAccountHistoryForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          account.id,
          { branchId },
        ),
      ).rejects.toThrow();
      await expect(
        moneyAccountHistoryForActor(actor, randomUUID(), { branchId }),
      ).rejects.toThrow();
    });
    it("scopes shared-account balances to an authorized selected branch or Admin consolidation", async () => {
      const secondBranch = randomUUID();
      await client.branch.create({
        data: {
          id: secondBranch,
          companyId,
          name: "Second money branch",
          code: "MONEY2",
        },
      });
      await client.financialYear.create({
        data: {
          companyId,
          name: "Money context year",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31"),
        },
      });
      const shared = await createMoneyAccountForActor(actor, {
        type: "BANK",
        name: "Context shared bank",
        creationRequestKey: randomUUID(),
      });
      const cash1 = await createMoneyAccountForActor(actor, {
        type: "CASH",
        name: "Context cash one",
        branchId,
        creationRequestKey: randomUUID(),
      });
      const cash2 = await createMoneyAccountForActor(actor, {
        type: "CASH",
        name: "Context cash two",
        branchId: secondBranch,
        creationRequestKey: randomUUID(),
      });
      await createMoneyTransferForActor(actor, {
        branchId,
        sourceAccountId: shared.id,
        destinationAccountId: cash1.id,
        amount: "10",
        transferDate: "2026-10-13",
        idempotencyKey: randomUUID(),
      });
      await createMoneyTransferForActor(actor, {
        branchId: secondBranch,
        sourceAccountId: shared.id,
        destinationAccountId: cash2.id,
        amount: "20",
        transferDate: "2026-10-13",
        idempotencyKey: randomUUID(),
      });
      const { moneyAccountHistoryForActor } =
        await import("./money-account-history");
      expect(
        (await moneyAccountHistoryForActor(actor, shared.id, { branchId }))
          .closing,
      ).toBe("-10.00");
      expect(
        (
          await moneyAccountHistoryForActor(actor, shared.id, {
            branchId: secondBranch,
          })
        ).closing,
      ).toBe("-20.00");
      const history = await moneyAccountHistoryForActor(actor, shared.id, {
        scope: "all",
        limit: 1,
      });
      expect(history.total).toBe(2);
      expect(history.closing).toBe("-30.00");
      expect(history.rows[0].balance).toBe("-30.00");
      const older = await moneyAccountHistoryForActor(actor, shared.id, {
        scope: "all",
        offset: 1,
        limit: 1,
      });
      expect(older.rows[0].balance).toBe("-10.00");
      expect(
        (await moneyAccountHistoryForActor(actor, cash1.id, { branchId }))
          .closing,
      ).toBe("10.00");
      await expect(
        moneyAccountHistoryForActor(actor, cash1.id, {
          branchId: secondBranch,
        }),
      ).rejects.toThrow();
      const branchOne = await moneyReadContext(actor, { branchId }),
        branchTwo = await moneyReadContext(actor, { branchId: secondBranch }),
        all = await moneyReadContext(actor, { scope: "all" });
      const first = await moneyDashboardForActor(branchOne.actor),
        second = await moneyDashboardForActor(branchTwo.actor),
        combined = await moneyDashboardForActor(all.actor);
      expect(
        first.accounts.find((row) => row.id === shared.id)?.balance.toFixed(2),
      ).toBe("-10.00");
      expect(
        second.accounts.find((row) => row.id === shared.id)?.balance.toFixed(2),
      ).toBe("-20.00");
      expect(
        combined.accounts
          .find((row) => row.id === shared.id)
          ?.balance.toFixed(2),
      ).toBe("-30.00");
      expect(first.accounts.some((row) => row.id === cash2.id)).toBe(false);
      expect(second.accounts.some((row) => row.id === cash1.id)).toBe(false);
      const restricted = {
        ...actor,
        branchAccessScope: "SELECTED_BRANCHES" as const,
        branchIds: [branchId],
      };
      await expect(
        moneyReadContext(restricted, { branchId: secondBranch }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(restricted, { scope: "all" }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(
          { ...actor, accountRole: "ACCOUNTANT" },
          { scope: "all" },
        ),
      ).rejects.toThrow();
      await expect(
        moneyReadContext({ ...actor, companyId: otherCompany }, { branchId }),
      ).rejects.toThrow();
      await expect(
        moneyReadContext(actor, { branchId, scope: "all" }),
      ).rejects.toThrow();
    });
    it("posts selected-ledger cash adjustments once and prevents concurrent cash overdrafts", async () => {
      const { postMoneyAdjustmentForActor } =
        await import("./money-adjustment");
      const { moneyAccountHistoryForActor } =
        await import("./money-account-history");
      const ledger = await client.ledgerAccount.create({
        data: {
          companyId,
          code: "ADJ-EXPENSE",
          name: "Cash shortage expense",
          accountClass: "EXPENSE",
          normalBalance: "DEBIT",
        },
      });
      const account = await createMoneyAccountForActor(actor, {
        type: "CASH",
        name: "Adjustment cash",
        branchId,
        creationRequestKey: randomUUID(),
        openingBalance: "100",
        openingDate: "2026-10-13",
      });
      const base = {
        moneyAccountId: account.id,
        branchId,
        direction: "REDUCE",
        offsetLedgerId: ledger.id,
        amount: "80.00",
        date: "2026-10-13",
        reason: "Counted cash shortage",
        idempotencyKey: randomUUID(),
      };
      const concurrent = await Promise.allSettled([
        postMoneyAdjustmentForActor(actor, base),
        postMoneyAdjustmentForActor(actor, {
          ...base,
          idempotencyKey: randomUUID(),
        }),
      ]);
      expect(concurrent.filter((r) => r.status === "fulfilled")).toHaveLength(
        1,
      );
      expect(concurrent.filter((r) => r.status === "rejected")).toHaveLength(1);
      const saved = (
        concurrent.find(
          (r) => r.status === "fulfilled",
        ) as PromiseFulfilledResult<{ id: string }>
      ).value;
      const posted = await client.journalEntry.findUniqueOrThrow({
        where: { id: saved.id },
        include: { lines: true },
      });
      expect(
        posted.lines
          .find((l) => l.ledgerAccountId === ledger.id)
          ?.debit.toFixed(2),
      ).toBe("80.00");
      expect(
        (await moneyAccountHistoryForActor(actor, account.id, { branchId }))
          .closing,
      ).toBe("20.00");
      const replayInput = { ...base, idempotencyKey: posted.sourceId! };
      expect((await postMoneyAdjustmentForActor(actor, replayInput)).id).toBe(
        saved.id,
      );
      await expect(
        postMoneyAdjustmentForActor(actor, { ...replayInput, amount: "10" }),
      ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
      const obe = await client.ledgerAccount.findFirstOrThrow({
        where: { companyId, systemKey: "OPENING_BALANCE_EQUITY" },
      });
      await expect(
        postMoneyAdjustmentForActor(actor, {
          ...base,
          direction: "ADD",
          offsetLedgerId: obe.id,
          idempotencyKey: randomUUID(),
        }),
      ).rejects.toThrow("INVALID_LEDGER_ACCOUNT");
      await expect(
        postMoneyAdjustmentForActor(
          { ...actor, branchAccessScope: "SELECTED_BRANCHES", branchIds: [] },
          base,
        ),
      ).rejects.toThrow();
      const invalidAuditKey = randomUUID();
      await expect(
        postMoneyAdjustmentForActor(
          { ...actor, id: randomUUID() },
          {
            ...base,
            direction: "ADD",
            amount: "1",
            idempotencyKey: invalidAuditKey,
          },
        ),
      ).rejects.toThrow();
      expect(
        await client.journalEntry.count({
          where: {
            companyId,
            sourceType: "MONEY_ADJUSTMENT",
            sourceId: invalidAuditKey,
          },
        }),
      ).toBe(0);
      const fy = await client.financialYear.findFirstOrThrow({
        where: {
          companyId,
          startDate: { lte: new Date(base.date) },
          endDate: { gte: new Date(base.date) },
        },
      });
      const lock = await client.accountingPeriodLock.create({
        data: {
          companyId,
          financialYearId: fy.id,
          lockedThrough: new Date(base.date),
          updatedById: userId,
        },
      });
      try {
        await expect(
          postMoneyAdjustmentForActor(actor, {
            ...base,
            direction: "ADD",
            idempotencyKey: randomUUID(),
          }),
        ).rejects.toThrow("PERIOD_LOCKED");
      } finally {
        await client.accountingPeriodLock.delete({ where: { id: lock.id } });
      }
      await expect(
        postMoneyAdjustmentForActor(
          { ...actor, companyId: otherCompany },
          base,
        ),
      ).rejects.toThrow();
      expect(
        await client.accountOperationalAudit.count({
          where: {
            companyId,
            eventType: "MONEY_ADJUSTMENT_POSTED",
            entityId: account.id,
          },
        }),
      ).toBe(1);
    });
    it("A064 creates a bank with its name only and adds or clears optional details later without posting",async()=>{
      const before=await client.journalEntry.count({where:{companyId}});
      const row=await createMoneyAccountForActor(actor,{type:"BANK",name:"Name only bank",branchId,creationRequestKey:randomUUID()});
      expect(row).toMatchObject({name:"Name only bank",type:"BANK",printBankDetails:false,printUpiQr:false});
      expect(row.upiId).toBeNull();expect(row.accountNumberMasked).toBeNull();
      await updateMoneyAccountForActor(actor,row.id,{accountHolderName:"Holder",bankName:"Canara",bankBranchName:"Main",accountNumberMasked:"****4321",ifsc:"CNRB0001234"});
      expect(await client.moneyAccount.findUniqueOrThrow({where:{id:row.id}})).toMatchObject({accountHolderName:"Holder",bankName:"Canara",accountNumberMasked:"****4321",ifsc:"CNRB0001234",upiId:null});
      await updateMoneyAccountForActor(actor,row.id,{accountHolderName:"",bankName:"",bankBranchName:"",accountNumberMasked:"",ifsc:""});
      expect(await client.journalEntry.count({where:{companyId}})).toBe(before);
    });
    it("A064 account history reconciles empty bank, cash, transfers, receipts, payments and paged balances",async()=>{
      const {moneyAccountHistoryForActor}=await import("./money-account-history");
      const {postMoneyAdjustmentForActor}=await import("./money-adjustment");
      await client.financialYear.create({data:{companyId,name:"History matrix year",startDate:new Date("2035-01-01"),endDate:new Date("2035-12-31")}});
      const cash=await createMoneyAccountForActor(actor,{type:"CASH",name:"History matrix cash",branchId,creationRequestKey:randomUUID(),openingBalance:"1000",openingDate:"2035-01-01"});
      const bank=await createMoneyAccountForActor(actor,{type:"BANK",name:"History matrix bank",branchId,creationRequestKey:randomUUID()});
      const empty=await moneyAccountHistoryForActor(actor,bank.id,{branchId});
      expect(empty).toMatchObject({total:0,opening:"0.00",debit:"0.00",credit:"0.00",closing:"0.00",rows:[]});
      const transfer={branchId,idempotencyKey:randomUUID(),sourceAccountId:cash.id,destinationAccountId:bank.id,amount:"100",transferDate:"2035-01-02"};
      await createMoneyTransferForActor(actor,transfer);
      await createMoneyTransferForActor(actor,{...transfer,idempotencyKey:randomUUID(),sourceAccountId:bank.id,destinationAccountId:cash.id,amount:"25",transferDate:"2035-01-03"});
      const expense=await client.ledgerAccount.findFirstOrThrow({where:{companyId,systemKey:"GENERAL_EXPENSES"}});
      await postMoneyAdjustmentForActor(actor,{moneyAccountId:bank.id,branchId,direction:"REDUCE",offsetLedgerId:expense.id,amount:"10",date:"2035-01-04",reason:"Bank correction verified",idempotencyKey:randomUUID()});
      const loan=await createAndReceiveLoanForActor(actor,{branchId,lender:"History matrix lender",loanType:"TERM",principal:"200",startDate:"2035-01-05",moneyAccountId:bank.id,idempotencyKey:randomUUID()});
      await postLoanPaymentForActor(actor,{loanId:loan.id,moneyAccountId:bank.id,paymentDate:"2035-01-06",principal:"50",interest:"5",charges:"0",idempotencyKey:randomUUID()});
      const all=await moneyAccountHistoryForActor(actor,bank.id,{branchId});
      expect(all).toMatchObject({total:5,opening:"0.00",debit:"300.00",credit:"90.00",closing:"210.00"});
      expect(all.rows.map(row=>row.balance)).toEqual(["210.00","265.00","65.00","75.00","100.00"]);
      const ids:string[]=[];
      for(const offset of [0,2,4]){const page=await moneyAccountHistoryForActor(actor,bank.id,{branchId,offset,limit:2});expect(page.closing).toBe("210.00");ids.push(...page.rows.map(row=>row.id));}
      expect(ids).toEqual(all.rows.map(row=>row.id));expect(new Set(ids).size).toBe(5);
      const filtered=await moneyAccountHistoryForActor(actor,bank.id,{branchId,from:"2035-01-05",to:"2035-01-06"});
      expect(filtered).toMatchObject({total:2,opening:"65.00",debit:"200.00",credit:"55.00",closing:"210.00"});
      expect((await moneyAccountHistoryForActor(actor,cash.id,{branchId})).closing).toBe("925.00");
      const dashboard=await moneyDashboardForActor(actor);expect(dashboard.accounts.find(row=>row.id===bank.id)?.balance.toFixed(2)).toBe(all.closing);
      await expect(moneyAccountHistoryForActor({...actor,companyId:otherCompany},bank.id,{scope:"all"})).rejects.toThrow();
      await expect(moneyAccountHistoryForActor({...actor,branchAccessScope:"SELECTED_BRANCHES",branchIds:[]},bank.id,{branchId})).rejects.toThrow();
      await deactivateMoneyAccountForActor(actor,bank.id);
      expect((await moneyAccountHistoryForActor(actor,bank.id,{branchId})).closing).toBe("210.00");
    });
  },
);

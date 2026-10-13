import {beforeEach,describe,expect,it,vi} from "vitest";
import {Prisma} from "@prisma/client";
const m=vi.hoisted(()=>({context:vi.fn(),loan:vi.fn(),count:vi.fn(),raw:vi.fn(),transaction:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
vi.mock("./money-context",()=>({moneyReadContext:m.context}));
import {loanHistoryForActor} from "./loan-history";
const id="00000000-0000-4000-8000-000000000001",branchId="00000000-0000-4000-8000-000000000002";
const actor={id:"user",name:"User",email:"u@example.test",role:"COMPANY_ADMIN" as const,isActive:true,managerType:null,salesRole:null,salesAccessActive:false,accountAccessActive:true,companyId:"company",accountRole:"ACCOUNT_ADMIN" as const,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
describe("scoped loan statement",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.context.mockResolvedValue({context:{mode:"BRANCH",branchId,branchName:"Branch"}});m.transaction.mockImplementation(fn=>fn({loan:{findFirst:m.loan,count:m.count},$queryRaw:m.raw}));m.loan.mockResolvedValue({id,branchId,liabilityLedgerId:id});m.count.mockResolvedValue(1);m.raw.mockResolvedValueOnce([{id,entryDate:new Date("2026-10-01"),debit:new Prisma.Decimal(2000),credit:new Prisma.Decimal(0),balance:new Prisma.Decimal(98000),payment:new Prisma.Decimal(2550)}]).mockResolvedValueOnce([{total:BigInt(202),balance:new Prisma.Decimal(98000),liabilityPostings:BigInt(202)}]);});
 it("retains full running balance past 200 entries and payment including interest",async()=>{const result=await loanHistoryForActor(actor,id,{offset:200,limit:1});expect(result.outstanding).toBe("98000");expect(result.rows[0]).toMatchObject({debit:"2000",balance:"98000",payment:"2550"});expect(result.nextOffset).toBe(201);expect(m.loan.mock.calls[0][0].where).toEqual({id,companyId:"company",branchId});const sql=m.raw.mock.calls[0][0];expect(sql.sql).toContain('SUM(credit-debit) OVER');expect(sql.sql).toContain('p.principal+p.interest+p.charges');expect(sql.sql).toContain('"reversalOfId"');expect(sql.values.slice(-2)).toEqual([1,200]);});
 it("does not attribute a shared legacy ledger to an individual loan",async()=>{m.count.mockResolvedValue(2);const result=await loanHistoryForActor(actor,id);expect(result).toMatchObject({outstanding:null,ambiguousBalance:true,total:0,rows:[]});expect(m.raw).not.toHaveBeenCalled();});
 it("does not disclose an inaccessible loan",async()=>{m.loan.mockResolvedValue(null);await expect(loanHistoryForActor(actor,id)).rejects.toThrow("Not authorized");expect(m.raw).not.toHaveBeenCalled();});
 it("keeps unposted starting balances unknown",async()=>{m.raw.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([{total:BigInt(0),balance:new Prisma.Decimal(0),liabilityPostings:BigInt(0)}]);expect((await loanHistoryForActor(actor,id)).outstanding).toBeNull();});
});

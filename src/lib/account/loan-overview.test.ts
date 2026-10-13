import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const m=vi.hoisted(()=>({context:vi.fn(),find:vi.fn(),count:vi.fn(),raw:vi.fn(),transaction:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
vi.mock("./money-context",()=>({moneyReadContext:m.context}));
import {loanOverviewForActor} from "./loan-overview";
const branchId="00000000-0000-4000-8000-000000000001";
const actor={id:"user",name:"User",email:"user@example.test",role:"COMPANY_ADMIN" as const,isActive:true,managerType:null,salesRole:null,salesAccessActive:false,accountAccessActive:true,companyId:"company",accountRole:"ACCOUNT_ADMIN" as const,branchAccessScope:"ALL_BRANCHES" as const,branchIds:[]};
describe("loan overview effective balances",()=>{
 beforeEach(()=>{vi.resetAllMocks();m.context.mockResolvedValue({context:{mode:"BRANCH",branchId,branchName:"Branch"}});m.transaction.mockImplementation(fn=>fn({loan:{findMany:m.find,count:m.count},$queryRaw:m.raw}));m.count.mockResolvedValue(3);m.find.mockResolvedValueOnce([{id:"one",principal:new Prisma.Decimal(100000)},{id:"legacy",principal:new Prisma.Decimal(99)}]).mockResolvedValueOnce([{id:"one"},{id:"legacy"},{id:"later"}]);m.raw.mockResolvedValue([{id:"one",balance:new Prisma.Decimal(98000),journals:BigInt(2)},{id:"later",balance:new Prisma.Decimal(100),journals:BigInt(1)}]);});
 it("uses posted debt rather than principal and totals every matching loan beyond the page",async()=>{const result=await loanOverviewForActor(actor,{limit:2});expect(result.rows.map(x=>x.outstanding)).toEqual(["98000",null]);expect(result.outstanding).toBe("98100");expect(result.unpostedBalanceCount).toBe(1);expect(result.nextOffset).toBe(2);expect(m.transaction.mock.calls[0][1]).toEqual({isolationLevel:"RepeatableRead"});});
 it("retains authorized company/branch, search, status and pagination",async()=>{await loanOverviewForActor(actor,{q:" Bank ",status:"ACTIVE",offset:2,limit:2});expect(m.find.mock.calls[0][0]).toMatchObject({where:{companyId:"company",branchId,status:"ACTIVE",OR:[{lender:{contains:"Bank",mode:"insensitive"}},{loanType:{contains:"Bank",mode:"insensitive"}},{reference:{contains:"Bank",mode:"insensitive"}}]},take:2,skip:2});expect(m.count.mock.calls[0][0].where).toEqual(m.find.mock.calls[0][0].where);});
 it("propagates scope denial before any database read",async()=>{m.context.mockRejectedValue(new Error("Denied"));await expect(loanOverviewForActor(actor,{})).rejects.toThrow("Denied");expect(m.transaction).not.toHaveBeenCalled();});
 it("rejects oversized pages and unexpected input",async()=>{await expect(loanOverviewForActor(actor,{limit:101})).rejects.toThrow();await expect(loanOverviewForActor(actor,{companyId:"forged"})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled();});
});

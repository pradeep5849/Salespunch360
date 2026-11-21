import {beforeEach,expect,it,vi} from "vitest";
const m=vi.hoisted(()=>({transaction:vi.fn(),lock:vi.fn(),find:vi.fn(),clear:vi.fn(),create:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
import {ensureOpenFinancialYearForDate} from "./financial-year";
const tx={$queryRaw:m.lock,financialYear:{findFirst:m.find,updateMany:m.clear,create:m.create}};
beforeEach(()=>{vi.clearAllMocks();m.transaction.mockImplementation(async callback=>callback(tx));m.find.mockResolvedValue(null);m.create.mockResolvedValue({id:"year"})});
it("uses one company-locked transaction for standalone current marker and creation",async()=>{await expect(ensureOpenFinancialYearForDate("company",new Date())).resolves.toEqual({id:"year"});expect(m.transaction).toHaveBeenCalledOnce();expect(m.lock).toHaveBeenCalledOnce();expect(m.create).toHaveBeenCalledOnce();expect(m.clear.mock.invocationCallOrder[0]).toBeLessThan(m.create.mock.invocationCallOrder[0])});
it("propagates failed create through the transaction instead of separately committing the marker",async()=>{m.create.mockRejectedValueOnce(new Error("WRITE_FAILED"));await expect(ensureOpenFinancialYearForDate("company",new Date())).rejects.toThrow("WRITE_FAILED");expect(m.transaction).toHaveBeenCalledOnce()});
it("does not nest a supplied transaction or reopen closed years",async()=>{m.find.mockResolvedValueOnce({isActive:true,status:"CLOSED"});await expect(ensureOpenFinancialYearForDate("company",new Date(),tx as never)).rejects.toThrow("INVALID_FINANCIAL_YEAR");expect(m.transaction).not.toHaveBeenCalled();expect(m.clear).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled()});

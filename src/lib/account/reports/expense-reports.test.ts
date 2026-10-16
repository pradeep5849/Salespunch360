import { beforeEach, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({ journals:vi.fn(),expenses:vi.fn(),categories:vi.fn(),modules:vi.fn() }));
vi.mock("@/lib/db",()=>({db:{journalEntry:{findMany:mocks.journals},expenseTransaction:{findMany:mocks.expenses},expenseCategory:{findMany:mocks.categories}}}));
vi.mock("../modules",()=>({requireAccountModules:mocks.modules}));
import { expenseReport } from "./expense-reports";
import type { FinancialReportContext } from "./service";
const context={actor:{companyId:"company"},branch:{branchId:"branch"},from:new Date("2026-10-01"),to:new Date("2026-10-31"),f:{projectId:"project"}} as FinancialReportContext;
beforeEach(()=>{vi.clearAllMocks();mocks.modules.mockResolvedValue(undefined);mocks.journals.mockResolvedValue([{id:"journal"}]);mocks.categories.mockResolvedValue([{id:"category",name:"Materials"}]);mocks.expenses.mockResolvedValue([{id:"expense",journalEntryId:"journal",categoryId:"category",transactionDate:new Date("2026-10-02"),transactionNumber:"EX-1",type:"OFFICE_EXPENSE",totalAmount:new Prisma.Decimal("31.4"),notes:"Materials",billedItems:[{name:"Bolt",quantity:"3",rate:"5"},{name:"bolt",quantity:"2",rate:"5"},{name:"Broken",quantity:"NaN",rate:"5"}]}]);});
it("keeps category totals distinct from billed item values and flags corrupt legacy lines",async()=>{
 const category=await expenseReport("expense-category",context);expect(category.rows).toEqual([["Materials","31.4"]]);
 const items=await expenseReport("expense-items",context);expect(items.rows).toEqual([["Bolt","5","25"]]);expect(items.totals).toEqual(["Total Item Expense","","25"]);expect(items.note).toContain("1 malformed historical");expect(items.note).toContain("tax");
 expect(mocks.expenses).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company",branchId:"branch",projectId:"project",journalEntryId:{not:null},type:{not:"OTHER_INCOME"}})}));
 expect(mocks.journals).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company",branchId:"branch",entryDate:{lte:context.to}})}));
});
it("shows posted transaction amounts and safe source links without inventing unpaid balances",async()=>{
 const report=await expenseReport("expense-transactions",context);expect(report.totals).toEqual(["Total expense","","","","31.4"]);expect(report.rowLinks).toEqual(["/workspace/account/expenses/expense"]);expect(report.summary?.map(x=>x.value)).toEqual(["1","31.4"]);
});
it("returns zero totals for no eligible expenses and stops before reads when module is denied",async()=>{
 mocks.expenses.mockResolvedValue([]);expect((await expenseReport("expense-items",context)).totals).toEqual(["Total Item Expense","","0"]);
 mocks.journals.mockClear();mocks.modules.mockRejectedValue(new Error("MODULE_DISABLED:EXPENSES"));await expect(expenseReport("expense-category",context)).rejects.toThrow("MODULE_DISABLED:EXPENSES");expect(mocks.journals).not.toHaveBeenCalled();
});

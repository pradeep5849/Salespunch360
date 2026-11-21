import { beforeEach, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({transaction:vi.fn()}));
vi.mock("@/lib/db",()=>({db:{$transaction:m.transaction}}));
import {verifyCompanyAccountDataForActor} from "./utilities";
beforeEach(()=>{vi.clearAllMocks();m.transaction.mockResolvedValue([])});
it.each([{accountRole:"ACCOUNTANT",branchAccessScope:"ALL_BRANCHES"},{accountRole:"ACCOUNT_ADMIN",branchAccessScope:"SELECTED_BRANCHES"},{accountRole:"PROJECT_MANAGER",branchAccessScope:"ALL_BRANCHES"},{accountRole:"ACCOUNT_ADMIN"}])("denies company-wide scan before reads for %j",async scope=>{await expect(verifyCompanyAccountDataForActor({id:"u",companyId:"c",...scope})).rejects.toThrow();expect(m.transaction).not.toHaveBeenCalled()});
it("runs authorized standalone scans in a consistent snapshot",async()=>{await expect(verifyCompanyAccountDataForActor({id:"u",companyId:"c",accountRole:"ACCOUNT_ADMIN",branchAccessScope:"ALL_BRANCHES"})).resolves.toEqual([]);expect(m.transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:"RepeatableRead"})});

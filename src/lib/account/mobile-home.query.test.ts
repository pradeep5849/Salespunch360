import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ documents: vi.fn(), customers: vi.fn(), balances: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  commercialDocument: { findMany: mocks.documents, groupBy: mocks.balances },
  customer: { findMany: mocks.customers },
} }));
vi.mock("@/lib/account/commercial", () => ({ documentOutstandingsBatch: vi.fn() }));
import { accountMobileHomeData } from "./mobile-home";
const actor = { id: "user", companyId: "company", accountRole: "ACCOUNT_ADMIN" as const, branchAccessScope: "ALL_BRANCHES" as const, branchIds: [] };
const context = { mode: "BRANCH" as const, branchId: "00000000-0000-4000-8000-000000000001", branchName: "Selected" };
describe("Home commercial query with non-commercial filters", () => {
  beforeEach(() => { vi.resetAllMocks(); mocks.documents.mockResolvedValue([]); mocks.customers.mockResolvedValue([]); });
  it.each(["EXPENSE", "CUSTOMER_RECEIPT", "VENDOR_PAYMENT", "ESTIMATE"])("%s produces an empty UUID set while retaining company/branch scope", async (type) => {
    await accountMobileHomeData(actor, context, { types: [type], q: "query" });
    const where = mocks.documents.mock.calls[0][0].where;
    expect(where.companyId).toBe(actor.companyId);
    expect(where.branchId).toBe(context.branchId);
    expect(where.AND[0]).toEqual({ OR: [{ id: { in: [] } }] });
    expect(where.AND[1].OR[0].partyName.contains).toBe("query");
  });
  it("mixed filters retain the selected commercial type", async () => {
    await accountMobileHomeData(actor, context, { types: ["EXPENSE", "SALES_INVOICE"] });
    expect(mocks.documents.mock.calls[0][0].where.AND[0]).toEqual({ OR: [{ type: "SALES_INVOICE" }] });
  });
  it("unsupported reference categories are explicit and never become fake commercial UUIDs",async()=>{
    const result=await accountMobileHomeData(actor,context,{types:["SALE_FA","PURCHASE_FA","JOB_WORK_OUT","SALE_REPEATING","P2P_RECEIVED"]});
    expect(result.transactions).toEqual([]);expect(result.unavailableFilters.map(row=>row.key)).toEqual(["SALE_FA","PURCHASE_FA","JOB_WORK_OUT","SALE_REPEATING"]);
    expect(result.unavailableFilters.every(row=>row.message.includes("not included"))).toBe(true);expect(mocks.documents.mock.calls[0][0].where.AND[0]).toEqual({OR:[{id:{in:[]}}]});
  });

});

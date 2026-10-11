import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({ accounts: vi.fn(), groups: vi.fn(), documents: vi.fn(), branch: vi.fn(), branches: vi.fn(), access: vi.fn(), customers: vi.fn(), vendors: vi.fn(), products: vi.fn(), projects: vi.fn(), company: vi.fn(), webAuth: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: {
  ledgerAccount: { findMany: mocks.accounts }, journalLine: { groupBy: mocks.groups },
  commercialDocument: { findMany: mocks.documents }, branch: { findFirst: mocks.branch, findMany: mocks.branches }, company: { findUnique: mocks.company },
  userBranchAccess: { findMany: mocks.access }, customer: { findMany: mocks.customers }, vendor: { findMany: mocks.vendors }, accountProduct: { findMany: mocks.products }, project: { findMany: mocks.projects },
} }));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requirePermission: mocks.webAuth, requirePermissionForMutation: mocks.webAuth,
}));
import { runFinancialReportForActor, reportOptionsForActor } from "./service";
import { reportFinancialYearStart } from "./dates";
import type { ProjectActor } from "../projects";
const actor = { id: "actor", companyId: "company", accountRole: "ACCOUNT_ADMIN", branchAccessScope: "SELECTED_BRANCHES", branchIds: ["allowed"] } as ProjectActor;
const D = (value: string) => new Prisma.Decimal(value);
beforeEach(() => {
  vi.clearAllMocks(); mocks.accounts.mockResolvedValue([]); mocks.groups.mockResolvedValue([]); mocks.documents.mockResolvedValue([]);
  mocks.webAuth.mockRejectedValue(new Error("NO_WEB_SESSION"));
  mocks.company.mockResolvedValue({ productEdition: "SALESPUNCH360_ACCOUNT", accountSettings: { enabledModules: ["GST_ADVANCED"] } });
  mocks.branches.mockResolvedValue([]); mocks.access.mockResolvedValue([{branchId:"allowed"}]);
  mocks.customers.mockResolvedValue([]); mocks.vendors.mockResolvedValue([]); mocks.products.mockResolvedValue([]); mocks.projects.mockResolvedValue([]);
});
describe("A084 report filter, accounting and native authentication boundaries", () => {
  it("limits customer options to assigned branches and keeps all-branch options tenant-scoped", async () => {
    await reportOptionsForActor(actor);
    expect(mocks.customers).toHaveBeenLastCalledWith({where:{companyId:"company",isActive:true,isAccountCustomer:true,branchId:{in:["allowed"]}}});
    await reportOptionsForActor({...actor, branchIds:[]});
    expect(mocks.customers).toHaveBeenLastCalledWith({where:{companyId:"company",isActive:true,isAccountCustomer:true,branchId:{in:[]}}});
    await reportOptionsForActor({...actor, branchAccessScope:"ALL_BRANCHES"});
    expect(mocks.customers).toHaveBeenLastCalledWith({where:{companyId:"company",isActive:true,isAccountCustomer:true}});
  });
  it("accepts blank All selectors and company scope without widening assigned branches", async () => {
    await runFinancialReportForActor(actor, "trial-balance", { from:"2026-04-01",to:"2026-10-11",scope:"all",branchId:"",projectId:"",customerId:"",vendorId:"",productId:"",ledgerId:"" });
    expect(mocks.groups).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({companyId:"company",journalEntry:expect.objectContaining({branchId:{in:["allowed"]}})}) }));
    await expect(runFinancialReportForActor(actor,"trial-balance",{unexpected:"value"})).rejects.toThrow();
  });
  it("uses the preceding April during January through March and the selected cutoff year", () => {
    expect(reportFinancialYearStart(new Date("2026-01-10")).toISOString().slice(0,10)).toBe("2025-04-01");
    expect(reportFinancialYearStart(new Date("2026-03-31")).toISOString().slice(0,10)).toBe("2025-04-01");
    expect(reportFinancialYearStart(new Date("2026-04-01")).toISOString().slice(0,10)).toBe("2026-04-01");
  });
  it("includes opening unclosed earnings in Balance Sheet without changing period Profit and Loss", async () => {
    mocks.accounts.mockResolvedValue([{id:"cash",code:"C",name:"Cash",accountClass:"ASSET"},{id:"income",code:"I",name:"Income",accountClass:"INCOME"}]);
    const opening=[{ledgerAccountId:"cash",_sum:{debit:D("100"),credit:D("0")}},{ledgerAccountId:"income",_sum:{debit:D("0"),credit:D("100")}}];
    mocks.groups.mockResolvedValueOnce(opening).mockResolvedValueOnce([]);
    const balance = await runFinancialReportForActor(actor,"balance-sheet",{from:"2026-10-01",to:"2026-10-11"});
    expect(balance.rows.find(row=>row[0]==="Current Earnings")?.[1]).toBe("100");
    expect(balance.rows.find(row=>row[0]==="Difference")?.[1]).toBe("0");
    mocks.groups.mockResolvedValueOnce(opening).mockResolvedValueOnce([]);
    const profit=await runFinancialReportForActor(actor,"profit-loss",{from:"2026-10-01",to:"2026-10-11"});
    expect(profit.rows.find(row=>row[0]==="Profit")?.[1]).toBe("0");
  });
  it("runs GST with the supplied native actor without a web session and retains tenant/branch scope", async () => {
    const result=await runFinancialReportForActor(actor,"tax",{from:"2026-04-01",to:"2026-10-11"});
    expect(result.title).toBe("GST / Tax");expect(mocks.webAuth).not.toHaveBeenCalled();
    expect(mocks.documents).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company",branchId:{in:["allowed"]}})}));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  accounts: vi.fn(),
  groups: vi.fn(),
  documents: vi.fn(),
  branch: vi.fn(),
  branches: vi.fn(),
  access: vi.fn(),
  customers: vi.fn(),
  vendors: vi.fn(),
  products: vi.fn(),
  projects: vi.fn(),
  company: vi.fn(),
  owners: vi.fn(),
  owner: vi.fn(),
  webAuth: vi.fn(),
  movements: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    ownerFinancialAccount: { findMany: mocks.owners, findFirst: mocks.owner },
    ledgerAccount: { findMany: mocks.accounts },
    journalLine: { groupBy: mocks.groups },
    commercialDocument: { findMany: mocks.documents },
    branch: { findFirst: mocks.branch, findMany: mocks.branches },
    company: { findUnique: mocks.company },
    userBranchAccess: { findMany: mocks.access },
    customer: { findMany: mocks.customers },
    vendor: { findMany: mocks.vendors },
    accountProduct: { findMany: mocks.products },
    project: { findMany: mocks.projects },
    projectMaterialMovement: { findMany: mocks.movements },
  },
}));
vi.mock("@/lib/auth/authorization", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
  requirePermission: mocks.webAuth,
  requirePermissionForMutation: mocks.webAuth,
}));
import { runFinancialReportForActor, reportOptionsForActor } from "./service";
import { reportFinancialYearStart } from "./dates";
import type { ProjectActor } from "../projects";
const actor = {
  id: "actor",
  companyId: "company",
  accountRole: "ACCOUNT_ADMIN",
  branchAccessScope: "SELECTED_BRANCHES",
  branchIds: ["allowed"],
} as ProjectActor;
const D = (value: string) => new Prisma.Decimal(value);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.owners.mockResolvedValue([]);
  mocks.accounts.mockResolvedValue([]);
  mocks.groups.mockResolvedValue([]);
  mocks.documents.mockResolvedValue([]);
  mocks.webAuth.mockRejectedValue(new Error("NO_WEB_SESSION"));
  mocks.company.mockResolvedValue({
    productEdition: "SALESPUNCH360_ACCOUNT",
    accountSettings: { enabledModules: ["GST_ADVANCED"] },
  });
  mocks.branches.mockResolvedValue([]);
  mocks.access.mockResolvedValue([{ branchId: "allowed" }]);
  mocks.customers.mockResolvedValue([]);
  mocks.vendors.mockResolvedValue([]);
  mocks.products.mockResolvedValue([]);
  mocks.projects.mockResolvedValue([]);
  mocks.movements.mockResolvedValue([]);
});
describe("A084 report filter, accounting and native authentication boundaries", () => {
  it("limits customer options to assigned branches and keeps all-branch options tenant-scoped", async () => {
    await reportOptionsForActor(actor);
    expect(mocks.customers).toHaveBeenLastCalledWith({
      where: {
        companyId: "company",
        isActive: true,
        isAccountCustomer: true,
        branchId: { in: ["allowed"] },
      },
    });
    await reportOptionsForActor({ ...actor, branchIds: [] });
    expect(mocks.customers).toHaveBeenLastCalledWith({
      where: {
        companyId: "company",
        isActive: true,
        isAccountCustomer: true,
        branchId: { in: [] },
      },
    });
    await reportOptionsForActor({
      ...actor,
      branchAccessScope: "ALL_BRANCHES",
    });
    expect(mocks.customers).toHaveBeenLastCalledWith({
      where: { companyId: "company", isActive: true, isAccountCustomer: true },
    });
  });
  it("accepts blank All selectors and company scope without widening assigned branches", async () => {
    await runFinancialReportForActor(actor, "trial-balance", {
      from: "2026-04-01",
      to: "2026-10-11",
      scope: "all",
      branchId: "",
      projectId: "",
      customerId: "",
      vendorId: "",
      productId: "",
      ledgerId: "",
    });
    expect(mocks.groups).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company",
          journalEntry: expect.objectContaining({
            branchId: { in: ["allowed"] },
          }),
        }),
      }),
    );
    await expect(
      runFinancialReportForActor(actor, "trial-balance", {
        unexpected: "value",
      }),
    ).rejects.toThrow();
  });
  it("uses the preceding April during January through March and the selected cutoff year", () => {
    expect(
      reportFinancialYearStart(new Date("2026-01-10"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2025-04-01");
    expect(
      reportFinancialYearStart(new Date("2026-03-31"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2025-04-01");
    expect(
      reportFinancialYearStart(new Date("2026-04-01"))
        .toISOString()
        .slice(0, 10),
    ).toBe("2026-04-01");
  });
  it("includes opening unclosed earnings in Balance Sheet without changing period Profit and Loss", async () => {
    mocks.accounts.mockResolvedValue([
      { id: "cash", code: "C", name: "Cash", accountClass: "ASSET" },
      { id: "income", code: "I", name: "Income", accountClass: "INCOME" },
    ]);
    const opening = [
      { ledgerAccountId: "cash", _sum: { debit: D("100"), credit: D("0") } },
      { ledgerAccountId: "income", _sum: { debit: D("0"), credit: D("100") } },
    ];
    mocks.groups.mockResolvedValueOnce(opening).mockResolvedValueOnce([]);
    const balance = await runFinancialReportForActor(actor, "balance-sheet", {
      from: "2026-10-01",
      to: "2026-10-11",
    });
    expect(balance.rows.find((row) => row[0] === "Current Earnings")?.[1]).toBe(
      "100",
    );
    expect(balance.rows.find((row) => row[0] === "Difference")?.[1]).toBe("0");
    mocks.groups.mockResolvedValueOnce(opening).mockResolvedValueOnce([]);
    const profit = await runFinancialReportForActor(actor, "profit-loss", {
      from: "2026-10-01",
      to: "2026-10-11",
    });
    expect(profit.rows.find((row) => row[0] === "Profit")?.[1]).toBe("0");
  });
  it("runs GST with the supplied native actor without a web session and retains tenant/branch scope", async () => {
    const result = await runFinancialReportForActor(actor, "tax", {
      from: "2026-04-01",
      to: "2026-10-11",
    });
    expect(result.title).toBe("GST / Tax");
    expect(mocks.webAuth).not.toHaveBeenCalled();
    expect(mocks.documents).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company",
          branchId: { in: ["allowed"] },
        }),
      }),
    );
  });
});

describe("A065 owner report period, combined totals and scope", () => {
  const ownerId = "00000000-0000-4000-8000-000000000001";
  const grouped = (ledgerAccountId: string, debit: string, credit: string) => ({
    ledgerAccountId,
    _sum: { debit: D(debit), credit: D(credit) },
  });
  it("separates opening capital, net period capital movement and profit drawings with combined totals", async () => {
    mocks.owners.mockResolvedValue([
      {
        id: ownerId,
        name: "Partner one",
        capitalLedgerId: "c1",
        drawingsLedgerId: "d1",
        loanLedgerId: "l1",
      },
      {
        id: "second",
        name: "Partner two",
        capitalLedgerId: "c2",
        drawingsLedgerId: "d2",
        loanLedgerId: "l2",
      },
    ]);
    mocks.groups
      .mockResolvedValueOnce([
        grouped("c1", "0", "100"),
        grouped("c2", "0", "200"),
        grouped("d1", "5", "0"),
      ])
      .mockResolvedValueOnce([
        grouped("c1", "10", "40"),
        grouped("c2", "20", "0"),
        grouped("d1", "30", "10"),
        grouped("l1", "0", "50"),
      ]);
    const result = await runFinancialReportForActor(actor, "owner-capital", {
      from: "2026-10-01",
      to: "2026-10-12",
    });
    expect(result.rows).toEqual([
      ["Partner one", "100", "30", "130", "20", "25", "50"],
      ["Partner two", "200", "-20", "180", "0", "0", "0"],
    ]);
    expect(result.totals).toEqual([
      "Combined total",
      "300",
      "10",
      "310",
      "20",
      "25",
      "50",
    ]);
    for (const [query] of mocks.groups.mock.calls)
      expect(query.where).toMatchObject({
        companyId: "company",
        journalEntry: {
          branchId: { in: ["allowed"] },
          status: { in: ["POSTED", "REVERSED"] },
        },
      });
    expect(mocks.groups.mock.calls[0][0].where.journalEntry.entryDate).toEqual({
      lt: new Date("2026-10-01"),
    });
    expect(mocks.groups.mock.calls[1][0].where.journalEntry.entryDate).toEqual({
      gte: new Date("2026-10-01"),
      lte: new Date("2026-10-12"),
    });
  });
  it("rejects a missing or other-company owner before accessing journal totals", async () => {
    mocks.owner.mockResolvedValue(null);
    await expect(
      runFinancialReportForActor(actor, "owner-capital", { ownerId }),
    ).rejects.toThrow();
    expect(mocks.owner).toHaveBeenCalledWith({
      where: { id: ownerId, companyId: "company" },
      select: { id: true },
    });
    expect(mocks.groups).not.toHaveBeenCalled();
  });
  it("accepts a company owner and restricts both rows and ledger totals to that owner", async () => {
    mocks.owner.mockResolvedValue({ id: ownerId });
    mocks.owners.mockResolvedValue([
      {
        id: ownerId,
        name: "Inactive partner",
        capitalLedgerId: "c",
        drawingsLedgerId: "d",
        loanLedgerId: "l",
      },
    ]);
    const result = await runFinancialReportForActor(actor, "owner-capital", {
      ownerId,
    });
    expect(mocks.owners.mock.calls[0][0].where).toEqual({
      companyId: "company",
      id: ownerId,
    });
    expect(mocks.groups.mock.calls[0][0].where.ledgerAccountId).toEqual({
      in: ["c", "d", "l"],
    });
    expect(result.rows[0][0]).toBe("Inactive partner");
  });
});

describe("A084-F17 dormant costed Project material report boundaries",()=>{
 const manager={...actor,isActive:true,role:"ACCOUNT_USER",accountAccessActive:true,accountRole:"PROJECT_MANAGER"} as ProjectActor;
 const enable=()=>mocks.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
 it("requires both Project and costing modules before reading material costs",async()=>{
  for(const enabledModules of [[],["PROJECTS"],["PROJECT_COSTING"]]){
   mocks.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules}});
   await expect(runFinancialReportForActor(manager,"project-material-balance",{})).rejects.toThrow();
  }
  expect(mocks.movements).not.toHaveBeenCalled();
 });
 it("scopes every all-project material query to assignments as well as authorized branches",async()=>{
  enable();mocks.projects.mockResolvedValue([{id:"assigned-project"}]);
  await runFinancialReportForActor(manager,"material-consumption",{});
  expect(mocks.projects).toHaveBeenCalledWith({where:{companyId:"company",branchId:{in:["allowed"]},OR:[{projectManagerId:"actor"},{members:{some:{userId:"actor"}}}]},select:{id:true}});
  expect(mocks.movements).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({companyId:"company",branchId:{in:["allowed"]},projectId:{in:["assigned-project"]},movementType:"CONSUMPTION"})}));
 });
 it("rejects an unassigned explicit project before any material read",async()=>{
  enable();mocks.projects.mockResolvedValue([]);
  await expect(runFinancialReportForActor(manager,"project-transfer",{projectId:"00000000-0000-4000-8000-000000000001"})).rejects.toThrow();
  expect(mocks.movements).not.toHaveBeenCalled();
 });
 it("retains original cost and correction lineage without changing signed source movements",async()=>{
  enable();mocks.projects.mockResolvedValue([{id:"assigned-project"}]);
  mocks.movements.mockResolvedValue([{movementDate:new Date("2026-10-14"),projectId:"assigned-project",movementType:"RETURN_TO_INVENTORY",productId:"product",quantity:D("2"),originalUnitCost:D("40"),totalCost:D("80"),sourceProjectId:"assigned-project",destinationProjectId:null,purchaseDocumentId:"purchase",correctionDocumentId:"debit-note",sourceMovementId:"original-receipt"}]);
  const result=await runFinancialReportForActor(manager,"project-material-balance",{});
  expect(result.rows[0]).toEqual(["2026-10-14","assigned-project","RETURN_TO_INVENTORY","product","2","40","80","assigned-project","","purchase","debit-note","original-receipt"]);
 });
 it("rejects a role without report and costing access before querying movements",async()=>{
  enable();await expect(runFinancialReportForActor({...actor,accountRole:"DATA_ENTRY"} as ProjectActor,"project-material-balance",{})).rejects.toThrow();expect(mocks.movements).not.toHaveBeenCalled();
 });
});

it("A084-F17 denies Accountant material costs even when material read is allowed",async()=>{
 mocks.company.mockResolvedValue({productEdition:"SALESPUNCH360_ACCOUNT",accountSettings:{enabledModules:["PROJECTS","PROJECT_COSTING"]}});
 await expect(runFinancialReportForActor({...actor,isActive:true,role:"ACCOUNT_USER",accountAccessActive:true,accountRole:"ACCOUNTANT"} as ProjectActor,"project-material-balance",{})).rejects.toThrow();
 expect(mocks.movements).not.toHaveBeenCalled();
});

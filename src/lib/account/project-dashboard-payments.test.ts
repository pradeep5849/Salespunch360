import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const calls = vi.hoisted(() => ({
  company: vi.fn(),
  branches: vi.fn(),
  projects: vi.fn(),
  changes: vi.fn(),
  settlements: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    company: { findUnique: calls.company },
    branch: { findMany: calls.branches },
    project: { findMany: calls.projects },
    projectChangeOrder: { findMany: calls.changes },
    accountSettlement: { findMany: calls.settlements },
  },
}));
vi.mock("./modules", () => ({ requireAccountModules: vi.fn() }));
import { projectDashboardForActor, type ProjectActor } from "./projects";
const decimal = (amount: string) => new Prisma.Decimal(amount);
const actor = {
  id: "actor",
  companyId: "company",
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
  salesRole: null,
  managerType: null,
  branchAccessScope: "ALL_BRANCHES",
  branchIds: ["branch"],
} as ProjectActor;
describe("Project dashboard financial balances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.company.mockResolvedValue({
      productEdition: "SALESPUNCH360_ACCOUNT",
    });
    calls.branches.mockResolvedValue([{ id: "branch" }]);
    calls.changes.mockResolvedValue([]);
    calls.settlements.mockResolvedValue([
      { projectId: "project", amount: decimal("20") },
    ]);
  });
  it("uses authoritative payable amounts for invoices and corrections, and only posted payments", async () => {
    calls.projects.mockResolvedValue([
      {
        id: "project",
        name: "Job",
        projectNumber: "P-1",
        status: "ACTIVE",
        projectValue: decimal("100"),
        customer: { name: "Customer" },
        commercialDocuments: [
          {
            grandTotal: decimal("100"),
            payableAmount: decimal("80"),
            allocations: [{ amount: decimal("15") }],
            advanceApplications: [{ amount: decimal("5") }],
            adjustments: [
              { grandTotal: decimal("25"), payableAmount: decimal("20") },
            ],
          },
        ],
      },
    ]);
    const result = await projectDashboardForActor(actor);
    expect(result.rows[0].outstanding.toString()).toBe("40");
    expect(result.metrics.received.toString()).toBe("20");
    expect(calls.settlements).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: "company",
          status: "POSTED",
        }),
      }),
    );
  });
  it("keeps legacy invoices with no payable snapshot readable", async () => {
    calls.projects.mockResolvedValue([
      {
        id: "project",
        name: "Legacy",
        projectNumber: "P-2",
        status: "COMPLETED",
        projectValue: decimal("100"),
        customer: { name: "Customer" },
        commercialDocuments: [
          {
            grandTotal: decimal("100"),
            payableAmount: null,
            allocations: [],
            advanceApplications: [],
            adjustments: [],
          },
        ],
      },
    ]);
    const result = await projectDashboardForActor(actor);
    expect(result.metrics.outstanding.toString()).toBe("100");
    expect(result.metrics.activeProjects).toBe(0);
    expect(result.metrics.projectsClosed).toBe(1);
  });
});

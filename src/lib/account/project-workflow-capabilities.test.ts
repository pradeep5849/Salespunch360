import { describe, expect, it } from "vitest";
import type { WorkspacePrincipal } from "@/lib/auth/workspace-policy";
import { projectWorkflowCapabilities } from "./project-workflow-capabilities";
const actor: WorkspacePrincipal = {
  companyId: "company",
  role: "ACCOUNT_USER",
  accountRole: "ACCOUNT_ADMIN",
  salesRole: null,
  managerType: null,
  isActive: true,
  accountAccessActive: true,
  salesAccessActive: false,
};
describe("simple Project workflow navigation authority", () => {
  it("hides every action when Projects is OFF or Account access is inactive", () => {
    expect(
      Object.values(
        projectWorkflowCapabilities(actor, "SALESPUNCH360_PLUS", [
          "PROJECT_COSTING",
        ]),
      ),
    ).not.toContain(true);
    expect(
      Object.values(
        projectWorkflowCapabilities(
          { ...actor, accountAccessActive: false },
          "SALESPUNCH360_PLUS",
          ["PROJECTS", "PROJECT_COSTING"],
        ),
      ),
    ).not.toContain(true);
  });
  it("does not give a Project Manager financial posting or assignment authority", () => {
    const caps = projectWorkflowCapabilities(
      { ...actor, accountRole: "PROJECT_MANAGER" },
      "SALESPUNCH360_PLUS",
      ["PROJECTS", "PROJECT_COSTING"],
    );
    expect(caps).toEqual({
      paymentIn: false,
      purchase: false,
      expense: true,
      material: true,
      extraJob: true,
      report: true,
      assignment: false,
    });
  });
  it("allows an authorized Account Admin and independently gates costing", () => {
    expect(
      Object.values(
        projectWorkflowCapabilities(actor, "SALESPUNCH360_PLUS", [
          "PROJECTS",
          "PROJECT_COSTING",
        ]),
      ),
    ).not.toContain(false);
    const caps = projectWorkflowCapabilities(actor, "SALESPUNCH360_PLUS", [
      "PROJECTS",
    ]);
    expect(caps.extraJob).toBe(false);
    expect(caps.report).toBe(false);
    expect(caps.purchase).toBe(true);
  });
});
